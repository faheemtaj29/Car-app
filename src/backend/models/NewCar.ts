import { Schema, model, models, Types } from "mongoose";

export interface INewCarVariant {
  name: string;        // e.g. "1.8 GLi Manual"
  engineCc?: number;
  transmission?: "Manual" | "Automatic" | "CVT";
  fuel?: string;
  price: number;       // ex-factory PKR
  features?: string[];
}

export interface INewCarQuote {
  name: string;
  phone: string;
  city: string;
  variant?: string;
  message?: string;
  createdAt: Date;
  status: "new" | "contacted" | "closed";
}

export interface INewCar {
  vehicleType: "car" | "bike";
  make: string;
  model: string;
  year: number;
  bodyType?: string;
  fuel?: string;
  engineCc?: number;
  color?: string[];
  photos: string[];
  variants: INewCarVariant[];
  specs?: Record<string, string | number | boolean>;
  features?: string[];
  brochureUrl?: string;
  published: boolean;
  sortOrder: number;
  quotes: INewCarQuote[];
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<INewCarVariant>({
  name: { type: String, required: true },
  engineCc: Number,
  transmission: { type: String, enum: ["Manual", "Automatic", "CVT"] },
  fuel: String,
  price: { type: Number, required: true },
  features: [String],
}, { _id: true });

const quoteSchema = new Schema<INewCarQuote>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  variant: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
}, { _id: true });

const newCarSchema = new Schema<INewCar>({
  vehicleType: { type: String, enum: ["car", "bike"], required: true, default: "car" },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  bodyType: String,
  fuel: String,
  engineCc: Number,
  color: [String],
  photos: [String],
  variants: { type: [variantSchema], default: [] },
  specs: { type: Schema.Types.Mixed, default: {} },
  features: [String],
  brochureUrl: String,
  published: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  quotes: { type: [quoteSchema], default: [] },
}, { timestamps: true });

newCarSchema.index({ vehicleType: 1, make: 1, published: 1 });
newCarSchema.index({ make: 1, model: 1, year: -1 });

export const NewCar = models.NewCar || model<INewCar>("NewCar", newCarSchema);
