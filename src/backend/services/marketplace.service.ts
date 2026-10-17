/**
 * Public car marketplace (PakWheels-style listings) built on dealership stock.
 * Everything returned here is safe to show anonymously: no costs, floor
 * prices, internal notes or full VINs ever leave this file.
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { DealerCustomer, DealerDeal, Vehicle, type IDealerDeal, type IVehicle } from "@/backend/models/Dealership";
import { ClassifiedAd, ShopSettings, type IClassifiedAd } from "@/backend/models/Marketplace";
import { InventoryItem } from "@/backend/models/Inventory";
import { Settings } from "@/backend/models/Settings";
import { ServiceError } from "@/backend/types";
import { priceInsight, type PriceInsight } from "@/lib/dealership";
import { parseSmartQuery } from "@/lib/smartSearch";
import { offerService } from "@/backend/services/offer.service";
import { partnerService } from "@/backend/services/partner.service";
import type { inquirySchema, sellRequestSchema } from "@/backend/validators/dealership.validator";

type Doc<T> = T & { _id: Types.ObjectId };
type InquiryInput = z.infer<typeof inquirySchema>;
type SellInput = z.infer<typeof sellRequestSchema>;

const LISTABLE = ["in_stock", "reserved"];
export const PAGE_SIZE = 24;

export type ListingFilters = {
  type?: "car" | "bike";
  seller?: "dealer" | "private";
  q?: string;
  make?: string;
  model?: string;
  city?: string;
  body?: string;
  fuel?: string;
  transmission?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxKm?: number;
  inspected?: boolean;
  assembly?: "Local" | "Imported";
  firstOwner?: boolean;
  accidentFree?: boolean;
  genuinePaint?: boolean;
  /** Must have every one of these features. */
  features?: string[];
  /** Plain-language search extras (see lib/smartSearch). */
  bodies?: string[];
  excludeBodies?: string[];
  minSeats?: number;
  minFuelAvg?: number;
  minCc?: number;
  maxCc?: number;
  /** Only this member's ads (a registered dealer's page). */
  sellerMember?: string;
  /** City the car is registered in (number-plate city). */
  regCity?: string;
  /** Only listings published after this time (saved-search alerts). */
  since?: Date;
  /** The plain-language query and what we read from it. */
  ask?: string;
  understood?: string[];
  sort?: string;
  page?: number;
};

export type PublicListing = {
  _id: string;
  vehicleType: "car" | "bike";
  seller: {
    type: "dealer" | "private";
    name?: string;
    phone?: string;
    memberSince?: string;
    /** Set when a private ad belongs to a registered, approved dealership. */
    business?: { name: string; slug: string; city: string; verified: boolean };
  };
  negotiable?: boolean;
  title: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  bodyType?: string;
  fuel?: string;
  transmission?: string;
  color?: string;
  engineCc?: number;
  mileage: number;
  condition: string;
  status: string;
  city?: string;
  registeredIn?: string;
  vinMasked?: string;
  price: number;
  photos: string[];
  features: string[];
  specs: Record<string, string | number | boolean>;
  videoUrl?: string;
  /** Set while a price cut is under 30 days old. */
  priceDrop?: { from: number; at: string };
  /** Private sellers: member id, for trust score / reviews. */
  sellerId?: string;
  description?: string;
  featured: boolean;
  publishedAt?: string;
  inspection: {
    overall: number | null;
    scores: Record<string, number>;
    notes: Record<string, string>;
    summary?: string;
    inspectedAt?: string;
  } | null;
  insight: PriceInsight | null;
  branch: { code: string; name: string; phone?: string; address?: string } | null;
};

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (x: string) => new RegExp(`^${esc(x.trim())}$`, "i");

