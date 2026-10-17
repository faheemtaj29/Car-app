import { Schema, models, model, Types } from "mongoose";
import { AD_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, type AdStatus, type OrderStatus, type PaymentMethod } from "@/lib/shop";

/* ------------------------------------------------- public member accounts */

export const ACCOUNT_TYPES = ["individual", "dealer", "supplier"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const KYC_STATUSES = ["none", "pending", "verified", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];
export const BUSINESS_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/**
 * Identity record kept for legal and fraud-prevention purposes only. Never
 * sent to the public site: the CNIC number is encrypted and only admins can
 * read it (each view is audit-logged). No copy of the ID card is collected.
 */
export interface IKyc {
  status: KycStatus;
  legalName?: string;
  cnicEnc?: string;
  cnicHash?: string;
  cnicLast4?: string;
  address?: string;
  city?: string;
  consentAt?: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNote?: string;
  /** Result of the NADRA check, when that integration is switched on (lib/nadra). */
  nadra?: { status: string; reference?: string; message?: string; checkedAt: Date };
}

/** Public profile of a dealership or parts supplier that registered on the site. */
export interface IBusiness {
  name: string;
  slug: string;
  status: BusinessStatus;
  ntn?: string;
  address: string;
  city: string;
  phone: string;
  whatsapp?: string;
  about?: string;
  categories?: string[];
  /** Certificate of registration, issued on approval (CR-YYYY-NNNNN). */
  certNo?: string;
  certIssuedAt?: Date;
  certDownloadedAt?: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewNote?: string;
}


/** Buyers / private sellers on the public site. Kept apart from staff `User`s. */
export interface IMarketMember {
  name: string;
  phone: string;           // normalised (03001234567), unique
  email?: string;
  city?: string;
  passwordHash: string;
  status: "active" | "blocked";
  lastLoginAt?: Date;
  failedLogins: number;
  lockedUntil?: Date;
  /** Staff checked the seller's CNIC in person. */
  idVerified?: boolean;
  idVerifiedAt?: Date;
  accountType: AccountType;
  kyc?: IKyc;
  business?: IBusiness;
  createdAt: Date;
  updatedAt: Date;
}

const MarketMemberSchema = new Schema<IMarketMember>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    lastLoginAt: Date,
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    idVerified: { type: Boolean, default: false },
    idVerifiedAt: Date,
    accountType: { type: String, enum: ACCOUNT_TYPES, default: "individual" },
    kyc: {
      status: { type: String, enum: KYC_STATUSES, default: "none" },
      legalName: String,
      cnicEnc: { type: String, select: false },
      cnicHash: { type: String, index: true },
      cnicLast4: String,
      address: { type: String, select: false },
      city: String,
      consentAt: Date,
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: String,
      reviewNote: String,
      nadra: { status: String, reference: String, message: String, checkedAt: Date },
    },
    business: {
      name: String,
      slug: { type: String, index: true },
      status: { type: String, enum: BUSINESS_STATUSES },
      ntn: String,
      address: String,
      city: String,
      phone: String,
      whatsapp: String,
      about: String,
      categories: { type: [String], default: undefined },
      certNo: { type: String, index: true },
      certIssuedAt: Date,
      certDownloadedAt: Date,
      submittedAt: Date,
      reviewedAt: Date,
      reviewNote: String,
    },
  },
  { timestamps: true }
);

export const MarketMember =
  models.MarketMember || model<IMarketMember>("MarketMember", MarketMemberSchema);

/* ------------------------------------------------------- classified ads */

export interface IAdMessage {
  _id?: Types.ObjectId;
  name: string;
  phone: string;
  message?: string;
  offerPrice?: number;
  at: Date;
  read: boolean;
}

/**
 * Private-seller vehicle ad. Field names deliberately mirror `Vehicle`
 * (make, model, year, mileage, listPrice, photos, publishedAt…) so the public
 * search can union both collections with one filter.
 */
