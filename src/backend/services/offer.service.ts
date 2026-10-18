/**
 * Price offer & negotiation thread.
 * Buyer makes an offer; dealer/seller counters, accepts or declines.
 * Notifications fire on each move (fire-and-forget).
 */
import { dbConnect } from "@/backend/config/database";
import { Offer, type IOffer } from "@/backend/models/Offer";
import { Vehicle } from "@/backend/models/Dealership";
import { ClassifiedAd, MarketMember } from "@/backend/models/Marketplace";
import { ServiceError, type Doc } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { notifyService } from "@/backend/lib/notify";
import { siteUrl } from "@/lib/site";

const OFFER_DAYS = 3;  // expires after 3 days with no action

type OfferInput = { listingId: string; amount: number; note?: string };
type ActInput = { action: "counter" | "accept" | "decline"; amount?: number; note?: string };

async function resolveListingPrice(listingId: string): Promise<{ title: string; price: number; source: "dealer" | "private"; sellerMemberId?: string } | null> {
  const [v, a] = await Promise.all([
    Vehicle.findById(listingId).select("make model year listPrice published").lean<Doc<{ make: string; model: string; year: number; listPrice: number; published: boolean }>>(),
    ClassifiedAd.findById(listingId).select("make model year listPrice status memberId").lean<Doc<{ make: string; model: string; year: number; listPrice: number; status: string; memberId: string }>>(),
  ]);
  if (v?.published) return { title: `${v.year} ${v.make} ${v.model}`, price: v.listPrice, source: "dealer" };
  if (a?.status === "active") return { title: `${a.year} ${a.make} ${a.model}`, price: a.listPrice, source: "private", sellerMemberId: String(a.memberId) };
  return null;
}