/** Filters shared by dealer stock and private ads (field names match on purpose). */
function baseQuery(f: ListingFilters) {
  const q: Record<string, unknown> = {};
  if (f.type === "bike") q.vehicleType = "bike";
  // Older dealer stock predates vehicleType: missing means "car".
  if (f.type === "car") q.vehicleType = { $in: ["car", null] };
  if (f.make) q.make = exact(f.make);
  if (f.model) q.model = exact(f.model);
  if (f.city) q.city = exact(f.city);
  if (f.body) q.bodyType = f.body;
  if (f.fuel) q.fuel = f.fuel;
  if (f.transmission) q.transmission = f.transmission;
  if (f.condition) q.condition = f.condition;
  if (f.minPrice || f.maxPrice) {
    q.listPrice = { ...(f.minPrice ? { $gte: f.minPrice } : {}), ...(f.maxPrice ? { $lte: f.maxPrice } : {}) };
  }
  if (f.minYear || f.maxYear) {
    q.year = { ...(f.minYear ? { $gte: f.minYear } : {}), ...(f.maxYear ? { $lte: f.maxYear } : {}) };
  }
  if (f.maxKm) q.mileage = { $lte: f.maxKm };
  if (f.since) q.publishedAt = { $gt: f.since };
  if (f.assembly) q["specs.assembly"] = f.assembly;
  if (f.firstOwner) q["specs.ownership"] = "First owner";
  if (f.accidentFree) q["specs.accidentHistory"] = "No accident";
  if (f.genuinePaint) q["specs.paint"] = "Total genuine";
  const and: Record<string, unknown>[] = [];
  if (f.regCity) and.push({ $or: [{ registeredIn: exact(f.regCity) }, { "specs.registrationCity": exact(f.regCity) }] });
  if (f.features?.length) and.push(...f.features.map((x) => ({ features: exact(x) })));
  if (f.bodies?.length && !f.body) q.bodyType = { $in: f.bodies };
  else if (f.excludeBodies?.length && !f.body) q.bodyType = { $nin: f.excludeBodies };
  // Spec-based asks also accept listings that never filled the spec in, so a
  // half-complete ad is not hidden; complete ads that fail are excluded.
  if (f.minSeats) and.push({ $or: [{ "specs.seats": { $gte: f.minSeats } }, { "specs.seats": { $exists: false } }] });
  if (f.minFuelAvg) {
    and.push({ $or: [{ "specs.fuelAverageCity": { $gte: f.minFuelAvg } }, { fuel: "Hybrid" }, { fuel: "Electric" }, { engineCc: { $lte: 1300, $gt: 0 } }] });
  }
  if (f.minCc || f.maxCc) q.engineCc = { ...(f.minCc ? { $gte: f.minCc } : {}), ...(f.maxCc ? { $lte: f.maxCc } : {}) };
  if (and.length) q.$and = and;
  if (f.q?.trim()) {
    const rx = new RegExp(esc(f.q.trim()), "i");
    q.$or = [{ make: rx }, { model: rx }, { variant: rx }, { color: rx }, { city: rx }];
  }
  return q;
}

function dealerQuery(f: ListingFilters) {
  const q: Record<string, unknown> = { ...baseQuery(f), published: true, status: { $in: LISTABLE } };
  if (f.inspected) q["inspection.overall"] = { $ne: null, $exists: true };
  return q;
}

function privateQuery(f: ListingFilters) {
  const q: Record<string, unknown> = { ...baseQuery(f), status: "active", expiresAt: { $gt: new Date() } };
  if (f.sellerMember && Types.ObjectId.isValid(f.sellerMember)) q.memberId = new Types.ObjectId(f.sellerMember);
  return q;
}

/** Private ads are excluded when the buyer asks for inspected or dealer-only stock. */
function includePrivate(f: ListingFilters) {
  return f.seller !== "dealer" && !f.inspected;
}

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { featured: -1, publishedAt: -1, _id: -1 },
  price_asc: { listPrice: 1, _id: 1 },
  price_desc: { listPrice: -1, _id: 1 },
  year_desc: { year: -1, listPrice: 1, _id: 1 },
  km_asc: { mileage: 1, _id: 1 },
};

type AnyListing = (Doc<IVehicle> & { _src?: "dealer" }) | (Doc<IClassifiedAd> & { _src: "private" });

/** One comps query for a whole page of listings instead of one per car. */
async function insightsFor(list: Pick<Doc<IVehicle>, "_id" | "make" | "model" | "year" | "mileage" | "listPrice">[]) {
  const out = new Map<string, PriceInsight | null>();
  if (!list.length) return out;
  const pairs = [...new Map(list.map((v) => [`${v.make}|${v.model}`.toLowerCase(), v])).values()];
  const comps = await Vehicle.find({ $or: pairs.map((v) => ({ make: exact(v.make), model: exact(v.model) })) })
    .select("make model year mileage listPrice status dealId")
    .limit(2000)
    .lean<Doc<IVehicle>[]>();
  const deals = await DealerDeal.find({ _id: { $in: comps.filter((c) => c.dealId).map((c) => c.dealId) }, status: "delivered" })
    .select("salePrice discount")
    .lean<Doc<IDealerDeal>[]>();
  const sold = new Map(deals.map((d) => [String(d._id), d.salePrice - d.discount]));
  for (const v of list) {
    const pool = comps.filter(
      (c) =>
        String(c._id) !== String(v._id) &&
        c.make.toLowerCase() === v.make.toLowerCase() &&
        c.model.toLowerCase() === v.model.toLowerCase() &&
        Math.abs(c.year - v.year) <= 2
    );
    out.set(
      String(v._id),
      priceInsight(
        { year: v.year, mileage: v.mileage || 0, price: v.listPrice || 0 },
        pool.map((c) => ({
          year: c.year,
          mileage: c.mileage || 0,
          price: (c.dealId && sold.get(String(c.dealId))) || c.listPrice || 0,
        }))
      )
    );
  }
  return out;
}

