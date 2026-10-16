/**
 * Listing history: every time a car is listed (or its price / mileage
 * changes) we keep a snapshot keyed by chassis + registration. Buyers then
 * see how often the car was listed here, its past prices, and a warning when
 * the odometer reads lower than it did before (possible meter tampering).
 */
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { VehicleSnapshot, type IVehicleSnapshot } from "@/backend/models/Engagement";
import { identityKeys } from "@/lib/vehicleSpecs";

type Listable = {
  _id: Types.ObjectId | string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage?: number;
  listPrice?: number;
  city?: string;
  registrationNo?: string;
  vin?: string;
  chassisNo?: string;
  branchCode?: string;
  memberId?: Types.ObjectId | string;
};

/** Mileage may drop by this much between listings (typos, rounding) before we warn. */
const TAMPER_TOLERANCE_KM = 1000;

export type HistoryReport = {
  identified: boolean;
  timesListed: number;
  sellers: number;
  firstSeen?: string;
  events: { at: string; source: "dealer" | "private"; mileage: number; price: number; city?: string; thisListing: boolean }[];
  mileageWarning: null | { earlierKm: number; earlierAt: string; laterKm: number; laterAt: string };
  priceChanges: { at: string; price: number }[];
};

export const historyService = {
  /** Adds a snapshot unless the latest one for this listing already matches. Never throws. */
  async record(v: Listable, source: "dealer" | "private") {
    try {
      await dbConnect();
      const keys = identityKeys(v);
      const listingId = new Types.ObjectId(String(v._id));
      const last = await VehicleSnapshot.findOne({ listingId }).sort({ at: -1 }).lean<IVehicleSnapshot>();
      const mileage = v.mileage || 0;
      const price = v.listPrice || 0;
      if (last && last.mileage === mileage && last.price === price && last.keys.join() === keys.join()) return;
      await VehicleSnapshot.create({
        keys,
        source,
        listingId,
        sellerKey: source === "dealer" ? `dealer:${v.branchCode || ""}` : `member:${v.memberId}`,
        title: [v.year, v.make, v.model, v.variant].filter(Boolean).join(" "),
        mileage,
        price,
        city: v.city,
      });
    } catch (e) {
      console.error("history snapshot failed", e);
    }
  },

  async report(listingId: string): Promise<HistoryReport> {
    await dbConnect();
    const own = await VehicleSnapshot.find({ listingId: new Types.ObjectId(listingId) }).sort({ at: 1 }).lean<IVehicleSnapshot[]>();
    const keys = [...new Set(own.flatMap((s) => s.keys))];
    const all = keys.length
      ? await VehicleSnapshot.find({ keys: { $in: keys } }).sort({ at: 1 }).limit(500).lean<IVehicleSnapshot[]>()
      : own;
    const iso = (d: Date) => new Date(d).toISOString();

    // Odometer must not go backwards across time. Compare each reading to the
    // highest one seen before it.
    let maxSoFar: IVehicleSnapshot | null = null;
    let warning: HistoryReport["mileageWarning"] = null;
    for (const s of all) {
      if (maxSoFar && s.mileage + TAMPER_TOLERANCE_KM < maxSoFar.mileage && !warning) {
        warning = { earlierKm: maxSoFar.mileage, earlierAt: iso(maxSoFar.at), laterKm: s.mileage, laterAt: iso(s.at) };
      }
      if (!maxSoFar || s.mileage > maxSoFar.mileage) maxSoFar = s;
    }

    const priceChanges: HistoryReport["priceChanges"] = [];
    for (const s of own) {
      if (!priceChanges.length || priceChanges[priceChanges.length - 1].price !== s.price) {
        priceChanges.push({ at: iso(s.at), price: s.price });
      }
    }

    return {
      identified: keys.length > 0,
      timesListed: new Set(all.map((s) => String(s.listingId))).size,
      sellers: new Set(all.map((s) => s.sellerKey)).size,
      firstSeen: all[0] ? iso(all[0].at) : undefined,
      events: all.map((s) => ({
        at: iso(s.at),
        source: s.source,
        mileage: s.mileage,
        price: s.price,
        city: s.city,
        thisListing: String(s.listingId) === listingId,
      })),
      mileageWarning: warning,
      priceChanges,
    };
  },
};

/** Price-cut bookkeeping shared by dealer stock and private ads. */
export function nextPriceDrop(
  oldPrice: number | undefined,
  newPrice: number | undefined,
  current?: { from: number; at: Date } | null
): { from: number; at: Date } | undefined {
  if (oldPrice && newPrice && newPrice < oldPrice) {
    // Keep the original "from" while the price keeps falling, so the badge shows the full cut.
    const recent = current && Date.now() - new Date(current.at).getTime() < 30 * 86_400_000;
    return { from: recent ? Math.max(current!.from, oldPrice) : oldPrice, at: new Date() };
  }
  if (oldPrice && newPrice && newPrice > oldPrice) return undefined;
  return current || undefined;
}
