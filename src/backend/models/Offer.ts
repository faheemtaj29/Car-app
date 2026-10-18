import { Schema, Types, models, model } from "mongoose";

export const OFFER_STATUSES = ["pending", "countered", "accepted", "declined", "expired"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface IOffer {
  listingId: Types.ObjectId;
  listingSource: "dealer" | "private";
  listingTitle: string;
  listingPrice: number;
  /** Buyer (MarketMember) */
  buyerId: Types.ObjectId;
  buyerName: string;
  buyerPhone: string;
  /** Seller (MarketMember, for private ads only) */
  sellerMemberId?: Types.ObjectId;
  /** Amounts: thread of [initial, counter, counter…]. Last entry is the live offer. */
  amounts: { amount: number; by: "buyer" | "seller"; note?: string; at: Date }[];
  status: OfferStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadEntrySchema = new Schema<IOffer["amounts"][0]>(
  { amount: { type: Number, required: true }, by: { type: String, enum: ["buyer", "seller"], required: true }, note: String, at: { type: Date, default: Date.now } },
  { _id: false }
);

const OfferSchema = new Schema<IOffer>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true, index: true },
    listingSource: { type: String, enum: ["dealer", "private"], required: true },
    listingTitle: { type: String, required: true },
    listingPrice: { type: Number, required: true },
    buyerId: { type: Schema.Types.ObjectId, required: true, index: true },
    buyerName: { type: String, required: true },
    buyerPhone: { type: String, required: true },
    sellerMemberId: { type: Schema.Types.ObjectId },
    amounts: { type: [ThreadEntrySchema], default: [] },
    status: { type: String, enum: OFFER_STATUSES, default: "pending", index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
OfferSchema.index({ buyerId: 1, status: 1, updatedAt: -1 });
OfferSchema.index({ sellerMemberId: 1, status: 1, updatedAt: -1 });
OfferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "offer_ttl" }); // auto-remove expired

export const Offer = models.Offer || model<IOffer>("Offer", OfferSchema);