async function branchMap() {
  const settings = await Settings.findOne()
    .select("branches")
    .lean<{ branches?: { code: string; name: string; phone?: string; address?: string }[] }>();
  return new Map((settings?.branches || []).map((b) => [b.code.toUpperCase(), b]));
}

function toPublic(
  v: Doc<IVehicle>,
  insight: PriceInsight | null,
  branches: Map<string, { code: string; name: string; phone?: string; address?: string }>
): PublicListing {
  const b = branches.get(v.branchCode);
  return {
    _id: String(v._id),
    vehicleType: v.vehicleType || "car",
    seller: { type: "dealer", name: b?.name },
    title: [v.year, v.make, v.model, v.variant].filter(Boolean).join(" "),
    make: v.make,
    model: v.model,
    variant: v.variant,
    year: v.year,
    bodyType: v.bodyType,
    fuel: v.fuel,
    transmission: v.transmission,
    color: v.color,
    engineCc: v.engineCc,
    mileage: v.mileage || 0,
    condition: v.condition,
    status: v.status,
    city: v.city,
    // "LEA-22-1234" → "LEA": the registering city, not the plate.
    registeredIn: v.registrationNo ? v.registrationNo.split(/[-\s]/)[0] : undefined,
    vinMasked: v.vin ? `•••••••••••${v.vin.slice(-6)}` : undefined,
    price: v.listPrice || 0,
    photos: v.photos || [],
    features: v.features || [],
    specs: v.specs || {},
    videoUrl: v.videoUrl,
    priceDrop: recentDrop(v.priceDrop, v.listPrice),
    description: v.description,
    featured: Boolean(v.featured),
    publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : undefined,
    inspection: v.inspection?.overall != null
      ? {
          overall: v.inspection.overall,
          scores: v.inspection.scores || {},
          notes: v.inspection.notes || {},
          summary: v.inspection.summary,
          inspectedAt: v.inspection.inspectedAt ? new Date(v.inspection.inspectedAt).toISOString() : undefined,
        }
      : null,
    insight,
    branch: b ? { code: b.code, name: b.name, phone: b.phone, address: b.address } : null,
  };
}

function recentDrop(d: { from: number; at: Date } | undefined, price?: number) {
  if (!d?.from || !price || d.from <= price) return undefined;
  if (Date.now() - new Date(d.at).getTime() > 30 * 86_400_000) return undefined;
  return { from: d.from, at: new Date(d.at).toISOString() };
}

function adToPublic(a: Doc<IClassifiedAd>, insight: PriceInsight | null): PublicListing {
  return {
    _id: String(a._id),
    vehicleType: a.vehicleType,
    seller: { type: "private", name: a.sellerName, phone: a.showPhone ? a.sellerPhone : undefined, memberSince: a.createdAt ? new Date(a.createdAt).toISOString() : undefined },
    negotiable: a.negotiable,
    title: [a.year, a.make, a.model, a.variant].filter(Boolean).join(" "),
    make: a.make,
    model: a.model,
    variant: a.variant,
    year: a.year,
    bodyType: a.bodyType,
    fuel: a.fuel,
    transmission: a.transmission,
    color: a.color,
    engineCc: a.engineCc,
    mileage: a.mileage || 0,
    condition: a.condition,
    status: "in_stock",
    city: a.city,
    registeredIn: a.registeredIn,
    price: a.listPrice,
    photos: a.photos || [],
    features: a.features || [],
    specs: a.specs || {},
    videoUrl: a.videoUrl,
    priceDrop: recentDrop(a.priceDrop, a.listPrice),
    sellerId: String(a.memberId),
    description: a.description,
    featured: Boolean(a.featured),
    publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
    inspection: null,
    insight,
    branch: null,
  };
}

