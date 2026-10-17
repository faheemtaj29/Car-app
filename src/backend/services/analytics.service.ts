/**
 * Business analytics: growth, demand and money for the last N days.
 * Everything is read with plain finds and summed in code, so it runs the same
 * on any MongoDB-compatible store.
 */
import { dbConnect } from "@/backend/config/database";
import { SearchLog } from "@/backend/models/SearchLog";
import { ClassifiedAd, MarketMember, ShopOrder } from "@/backend/models/Marketplace";
import { Booking, TokenRequest } from "@/backend/models/Engagement";
import { SupplierProduct } from "@/backend/models/Partners";
import { DealerCustomer, Vehicle } from "@/backend/models/Dealership";

export const RANGES = [7, 30, 90] as const;

type Dated = { createdAt: Date };
const dayKey = (d: Date) => new Date(d).toISOString().slice(0, 10);

function tally<T>(rows: T[], key: (r: T) => string | undefined, limit = 8) {
  const map = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    const label = key(r)?.trim();
    if (!label) continue;
    const k = label.toLowerCase();
    const cur = map.get(k) || { label, count: 0 };
    cur.count++;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

export const analyticsService = {
  async report(daysIn: number) {
    await dbConnect();
    const days = (RANGES as readonly number[]).includes(daysIn) ? daysIn : 30;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const inRange = { $gte: since };

    const [members, ads, leads, bookings, tokens, orders, partMsgs, searches, activeAds, dealerStock, pendAds, pendKyc, pendBiz, pendTok, pendBook] = await Promise.all([
      MarketMember.find({ createdAt: inRange }).select("createdAt accountType").lean<(Dated & { accountType: string })[]>(),
      ClassifiedAd.find({ createdAt: inRange }).select("createdAt").lean<Dated[]>(),
      DealerCustomer.find({ createdAt: inRange }).select("createdAt source").lean<(Dated & { source: string })[]>(),
      Booking.find({ createdAt: inRange }).select("createdAt type status").lean<(Dated & { type: string; status: string })[]>(),
      TokenRequest.find({ createdAt: inRange }).select("createdAt amount status verifiedAt").lean<(Dated & { amount: number; status: string; verifiedAt?: Date })[]>(),
      ShopOrder.find({ createdAt: inRange }).select("createdAt total status").lean<(Dated & { total: number; status: string })[]>(),
      SupplierProduct.find({ "messages.at": inRange }).select("messages.at").lean<{ messages: { at: Date }[] }[]>(),
      SearchLog.find({ at: inRange }).select("at kind make model city results").lean<{ at: Date; kind: string; make?: string; model?: string; city?: string; results: number }[]>(),
      ClassifiedAd.find({ status: "active" }).select("make model city views contacts vehicleType year").lean<{ _id: unknown; make: string; model: string; city: string; views: number; contacts: number; vehicleType: string; year: number }[]>(),
      Vehicle.find({ published: true, status: { $ne: "sold" } }).select("make model city views vehicleType year").lean<{ _id: unknown; make: string; model: string; city?: string; views: number; vehicleType: string; year: number }[]>(),
      ClassifiedAd.countDocuments({ status: "pending" }),
      MarketMember.countDocuments({ "kyc.status": "pending" }),
      MarketMember.countDocuments({ "business.status": "pending" }),
      TokenRequest.countDocuments({ status: "requested" }),
      Booking.countDocuments({ status: "requested" }),
    ]);

    const partEnquiries = partMsgs.reduce((n, p) => n + p.messages.filter((m) => new Date(m.at) >= since).length, 0);
    const paidOrders = orders.filter((o) => o.status !== "cancelled");
    const verified = tokens.filter((t) => ["verified", "applied"].includes(t.status));

    // Daily trend: new members, new ads, enquiries (leads + bookings).
    const trend = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      return { day: dayKey(d), members: 0, ads: 0, enquiries: 0 };
    });
    const idx = new Map(trend.map((t, i) => [t.day, i]));
    const bump = (rows: Dated[], field: "members" | "ads" | "enquiries") => {
      for (const r of rows) {
        const i = idx.get(dayKey(r.createdAt));
        if (i !== undefined) trend[i][field]++;
      }
    };
    bump(members, "members");
    bump(ads, "ads");
    bump(leads, "enquiries");
    bump(bookings, "enquiries");

    // Demand vs supply by city: searched often, few cars listed.
    const supplyByCity = new Map<string, number>();
    for (const v of [...activeAds, ...dealerStock]) {
      const c = v.city?.trim().toLowerCase();
      if (c) supplyByCity.set(c, (supplyByCity.get(c) || 0) + 1);
    }
    const vehicleSearches = searches.filter((s) => s.kind !== "part");
    const demand = tally(vehicleSearches, (s) => s.city, 12).map((c) => ({ city: c.label, searches: c.count, listings: supplyByCity.get(c.label.toLowerCase()) || 0 }));
    const gaps = demand.filter((d) => d.searches >= 1).map((d) => ({ ...d, ratio: d.searches / Math.max(d.listings, 1) })).sort((a, b) => b.ratio - a.ratio).slice(0, 6);

    const noResult = tally(searches.filter((s) => s.results === 0 && (s.make || s.model)), (s) => [s.make, s.model].filter(Boolean).join(" "), 6);

    const popular = [...activeAds.map((a) => ({ ...a, src: "ad" })), ...dealerStock.map((v) => ({ ...v, contacts: 0, src: "dealer" }))]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((a) => ({ id: String(a._id), title: `${a.year} ${a.make} ${a.model}`, city: a.city || "", views: a.views, contacts: a.contacts }));

    return {
      days,
      totals: {
        newMembers: members.length,
        newAds: ads.length,
        leads: leads.length,
        bookings: bookings.length,
        partEnquiries,
        searches: searches.length,
        tokensVerified: verified.length,
        tokenAmount: verified.reduce((n, t) => n + t.amount, 0),
        shopOrders: paidOrders.length,
        shopRevenue: paidOrders.reduce((n, o) => n + o.total, 0),
        dealers: members.filter((m) => m.accountType === "dealer").length,
        suppliers: members.filter((m) => m.accountType === "supplier").length,
      },
      waiting: { ads: pendAds, identities: pendKyc, businesses: pendBiz, tokens: pendTok, bookings: pendBook },
      trend,
      topMakes: tally(vehicleSearches, (s) => s.make, 6),
      topModels: tally(vehicleSearches, (s) => [s.make, s.model].filter(Boolean).join(" "), 6),
      topParts: tally(searches.filter((s) => s.kind === "part"), (s) => [s.make, s.model].filter(Boolean).join(" "), 6),
      leadSources: tally(leads, (l) => l.source, 6),
      demand,
      gaps,
      noResult,
      popular,
    };
  },

  /** Fire-and-forget: a failed log must never break a search page. */
  log(entry: { kind: "car" | "bike" | "part"; make?: string; model?: string; city?: string; results: number }) {
    if (!entry.make && !entry.model) return;
    dbConnect()
      .then(() => SearchLog.create({ ...entry, at: new Date() }))
      .catch(() => undefined);
  },
};