export const offerService = {
  async make(member: MemberSession, input: OfferInput) {
    await dbConnect();
    const listing = await resolveListingPrice(input.listingId);
    if (!listing) throw new ServiceError("NOT_FOUND", "Listing not found or no longer active", 404);
    if (input.amount <= 0) throw new ServiceError("VALIDATION", "Offer amount must be positive", 400);
    if (input.amount >= listing.price) throw new ServiceError("VALIDATION", "Offer cannot be equal to or more than the listed price — just buy it!", 400);
    // One open offer per buyer per listing
    const existing = await Offer.findOne({ listingId: input.listingId, buyerId: member.id, status: { $in: ["pending", "countered"] } });
    if (existing) throw new ServiceError("CONFLICT", "You already have an open offer on this listing", 409);
    const buyer = await MarketMember.findById(member.id).select("name phone").lean<{ name: string; phone: string }>();
    if (!buyer) throw new ServiceError("NOT_FOUND", "Your account was not found", 404);
    const expires = new Date(Date.now() + OFFER_DAYS * 86_400_000);
    const offer = await Offer.create({
      listingId: input.listingId,
      listingSource: listing.source,
      listingTitle: listing.title,
      listingPrice: listing.price,
      buyerId: member.id,
      buyerName: buyer.name,
      buyerPhone: buyer.phone,
      sellerMemberId: listing.sellerMemberId || undefined,
      amounts: [{ amount: input.amount, by: "buyer", note: input.note, at: new Date() }],
      status: "pending",
      expiresAt: expires,
    });
    // Notify seller (private) or staff (dealer)
    if (listing.sellerMemberId) {
      const seller = await MarketMember.findById(listing.sellerMemberId).select("phone").lean<{ phone: string }>();
      if (seller) notifyService.send({ event: "offer_received", to: seller.phone, vars: { title: listing.title, amount: input.amount.toLocaleString(), buyerName: buyer.name, link: `${siteUrl()}/account#offers` } });
    }
    return offer.toObject();
  },

  async mine(member: MemberSession) {
    await dbConnect();
    const [asBuyer, asSeller] = await Promise.all([
      Offer.find({ buyerId: member.id }).sort({ updatedAt: -1 }).limit(50).lean<Doc<IOffer>[]>(),
      Offer.find({ sellerMemberId: member.id, status: { $in: ["pending", "countered"] } }).sort({ updatedAt: -1 }).limit(50).lean<Doc<IOffer>[]>(),
    ]);
    return { asBuyer, asSeller };
  },

  async act(member: MemberSession, offerId: string, input: ActInput) {
    await dbConnect();
    const offer = await Offer.findById(offerId);
    if (!offer) throw new ServiceError("NOT_FOUND", "Offer not found", 404);
    const isBuyer = String(offer.buyerId) === member.id;
    const isSeller = offer.sellerMemberId ? String(offer.sellerMemberId) === member.id : false;
    if (!isBuyer && !isSeller) throw new ServiceError("FORBIDDEN", "Not your offer", 403);
    if (!["pending", "countered"].includes(offer.status)) throw new ServiceError("CONFLICT", `A ${offer.status} offer cannot be changed`, 409);
    const base = siteUrl();
    const link = `${base}/account#offers`;

    if (input.action === "accept") {
      if (isBuyer && offer.status !== "countered") throw new ServiceError("CONFLICT", "Nothing to accept yet", 409);
      offer.status = "accepted";
      const last = offer.amounts[offer.amounts.length - 1];
      if (isBuyer) {
        // Buyer accepts seller's counter
        notifyService.send({ event: "offer_accepted", to: offer.buyerPhone, name: offer.buyerName, vars: { title: offer.listingTitle, amount: last.amount.toLocaleString(), link } });
        if (offer.sellerMemberId) {
          const seller = await MarketMember.findById(offer.sellerMemberId).select("phone").lean<{ phone: string }>();
          if (seller) notifyService.send({ event: "offer_accepted", to: seller.phone, vars: { title: offer.listingTitle, amount: last.amount.toLocaleString(), link } });
        }
      } else {
        // Seller accepts buyer's offer
        notifyService.send({ event: "offer_accepted", to: offer.buyerPhone, name: offer.buyerName, vars: { title: offer.listingTitle, amount: last.amount.toLocaleString(), link } });
      }
    } else if (input.action === "decline") {
      offer.status = "declined";
      if (isSeller) {
        notifyService.send({ event: "offer_declined", to: offer.buyerPhone, name: offer.buyerName, vars: { title: offer.listingTitle, link } });
      }
    } else if (input.action === "counter") {
      if (!input.amount || input.amount <= 0) throw new ServiceError("VALIDATION", "Counter amount required", 400);
      offer.amounts.push({ amount: input.amount, by: isBuyer ? "buyer" : "seller", note: input.note, at: new Date() });
      offer.status = "countered";
      offer.expiresAt = new Date(Date.now() + OFFER_DAYS * 86_400_000);
      if (isSeller) {
        notifyService.send({ event: "offer_countered", to: offer.buyerPhone, name: offer.buyerName, vars: { title: offer.listingTitle, amount: input.amount.toLocaleString(), link } });
      }
    }
    await offer.save();
    return offer.toObject();
  },

  /** Staff: all open offers for a listing. */
  async forListing(listingId: string) {
    await dbConnect();
    return Offer.find({ listingId, status: { $in: ["pending", "countered"] } }).sort({ updatedAt: -1 }).lean<Doc<IOffer>[]>();
  },

  /** Quick AI-driven instant offer estimate — used by the car detail page. */
  async instant(v: { vehicleType?: string; make: string; model: string; year: number; mileage: number; condition: string; accident: boolean }): Promise<InstantOffer | null> {
    try {
      const { estimatePrice } = await import("@/backend/lib/ai");
      const cond = (v.condition === "new" ? "new" : "used") as "new" | "used";
      const est = await estimatePrice({ vehicleType: (v.vehicleType as "car" | "bike") || "car", make: v.make, model: v.model, year: v.year, mileage: v.mileage, condition: cond, city: "" });
      if (!est) return null;
      return { ok: true, low: est.low, high: est.high, market: est.mid };
    } catch { return null; }
  },
};

export type InstantOffer = { ok: true; low: number; high: number; market: number; comps?: number; reason?: string };