function anyToPublic(
  row: AnyListing,
  insights: Map<string, PriceInsight | null>,
  branches: Map<string, { code: string; name: string; phone?: string; address?: string }>
) {
  const insight = insights.get(String(row._id)) ?? null;
  return row._src === "private"
    ? adToPublic(row as Doc<IClassifiedAd>, insight)
    : toPublic(row as Doc<IVehicle>, insight, branches);
}

/** Compares two rows the way MongoDB would sort them for `sort`. */
function sortCompare(sort: Record<string, 1 | -1>) {
  const val = (row: Record<string, unknown>, key: string) => {
    const v = row[key];
    if (v instanceof Date) return v.getTime();
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v && typeof v === "object") return String(v); // ObjectId: hex is time-ordered
    return v ?? null;
  };
  return (a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const [key, dir] of Object.entries(sort)) {
      const x = val(a, key);
      const y = val(b, key);
      if (x === y) continue;
      if (x === null) return 1 * dir * -1; // nulls sort first ascending, like MongoDB
      if (y === null) return -1 * dir * -1;
      return (x < y ? -1 : 1) * dir;
    }
    return 0;
  };
}

const MAX_MERGE_DEPTH = 1200; // page 50 at 24/page

/**
 * Dealer stock and private ads in one sorted, paginated result. Each side is
 * queried for its first `skip + limit` rows and merged in memory, which keeps
 * this portable (no $unionWith, so it also runs on DocumentDB/Cosmos/FerretDB).
 */
async function unionSearch(f: ListingFilters, sort: Record<string, 1 | -1>, skip: number, limit: number) {
  const priv = includePrivate(f);
  const adFields = "-messages";
  if (f.seller === "private") {
    const q = privateQuery(f);
    const [rows, total] = await Promise.all([
      ClassifiedAd.find(q).sort(sort).skip(skip).limit(limit).select(adFields).lean<Doc<IClassifiedAd>[]>(),
      ClassifiedAd.countDocuments(q),
    ]);
    return { rows: rows.map((r) => ({ ...r, _src: "private" as const })), total };
  }
  const dq = dealerQuery(f);
  if (!priv) {
    const [rows, total] = await Promise.all([
      Vehicle.find(dq).sort(sort).skip(skip).limit(limit).lean<Doc<IVehicle>[]>(),
      Vehicle.countDocuments(dq),
    ]);
    return { rows: rows as AnyListing[], total };
  }
  const depth = Math.min(skip + limit, MAX_MERGE_DEPTH);
  const pq = privateQuery(f);
  const [dealer, ads, dTotal, pTotal] = await Promise.all([
    Vehicle.find(dq).sort(sort).limit(depth).lean<Doc<IVehicle>[]>(),
    ClassifiedAd.find(pq).sort(sort).limit(depth).select(adFields).lean<Doc<IClassifiedAd>[]>(),
    Vehicle.countDocuments(dq),
    ClassifiedAd.countDocuments(pq),
  ]);
  const merged = [
    ...dealer.map((r) => ({ ...r, _src: "dealer" as const })),
    ...ads.map((r) => ({ ...r, _src: "private" as const })),
  ].sort(sortCompare(sort) as (a: unknown, b: unknown) => number);
  return { rows: merged.slice(skip, skip + limit) as AnyListing[], total: dTotal + pTotal };
}

/** Min/max year and max price across what is listed (plain sorted finds: portable). */
async function listingBounds(f: ListingFilters) {
  const dq = dealerQuery({ type: f.type });
  const pq = includePrivate(f) ? privateQuery({ type: f.type }) : null;
  type Row = { year?: number; listPrice?: number } | null;
  const edge = async (field: "year" | "listPrice", dir: 1 | -1) => {
    const [d, p] = await Promise.all([
      Vehicle.findOne(dq).sort({ [field]: dir }).select(field).lean<Row>(),
      pq ? ClassifiedAd.findOne(pq).sort({ [field]: dir }).select(field).lean<Row>() : Promise.resolve(null),
    ]);
    const values = [d?.[field], p?.[field]].filter((v): v is number => typeof v === "number");
    if (!values.length) return null;
    return dir === 1 ? Math.min(...values) : Math.max(...values);
  };
  const [minYear, maxYear, maxPrice] = await Promise.all([edge("year", 1), edge("year", -1), edge("listPrice", -1)]);
  return minYear == null ? [] : [{ minYear, maxYear: maxYear ?? minYear, maxPrice: maxPrice ?? 0 }];
}

