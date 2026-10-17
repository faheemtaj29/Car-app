import { Schema, models, model, Types } from "mongoose";
import { PART_CATEGORIES } from "@/lib/catalog";

/** Which vehicles a part fits. Empty model = every model of that make. */
export interface IFitment {
  make: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
}

export const FitmentSchema = new Schema<IFitment>(
  {
    make: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    yearFrom: Number,
    yearTo: Number,
  },
  { _id: false }
);

export interface IPartMessage {
  _id?: Types.ObjectId;
  name: string;
  phone: string;
  message?: string;
  at: Date;
  read: boolean;
}

/** A part or accessory listed by a registered supplier (buyers contact the supplier). */
export interface ISupplierProduct {
  supplierId: Types.ObjectId;
  title: string;
  brand?: string;
  category: string;
  kind: "car" | "bike" | "both";
  condition: "new" | "used" | "refurbished";
  price: number;
  compareAtPrice?: number;
  description?: string;
  images: string[];
  universal: boolean;
  fitments: IFitment[];
  /** Flat match keys for "parts for my car" (lib/fitment.fitmentKeys). */
  fitKeys: string[];
  inStock: boolean;
  delivery: boolean;
  partNumber?: string;
  city?: string;
  status: "active" | "hidden" | "removed";
  staffNote?: string;
  views: number;
  contacts: number;
  messages: IPartMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const PartMessageSchema = new Schema<IPartMessage>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  message: String,
  at: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

const SupplierProductSchema = new Schema<ISupplierProduct>(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "MarketMember", required: true, index: true },
    title: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, enum: PART_CATEGORIES, required: true },
    kind: { type: String, enum: ["car", "bike", "both"], default: "car" },
    condition: { type: String, enum: ["new", "used", "refurbished"], default: "new" },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: Number,
    description: String,
    images: { type: [String], default: [] },
    universal: { type: Boolean, default: false },
    fitments: { type: [FitmentSchema], default: [] },
    fitKeys: { type: [String], default: [], index: true },
    inStock: { type: Boolean, default: true },
    delivery: { type: Boolean, default: false },
    partNumber: { type: String, trim: true },
    city: String,
    status: { type: String, enum: ["active", "hidden", "removed"], default: "active" },
    staffNote: String,
    views: { type: Number, default: 0 },
    contacts: { type: Number, default: 0 },
    messages: { type: [PartMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const SupplierProduct = models.SupplierProduct || model<ISupplierProduct>("SupplierProduct", SupplierProductSchema);
