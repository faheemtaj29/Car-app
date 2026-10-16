import { Schema, models, model, Types } from "mongoose";

/* ------------------------------------------------ listing history (trust) */

/**
 * One snapshot each time a vehicle is listed or its price / mileage changes.
 * Keyed by normalised chassis and registration numbers so the same car is
 * recognised when it comes back under a new ad, seller or dealer.
 */
export interface IVehicleSnapshot {
  keys: string[];
  at: Date;
  source: "dealer" | "private";
  listingId: Types.ObjectId;
  sellerKey: string;
  title: string;
  mileage: number;
  price: number;
  city?: string;
}

const VehicleSnapshotSchema = new Schema<IVehicleSnapshot>({
  keys: { type: [String], index: true },
  at: { type: Date, default: Date.now },
  source: { type: String, enum: ["dealer", "private"], required: true },
  listingId: { type: Schema.Types.ObjectId, required: true, index: true },
  sellerKey: { type: String, required: true },
  title: String,
  mileage: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  city: String,
});

export const VehicleSnapshot =
  models.VehicleSnapshot || model<IVehicleSnapshot>("VehicleSnapshot", VehicleSnapshotSchema);

/* ---------------------------------------------------------- My Garage */

export interface IServiceEntry {
  _id?: Types.ObjectId;
  date: Date;
  km: number;
  type: string;
  cost: number;
  garage?: string;
  notes?: string;
}

export interface IGarageCar {
  memberId: Types.ObjectId;
  vehicleType: "car" | "bike";
  make: string;
  model: string;
  variant?: string;
  year: number;
  engineCc?: number;
  fuel?: string;
  transmission?: string;
  color?: string;
  registrationNo?: string;
  province: string;
  /** Odometer at `kmUpdatedAt`; today's estimate adds `dailyKm` per day since. */
  km: number;
  kmUpdatedAt: Date;
  dailyKm: number;
  oilIntervalKm: number;
  lastOilKm?: number;
  serviceIntervalKm: number;
  lastServiceKm?: number;
  tokenTaxDue?: Date;
  insuranceDue?: Date;
  serviceLog: IServiceEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const ServiceEntrySchema = new Schema<IServiceEntry>({
  date: { type: Date, default: Date.now },
  km: { type: Number, min: 0, default: 0 },
  type: { type: String, required: true, trim: true },
  cost: { type: Number, min: 0, default: 0 },
  garage: String,
  notes: String,
});

const GarageCarSchema = new Schema<IGarageCar>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "MarketMember", required: true, index: true },
    vehicleType: { type: String, enum: ["car", "bike"], default: "car" },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    variant: String,
    year: { type: Number, required: true },
    engineCc: Number,
    fuel: String,
    transmission: String,
    color: String,
    registrationNo: { type: String, trim: true, uppercase: true },
    province: { type: String, default: "Punjab" },
    km: { type: Number, default: 0, min: 0 },
    kmUpdatedAt: { type: Date, default: Date.now },
    dailyKm: { type: Number, default: 30, min: 0 },
    oilIntervalKm: { type: Number, default: 5000 },
    lastOilKm: Number,
    serviceIntervalKm: { type: Number, default: 10000 },
    lastServiceKm: Number,
    tokenTaxDue: Date,
    insuranceDue: Date,
    serviceLog: { type: [ServiceEntrySchema], default: [] },
  },
  { timestamps: true }
);

export const GarageCar = models.GarageCar || model<IGarageCar>("GarageCar", GarageCarSchema);

/* ------------------------------------------- bookings (inspection, drive) */