async function mergedFacet(field: string, f: ListingFilters, extra: Record<string, unknown> = {}) {
  const stage = (q: Record<string, unknown>) => [{ $match: { ...q, ...extra } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }];
  const [dealer, priv] = await Promise.all([
    Vehicle.aggregate(stage(dealerQuery({ type: f.type }))),
    includePrivate(f) ? ClassifiedAd.aggregate(stage(privateQuery({ type: f.type }))) : Promise.resolve([]),
  ]);
  const map = new Map<string, number>();
  [...dealer, ...priv].forEach((r: { _id: string; n: number }) => r._id && map.set(r._id, (map.get(r._id) || 0) + r.n));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
}

/** Adds the registered-dealer card to ads posted by approved dealerships. */
async function withBusiness<T extends PublicListing>(list: T[]): Promise<T[]> {
  const ids = list.filter((l) => l.seller.type === "private" && l.sellerId).map((l) => l.sellerId!);
  if (!ids.length) return list;
  const map = await partnerService.businessMap(ids);
  return list.map((l) => {
    const b = l.sellerId ? map.get(l.sellerId) : undefined;
    if (!b || b.type !== "dealer") return l;
    return { ...l, seller: { ...l.seller, name: b.name, business: { name: b.name, slug: b.slug, city: b.city, verified: b.verified } } };
  });
}

