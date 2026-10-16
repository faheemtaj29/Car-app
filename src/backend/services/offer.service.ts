/**
 * Instant offer for sellers: a price range worked out in seconds from what
 * comparable cars listed and sold for here. The firm offer follows a free
 * inspection, so the range is clearly labelled "subject to inspection".
 */
import type { z } from "zod";
import { dbConnect } from "@/backend/config/database";
import { DealerDeal, Vehicle, type IDealerDeal, type IVehicle } from "@/backend/models/Dealership";
import { ClassifiedAd, type IClassifiedAd } from "@/backend/models/Marketplace";
import { priceInsight } from "@/lib/dealership";
import type { instantOfferSchema } from "@/backend/validators/engagement.validator";

type OfferInput = z.infer<typeof instantOfferSchema>;

const CONDITION_FACTOR: Record<OfferInput["condition"], number> = { excellent: 1, good: 0.97, fair: 0.91, needs_work: 0.82 };
/** Dealer buys below market to cover reconditioning, holding cost and margin. */
const BUY_LOW = 0.86;
const BUY_HIGH = 0.92;

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (x: string) => new RegExp(`^${esc(x.trim())}$`, "i");

export type InstantOffer =
  | { ok: true; market: number; low: number; high: number; comps: number; confidence: "high" | "medium" }
  | { ok: false; comps: number; reason: string };

export const offerService = {
  async instant(input: OfferInput): Promise<InstantOffer> {
    await dbConnect();
    const near = { $gte: input.year - 3, $lte: input.year + 3 };
    const [stock, ads] = await Promise.all([
      Vehicle.find({ make: exact(input.make), model: exact(input.model), year: near, listPrice: { $gt: 0 } })
        .select("year mileage listPrice dealId status")
        .limit(300)
        .lean<(IVehicle & { _id: unknown })[]>(),
      ClassifiedAd.find({ make: exact(input.make), model: exact(input.model), year: near, status: { $in: ["active", "sold"] } })
        .select("year mileage listPrice")
        .limit(300)
        .lean<IClassifiedAd[]>(),
    ]);
    const deals = await DealerDeal.find({ _id: { $in: stock.filter((s) => s.dealId).map((s) => s.dealId) }, status: "delivered" })
      .select("salePrice discount")
      .lean<(IDealerDeal & { _id: unknown })[]>();
    const sold = new Map(deals.map((d) => [String(d._id), d.salePrice - d.discount]));
    const comps = [
      ...stock.map((v) => ({ year: v.year, mileage: v.mileage || 0, price: (v.dealId && sold.get(String(v.dealId))) || v.listPrice })),
      ...ads.map((a) => ({ year: a.year, mileage: a.mileage || 0, price: a.listPrice })),
    ];
    const insight = priceInsight({ year: input.year, mileage: input.mileage, price: 0 }, comps);
    if (!insight) {
      return { ok: false, comps: comps.length, reason: "We don't have enough similar cars yet to price this one instantly. Book a free inspection for a firm offer." };
    }
    const factor = CONDITION_FACTOR[input.condition] * (input.accident ? 0.9 : 1);
    const round = (n: number) => Math.round(n / 5000) * 5000;
    return {
      ok: true,
      market: insight.fairPrice,
      low: round(insight.fairPrice * factor * BUY_LOW),
      high: round(insight.fairPrice * factor * BUY_HIGH),
      comps: insight.comps,
      confidence: insight.comps >= 8 ? "high" : "medium",
    };
  },
};