export interface IClassifiedAd {
  memberId: Types.ObjectId;
  vehicleType: "car" | "bike";
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  fuel?: string;
  transmission?: string;
  engineCc?: number;
  color?: string;
  bodyType?: string;
  condition: "new" | "used";
  registeredIn?: string;
  city: string;
  listPrice: number;
  negotiable: boolean;
  description?: string;
  photos: string[];
  features: string[];
  /** Detailed specs keyed by the catalogue in lib/vehicleSpecs. */
  specs?: Record<string, string | number | boolean>;
  /** YouTube / Facebook / TikTok / Vimeo walkaround link. */
  videoUrl?: string;
  /** Last price cut, for "price dropped" badges and alerts. */
  priceDrop?: { from: number; at: Date };
  /** Private: used only to match this car's listing history, never shown. */
  registrationNo?: string;
  chassisNo?: string;
  sellerName: string;
  sellerPhone: string;
  showPhone: boolean;
  status: AdStatus;
  rejectReason?: string;
  featured: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  views: number;
  contacts: number;
  messages: IAdMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const AdMessageSchema = new Schema<IAdMessage>({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  message: String,
  offerPrice: Number,
  at: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

const ClassifiedAdSchema = new Schema<IClassifiedAd>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "MarketMember", required: true },
    vehicleType: { type: String, enum: ["car", "bike"], required: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    year: { type: Number, required: true },
    mileage: { type: Number, default: 0, min: 0 },
    fuel: String,
    transmission: String,
    engineCc: Number,
    color: String,
    bodyType: String,
    condition: { type: String, enum: ["new", "used"], default: "used" },
    registeredIn: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    listPrice: { type: Number, required: true, min: 1 },
    negotiable: { type: Boolean, default: true },
    description: String,
    photos: { type: [String], default: [] },
    features: { type: [String], default: [] },
    specs: { type: Schema.Types.Mixed, default: undefined },
    videoUrl: String,
    priceDrop: { from: Number, at: Date },
    registrationNo: { type: String, trim: true, uppercase: true },
    chassisNo: { type: String, trim: true, uppercase: true },
    sellerName: { type: String, required: true, trim: true },
    sellerPhone: { type: String, required: true, trim: true },
    showPhone: { type: Boolean, default: true },
    status: { type: String, enum: AD_STATUSES, default: "pending" },
    rejectReason: String,
    featured: { type: Boolean, default: false },
    publishedAt: Date,
    expiresAt: Date,
    reviewedBy: String,
    reviewedAt: Date,
    views: { type: Number, default: 0 },
    contacts: { type: Number, default: 0 },
    messages: { type: [AdMessageSchema], default: [] },
  },
  { timestamps: true }
);

ClassifiedAdSchema.index({ status: 1, vehicleType: 1, featured: -1, publishedAt: -1 });
ClassifiedAdSchema.index({ memberId: 1, status: 1 });
ClassifiedAdSchema.index({ status: 1, expiresAt: 1 });

export const ClassifiedAd =
  models.ClassifiedAd || model<IClassifiedAd>("ClassifiedAd", ClassifiedAdSchema);

/* --------------------------------------------------------- shop orders */

export interface IShopOrderLine {
  itemId: Types.ObjectId;
  sku: string;
  title: string;
  image?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IShopOrderEvent {
  status: OrderStatus | "paid" | "note";
  note?: string;
  at: Date;
  byName?: string;
}

export interface IShopOrder {
  number: string;
  status: OrderStatus;
  memberId?: Types.ObjectId;
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  notes?: string;
  lines: IShopOrderLine[];
  subtotal: number;
  couponCode?: string;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: "unpaid" | "paid" | "refunded";
  paymentReference?: string;
  branchCode: string;
  /** Posted sales stock voucher created on confirmation (moves stock + books income). */
  stockVoucherId?: Types.ObjectId;
  stockVoucherNumber?: string;
  returnVoucherId?: Types.ObjectId;
  courier?: string;
  trackingNumber?: string;
  cancelReason?: string;
  events: IShopOrderEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const ShopOrderLineSchema = new Schema<IShopOrderLine>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    sku: { type: String, required: true },
    title: { type: String, required: true },
    image: String,
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ShopOrderSchema = new Schema<IShopOrder>(
  {
    number: { type: String, required: true, unique: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    memberId: { type: Schema.Types.ObjectId, ref: "MarketMember" },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    notes: String,
    lines: { type: [ShopOrderLineSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true },
    discount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cod" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    paymentReference: String,
    branchCode: { type: String, required: true, uppercase: true },
    stockVoucherId: { type: Schema.Types.ObjectId, ref: "StockVoucher" },
    stockVoucherNumber: String,
    returnVoucherId: { type: Schema.Types.ObjectId, ref: "StockVoucher" },
    courier: String,
    trackingNumber: String,
    cancelReason: String,
    events: {
      type: [{ status: String, note: String, at: { type: Date, default: Date.now }, byName: String, _id: false }],
      default: [],
    },
  },
  { timestamps: true }
);

ShopOrderSchema.index({ status: 1, createdAt: -1 });
ShopOrderSchema.index({ phone: 1, createdAt: -1 });
ShopOrderSchema.index({ memberId: 1, createdAt: -1 });

export const ShopOrder = models.ShopOrder || model<IShopOrder>("ShopOrder", ShopOrderSchema);

/* ------------------------------------------------------------ coupons */

export interface ICoupon {
  code: string;
  description?: string;
  kind: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  /** Cap for percent coupons (0 = no cap). */
  maxDiscount: number;
  startsAt?: Date;
  endsAt?: Date;
  /** Total redemptions allowed (0 = unlimited). */
  usageLimit: number;
  usedCount: number;
  /** Redemptions per mobile number (0 = unlimited). */
  perPhoneLimit: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    kind: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    startsAt: Date,
    endsAt: Date,
    usageLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    perPhoneLimit: { type: Number, default: 1, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = models.Coupon || model<ICoupon>("Coupon", CouponSchema);

/* ------------------------------------------------------ shop settings */

export interface IShopSettings {
  key: "default";
  enabled: boolean;
  classifiedsEnabled: boolean;
  /** Branch whose stock bucket fulfils web orders. */
  fulfilmentBranch: string;
  deliveryFee: number;
  freeDeliveryOver: number;
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankDetails?: string;
  whatsapp?: string;
  /** Ads go live without review when false. */
  moderateAds: boolean;
}

const ShopSettingsSchema = new Schema<IShopSettings>(
  {
    key: { type: String, default: "default", unique: true },
    enabled: { type: Boolean, default: true },
    classifiedsEnabled: { type: Boolean, default: true },
    fulfilmentBranch: { type: String, default: "MAIN", uppercase: true },
    deliveryFee: { type: Number, default: 250, min: 0 },
    freeDeliveryOver: { type: Number, default: 5000, min: 0 },
    codEnabled: { type: Boolean, default: true },
    bankTransferEnabled: { type: Boolean, default: false },
    bankDetails: String,
    whatsapp: String,
    moderateAds: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ShopSettings =
  models.ShopSettings || model<IShopSettings>("ShopSettings", ShopSettingsSchema);