export const marketplaceService = {
  async hasListings() {
    const flags = await this.navFlags();
    return flags.cars || flags.bikes;
  },

  /** Which public sections have content, for the site menu. */
  async navFlags() {
    await dbConnect();
    const now = new Date();
    const [carD, bikeD, carP, bikeP, shop, settings] = await Promise.all([
      Vehicle.exists({ published: true, status: { $in: LISTABLE }, vehicleType: { $in: ["car", null] } }),
      Vehicle.exists({ published: true, status: { $in: LISTABLE }, vehicleType: "bike" }),
      ClassifiedAd.exists({ status: "active", vehicleType: "car", expiresAt: { $gt: now } }),
      ClassifiedAd.exists({ status: "active", vehicleType: "bike", expiresAt: { $gt: now } }),
      InventoryItem.exists({ "shop.published": true, salePrice: { $gt: 0 } }),
      ShopSettings.findOne({ key: "default" }).select("enabled classifiedsEnabled").lean<{ enabled?: boolean; classifiedsEnabled?: boolean }>(),
    ]);
    const dealershipInUse = Boolean(await Vehicle.exists({}));
    return {
      cars: Boolean(carD || carP),
      bikes: Boolean(bikeD || bikeP),
      shop: Boolean(shop) && settings?.enabled !== false,
      // Ads open once the dealership module is in use and the admin has not switched them off.
      classifieds: (dealershipInUse || Boolean(carP || bikeP)) && settings?.classifiedsEnabled !== false,
    };
  },

  async search(filters: ListingFilters) {
    await dbConnect();
    const page = Math.max(1, filters.page || 1);
    const sort = SORTS[filters.sort || "newest"] || SORTS.newest;
    const [{ rows, total }, branches] = await Promise.all([
      unionSearch(filters, sort, (page - 1) * PAGE_SIZE, PAGE_SIZE),
      branchMap(),
    ]);
    const insights = await insightsFor(rows);
    return {
      listings: await withBusiness(rows.map((r) => anyToPublic(r, insights, branches))),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  },

  /** Filter options with counts, drawn from what is actually listed. */
  async facets(f: ListingFilters = {}) {
    await dbConnect();
    const [makes, cities, bodies, bounds] = await Promise.all([
      mergedFacet("make", f),
      mergedFacet("city", f, { city: { $nin: [null, ""] } }),
      mergedFacet("bodyType", f, { bodyType: { $nin: [null, ""] } }),
      listingBounds(f),
    ]);
    return {
      makes,
      cities,
      bodies,
      minYear: bounds[0]?.minYear ?? new Date().getFullYear() - 20,
      maxYear: bounds[0]?.maxYear ?? new Date().getFullYear(),
      maxPrice: bounds[0]?.maxPrice ?? 0,
    };
  },

  /**
   * How many matching cars each city has (and each registration city), for
   * the "Islamabad (12) · Lahore (30)…" strip. Counted in code from a light
   * projection so it runs the same on every MongoDB-compatible store.
   */
  async cityCounts(f: ListingFilters) {
    await dbConnect();
    const rows = async (filters: ListingFilters) => {
      const fields = "city registeredIn specs.registrationCity";
      const [dealer, ads] = await Promise.all([
        f.seller === "private" ? Promise.resolve([]) : Vehicle.find(dealerQuery(filters)).select(fields).limit(10000).lean<{ city?: string; specs?: { registrationCity?: string } }[]>(),
        includePrivate(filters) ? ClassifiedAd.find(privateQuery(filters)).select(fields).limit(10000).lean<{ city?: string; registeredIn?: string; specs?: { registrationCity?: string } }[]>() : Promise.resolve([]),
      ]);
      return [...dealer, ...ads] as { city?: string; registeredIn?: string; specs?: { registrationCity?: string } }[];
    };
    const tally = (values: (string | undefined)[]) => {
      const map = new Map<string, { city: string; count: number }>();
      for (const v of values) {
        const c = v?.trim();
        if (!c) continue;
        const k = c.toLowerCase();
        const cur = map.get(k) || { city: c, count: 0 };
        cur.count++;
        map.set(k, cur);
      }
      return [...map.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
    };
    const [byCity, byReg] = await Promise.all([rows({ ...f, city: undefined, page: 1 }), rows({ ...f, regCity: undefined, page: 1 })]);
    return {
      cities: tally(byCity.map((r) => r.city)),
      regCities: tally(byReg.map((r) => r.registeredIn || r.specs?.registrationCity)),
      allCities: byCity.length,
    };
  },

  /** Several listings by id (Saved / Compare pages). No view counting; unknown ids are skipped. */
  async listingsByIds(ids: string[]) {
    await dbConnect();
    const valid = [...new Set(ids)].filter((x) => Types.ObjectId.isValid(x)).slice(0, 30);
    if (!valid.length) return [];
    const [dealer, ads, branches] = await Promise.all([
      Vehicle.find({ _id: { $in: valid }, published: true, status: { $in: LISTABLE } }).lean<Doc<IVehicle>[]>(),
      ClassifiedAd.find({ _id: { $in: valid }, status: "active", expiresAt: { $gt: new Date() } }).select("-messages").lean<Doc<IClassifiedAd>[]>(),
      branchMap(),
    ]);
    const rows: AnyListing[] = [...dealer, ...ads.map((a) => ({ ...a, _src: "private" as const }))];
    const insights = await insightsFor(rows);
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    return withBusiness(
      valid.flatMap((id) => {
        const row = byId.get(id);
        return row ? [anyToPublic(row, insights, branches)] : [];
      })
    );
  },

  /** Everything public, for the XML sitemap. */
  async sitemapEntries() {
    await dbConnect();
    const [vehicles, ads, products] = await Promise.all([
      Vehicle.find({ published: true, status: { $in: LISTABLE } }).select("vehicleType updatedAt").limit(5000).lean<{ _id: Types.ObjectId; vehicleType?: string; updatedAt: Date }[]>(),
      ClassifiedAd.find({ status: "active", expiresAt: { $gt: new Date() } }).select("vehicleType updatedAt").limit(5000).lean<{ _id: Types.ObjectId; vehicleType: string; updatedAt: Date }[]>(),
      InventoryItem.find({ "shop.published": true, salePrice: { $gt: 0 } }).select("shop.slug updatedAt").limit(5000).lean<{ shop: { slug: string }; updatedAt: Date }[]>(),
    ]);
    return {
      listings: [...vehicles, ...ads].map((v) => ({ path: `/${v.vehicleType === "bike" ? "bikes" : "cars"}/${v._id}`, updatedAt: v.updatedAt })),
      products: products.map((p) => ({ path: `/shop/${p.shop.slug}`, updatedAt: p.updatedAt })),
    };
  },

  async listing(id: string, countView = true) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Listing not found", 404);
    const dealerFilter = { _id: id, published: true, status: { $in: LISTABLE } };
    const adFilter = { _id: id, status: "active", expiresAt: { $gt: new Date() } };
    const inc = { $inc: { views: 1 } };
    let row: AnyListing | null = countView
      ? await Vehicle.findOneAndUpdate(dealerFilter, inc, { returnDocument: "after" }).lean<Doc<IVehicle>>()
      : await Vehicle.findOne(dealerFilter).lean<Doc<IVehicle>>();
    if (!row) {
      const ad = countView
        ? await ClassifiedAd.findOneAndUpdate(adFilter, inc, { returnDocument: "after" }).lean<Doc<IClassifiedAd>>()
        : await ClassifiedAd.findOne(adFilter).lean<Doc<IClassifiedAd>>();
      if (ad) {
        // Buyer messages are private to the seller; never let them reach the page.
        const { messages: _messages, ...publicAd } = ad;
        row = { ...(publicAd as Doc<IClassifiedAd>), _src: "private" };
      }
    }
    if (!row) throw new ServiceError("NOT_FOUND", "This vehicle is no longer listed", 404);
    const similarFilter: ListingFilters = { type: row.vehicleType || "car" };
    const { rows: pool } = await unionSearch({ ...similarFilter, make: row.make }, SORTS.newest, 0, 8);
    const similarRows = pool.filter((p) => String(p._id) !== String(row!._id)).slice(0, 4);
    const [insights, branches] = await Promise.all([insightsFor([row, ...similarRows]), branchMap()]);
    const [listing, ...similar] = await withBusiness([row, ...similarRows].map((r) => anyToPublic(r, insights, branches)));
    return { listing, similar };
  },

  /** "Contact dealer" on a listing → lead in the CRM (or an activity on an existing one). */
  async inquire(id: string, data: InquiryInput) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Listing not found", 404);
    const v = await Vehicle.findOne({ _id: id, published: true, status: { $in: LISTABLE } }).lean<Doc<IVehicle>>();
    if (!v) return this.messageSeller(id, data);
    const title = [v.year, v.make, v.model, v.variant].filter(Boolean).join(" ");
    const intentText: Record<InquiryInput["intent"], string> = {
      buy: "Enquired about",
      test_drive: "Requested a test drive of",
      finance: "Asked about financing for",
      offer: `Made an offer${data.offerPrice ? ` of ${data.offerPrice.toLocaleString()}` : ""} on`,
    };
    const text = `🌐 ${intentText[data.intent]} ${title} (${v.stockNo})${data.message ? `: "${data.message}"` : ""}`;
    const now = new Date();
    const existing = await DealerCustomer.findOne({ phone: data.phone });

    if (existing) {
      // Same person re-submitting the same car within 10 minutes: accept quietly.
      const recent = existing.activities
        .slice(-3)
        .some((a: { text: string; at: Date }) => a.text.includes(v.stockNo) && now.getTime() - new Date(a.at).getTime() < 600_000);
      if (recent) return { ok: true, duplicate: true };
      existing.activities.push({ type: data.intent === "test_drive" ? "test_drive" : "note", text, at: now, byName: "Website" });
      existing.lastActivityAt = now;
      existing.nextFollowUp = now;
      if (!existing.interestedVehicleId) existing.interestedVehicleId = v._id;
      if (existing.stage === "lost") existing.stage = "new";
      if (data.intent === "finance") existing.wantsFinancing = true;
      await existing.save();
    } else {
      await DealerCustomer.create({
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        source: "website",
        stage: "new",
        branchCode: v.branchCode,
        city: v.city,
        interestedVehicleId: v._id,
        wantsFinancing: data.intent === "finance",
        budgetMax: data.intent === "offer" ? data.offerPrice : undefined,
        nextFollowUp: now,
        lastActivityAt: now,
        activities: [{ type: "note", text, at: now, byName: "Website" }],
      });
    }
    await Vehicle.updateOne({ _id: v._id }, { $inc: { inquiries: 1 } });
    return { ok: true };
  },

  /** Enquiry on a private ad goes to the seller's inbox, not the dealership CRM. */
  async messageSeller(id: string, data: InquiryInput) {
    const ad = await ClassifiedAd.findOne({ _id: id, status: "active", expiresAt: { $gt: new Date() } });
    if (!ad) throw new ServiceError("NOT_FOUND", "This vehicle is no longer listed", 404);
    const now = Date.now();
    const dup = ad.messages.slice(-5).some((m: { phone: string; at: Date }) => m.phone === data.phone && now - new Date(m.at).getTime() < 600_000);
    if (dup) return { ok: true, duplicate: true };
    const intent: Record<InquiryInput["intent"], string> = {
      buy: "", test_drive: "Wants to see / test drive. ", finance: "Asked about financing. ", offer: "",
    };
    ad.messages.push({
      name: data.name,
      phone: data.phone,
      message: `${intent[data.intent]}${data.message || ""}`.trim() || undefined,
      offerPrice: data.intent === "offer" ? data.offerPrice : undefined,
      at: new Date(),
      read: false,
    });
    ad.contacts = (ad.contacts || 0) + 1;
    if (ad.messages.length > 200) ad.messages = ad.messages.slice(-200);
    await ad.save();
    return { ok: true, private: true };
  },

  /** "Sell your car" → acquisition lead carrying the car as a trade-in record. */
  async sellRequest(data: SellInput) {
    await dbConnect();
    const settings = await Settings.findOne().select("defaultBranchCode").lean<{ defaultBranchCode?: string }>();
    const now = new Date();
    const car = `${data.year} ${data.make} ${data.model}`;
    // Recomputed here (not taken from the form) so the CRM shows what we really offered.
    const condition = ({ excellent: "excellent", good: "good", fair: "fair", "needs work": "needs_work" } as const)[
      (data.condition || "good").toLowerCase() as "good"
    ] || "good";
    const offer = await offerService
      .instant({ vehicleType: "car", make: data.make, model: data.model, year: data.year, mileage: data.mileage, condition, accident: false })
      .catch(() => null);
    const offerText = offer?.ok ? ` · instant offer shown ${offer.low.toLocaleString()}–${offer.high.toLocaleString()} (market ~${offer.market.toLocaleString()})` : "";
    const text = `🌐 Wants to sell ${car}, ${data.mileage.toLocaleString()} km${data.expectedPrice ? `, asking ${data.expectedPrice.toLocaleString()}` : ""}${offerText}${data.message ? `: "${data.message}"` : ""}`;
    const tradeIn = {
      make: data.make,
      model: data.model,
      year: data.year,
      mileage: data.mileage,
      registrationNo: data.registrationNo,
      condition: data.condition,
      expectedValue: data.expectedPrice,
    };
    const existing = await DealerCustomer.findOne({ phone: data.phone });
    if (existing) {
      existing.tradeIn = tradeIn;
      existing.activities.push({ type: "note", text, at: now, byName: "Website" });
      existing.lastActivityAt = now;
      existing.nextFollowUp = now;
      if (existing.stage === "lost") existing.stage = "new";
      await existing.save();
    } else {
      await DealerCustomer.create({
        name: data.name,
        phone: data.phone,
        city: data.city,
        source: "website",
        stage: "new",
        branchCode: (settings?.defaultBranchCode || "MAIN").toUpperCase(),
        interestNotes: `Selling: ${car}`,
        tradeIn,
        nextFollowUp: now,
        lastActivityAt: now,
        activities: [{ type: "note", text, at: now, byName: "Website" }],
      });
    }
    return { ok: true };
  },
};

