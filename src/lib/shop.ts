/**
 * Shop + classifieds constants shared by API and UI (no server imports).
 */

export const VEHICLE_TYPES = ["car", "bike"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const BODY_TYPES: Record<VehicleType, string[]> = {
  car: ["Sedan", "Hatchback", "SUV", "Crossover", "Pickup", "Van", "Coupe", "MPV"],
  bike: ["Standard", "Sports", "Cruiser", "Scooter", "Off-road", "Cafe Racer", "Electric"],
};

export const FIT_TYPES = ["car", "bike", "universal"] as const;
export type FitType = (typeof FIT_TYPES)[number];

export const SHOP_CATEGORIES = [
  "Engine Oil & Lubricants",
  "Car Care & Cleaning",
  "Car Accessories",
  "Bike Accessories",
  "Spare Parts",
  "Tyres & Wheels",
  "Batteries & Electrical",
  "Lights",
  "Audio & Electronics",
  "Helmets & Riding Gear",
  "Tools & Garage",
] as const;

export const ORDER_STATUSES = ["pending", "confirmed", "dispatched", "delivered", "cancelled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "bank_transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const AD_STATUSES = ["pending", "active", "rejected", "sold", "expired", "removed"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

/** Business limits for private sellers. */
export const AD_LIMITS = { maxOpenAds: 5, maxDealerAds: 200, maxPhotos: 10, daysLive: 30 } as const;
export const CART_LIMITS = { maxLines: 30, maxQtyPerLine: 10 } as const;

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 80);
}

export type DeliveryQuote = { subtotal: number; delivery: number; total: number; freeOver: number };

/** Delivery is free at or above the threshold (0 disables the threshold). */
export function quoteDelivery(subtotal: number, fee: number, freeOver: number): DeliveryQuote {
  const delivery = subtotal <= 0 ? 0 : freeOver > 0 && subtotal >= freeOver ? 0 : fee;
  return { subtotal, delivery, total: Math.round((subtotal + delivery) * 100) / 100, freeOver };
}

/** Normalises Pakistani mobile numbers so "0300-1234567" and "+92 300 1234567" match. */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("0092")) return `0${digits.slice(4)}`;
  return digits;
}

export type CouponRule = {
  kind: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxDiscount: number;
};

/** Discount a coupon gives on `subtotal` (never more than the subtotal itself). */
export function couponDiscount(rule: CouponRule, subtotal: number) {
  if (subtotal <= 0 || subtotal < rule.minSubtotal) return 0;
  let d = rule.kind === "percent" ? (subtotal * rule.value) / 100 : rule.value;
  if (rule.kind === "percent" && rule.maxDiscount > 0) d = Math.min(d, rule.maxDiscount);
  return Math.round(Math.min(d, subtotal) * 100) / 100;
}

/** wa.me link for a Pakistani or international number with a prefilled message. */
export function whatsappLink(phone: string | undefined | null, text: string) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** CSV cell: quotes, doubled quotes, and a guard against spreadsheet formula injection. */
export function csvCell(value: unknown) {
  let s = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