export const BOOKING_TYPES = ["test_drive", "inspection", "video_call"] as const;
export const BOOKING_STATUSES = ["requested", "confirmed", "done", "cancelled"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface IBooking {
  number: string;
  type: BookingType;
  listingId?: Types.ObjectId;
  listingSource?: "dealer" | "private";
  listingTitle?: string;
  /** Private ad owner, so they see video-call requests in their account. */
  sellerMemberId?: Types.ObjectId;
  memberId?: Types.ObjectId;
  name: string;
  phone: string;
  date: Date;
  slot: string;
  address?: string;
  notes?: string;
  status: BookingStatus;
  /** Unique per bookable slot; rewritten when cancelled so the slot frees up. */
  slotKey: string;
  staffNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    number: { type: String, required: true, unique: true },
    type: { type: String, enum: BOOKING_TYPES, required: true },
    listingId: { type: Schema.Types.ObjectId },
    listingSource: { type: String, enum: ["dealer", "private"] },
    listingTitle: String,
    sellerMemberId: { type: Schema.Types.ObjectId, index: true },
    memberId: { type: Schema.Types.ObjectId, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    slot: { type: String, required: true },
    address: String,
    notes: String,
    status: { type: String, enum: BOOKING_STATUSES, default: "requested" },
    slotKey: { type: String, required: true, unique: true },
    staffNote: String,
  },
  { timestamps: true }
);
BookingSchema.index({ date: 1, status: 1 });

export const Booking = models.Booking || model<IBooking>("Booking", BookingSchema);

/* ------------------------------------------------------------- reviews */

export interface IReview {
  /** "dealer" = the showroom; "member" = a private seller. */
  targetType: "dealer" | "member";
  targetId: string;
  memberId: Types.ObjectId;
  memberName: string;
  rating: number;
  comment?: string;
  status: "visible" | "hidden";
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    targetType: { type: String, enum: ["dealer", "member"], required: true },
    targetId: { type: String, required: true },
    memberId: { type: Schema.Types.ObjectId, required: true },
    memberName: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1000 },
    status: { type: String, enum: ["visible", "hidden"], default: "visible" },
  },
  { timestamps: true }
);
ReviewSchema.index({ targetType: 1, targetId: 1, memberId: 1 }, { unique: true });

export const Review = models.Review || model<IReview>("Review", ReviewSchema);

/* ------------------------------------------------- saved searches / alerts */

export interface IAlert {
  memberId: Types.ObjectId;
  kind: "search" | "price";
  label: string;
  /** Search: the /cars query string. Price watch: the listing id. */
  query?: string;
  listingId?: string;
  /** Price when the watch was set (price watch). */
  basePrice?: number;
  lastSeenAt: Date;
  active: boolean;
  createdAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    memberId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ["search", "price"], required: true },
    label: { type: String, required: true },
    query: String,
    listingId: String,
    basePrice: Number,
    lastSeenAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Alert = models.Alert || model<IAlert>("Alert", AlertSchema);

/* ----------------------------------------------------- safe token money */

export const TOKEN_STATUSES = ["requested", "verified", "applied", "refunded", "cancelled"] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

/**
 * Buyer's token (advance) to hold a dealer car. The money goes to the
 * showroom's own account; when staff verify it arrived, a deal is opened with
 * the token as its first payment, which reserves the car and books the
 * receipt as a customer deposit. Refunding cancels that deal (reversing it).
 */
export interface ITokenRequest {
  number: string;
  vehicleId: Types.ObjectId;
  vehicleTitle: string;
  memberId?: Types.ObjectId;
  name: string;
  phone: string;
  cnicLast4?: string;
  amount: number;
  method: "bank_transfer" | "jazzcash" | "easypaisa" | "cash";
  reference: string;
  status: TokenStatus;
  holdUntil?: Date;
  verifiedAt?: Date;
  closedAt?: Date;
  staffNote?: string;
  /** Deal created when staff verified the money; the token is its first payment. */
  dealId?: Types.ObjectId;
  dealNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TokenRequestSchema = new Schema<ITokenRequest>(
  {
    number: { type: String, required: true, unique: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    vehicleTitle: String,
    memberId: Schema.Types.ObjectId,
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    cnicLast4: String,
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["bank_transfer", "jazzcash", "easypaisa", "cash"], required: true },
    reference: { type: String, required: true, trim: true },
    status: { type: String, enum: TOKEN_STATUSES, default: "requested" },
    holdUntil: Date,
    verifiedAt: Date,
    closedAt: Date,
    staffNote: String,
    dealId: { type: Schema.Types.ObjectId, ref: "DealerDeal" },
    dealNumber: String,
  },
  { timestamps: true }
);

export const TokenRequest = models.TokenRequest || model<ITokenRequest>("TokenRequest", TokenRequestSchema);