/** Parses a URLSearchParams-like record into typed filters. */
export function parseListingFilters(get: (key: string) => string | null | undefined): ListingFilters {
  const n = (k: string) => {
    const v = Number(get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const str = (k: string) => get(k)?.trim() || undefined;
  const type = get("type");
  const seller = get("seller");
  const explicit: ListingFilters = {
    type: type === "bike" || type === "car" ? type : undefined,
    seller: seller === "dealer" || seller === "private" ? seller : undefined,
    q: str("q"),
    make: str("make"),
    model: str("model"),
    city: str("city") === "all" ? undefined : str("city"),
    body: str("body"),
    fuel: str("fuel"),
    transmission: str("transmission"),
    condition: str("condition"),
    minPrice: n("minPrice"),
    maxPrice: n("maxPrice"),
    minYear: n("minYear"),
    maxYear: n("maxYear"),
    maxKm: n("maxKm"),
    inspected: get("inspected") === "1",
    assembly: get("assembly") === "Local" || get("assembly") === "Imported" ? (get("assembly") as "Local" | "Imported") : undefined,
    firstOwner: get("firstOwner") === "1",
    accidentFree: get("accidentFree") === "1",
    genuinePaint: get("genuinePaint") === "1",
    features: (get("feat") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10),
    regCity: str("regCity"),
    sort: str("sort"),
    page: n("page"),
  };
  const ask = str("ask")?.slice(0, 200);
  if (!ask) return explicit;
  // Explicit filter fields win over what we read from the sentence.
  const { filters: smart, understood } = parseSmartQuery(ask);
  // Model names are matched loosely ("Prado" finds "Land Cruiser Prado").
  const { model: smartModel, ...rest } = smart;
  const merged: ListingFilters = { ...rest, ...(smartModel ? { q: smartModel } : {}), ask, understood };
  for (const [k, v] of Object.entries(explicit) as [keyof ListingFilters, unknown][]) {
    if (v !== undefined && v !== false && !(Array.isArray(v) && !v.length)) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}
