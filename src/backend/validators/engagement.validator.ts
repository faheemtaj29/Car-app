import { z } from "zod";
import { PROVINCES } from "@/lib/ownership";
import { SERVICE_TYPES } from "@/lib/garage";

const year = new Date().getFullYear();
const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Invalid date");
const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,18}$/, "Enter a valid phone number");

/* ---------------------------------------------------------- My Garage */

export const garageCarSchema = z.object({
  vehicleType: z.enum(["car", "bike"]).default("car"),
  make: z.string().trim().min(1, "Make is required").max(40),
  model: z.string().trim().min(1, "Model is required").max(40),
  variant: z.string().trim().max(60).optional(),
  year: z.coerce.number().int().min(1960).max(year + 1),
  engineCc: z.coerce.number().min(0).max(10000).optional(),
  fuel: z.string().max(20).optional(),
  transmission: z.string().max(20).optional(),
  color: z.string().max(30).optional(),
  registrationNo: z.string().trim().max(20).optional(),
  province: z.enum(PROVINCES).default("Punjab"),
  km: z.coerce.number().min(0).max(2_000_000),
  dailyKm: z.coerce.number().min(0).max(1000).default(30),
  oilIntervalKm: z.coerce.number().min(500).max(30000).default(5000),
  lastOilKm: z.coerce.number().min(0).max(2_000_000).optional(),
  serviceIntervalKm: z.coerce.number().min(1000).max(60000).default(10000),
  lastServiceKm: z.coerce.number().min(0).max(2_000_000).optional(),
  tokenTaxDue: optionalDate,
  insuranceDue: optionalDate,
});

export const serviceEntrySchema = z.object({
  date: optionalDate,
  km: z.coerce.number().min(0).max(2_000_000),
  type: z.enum(SERVICE_TYPES),
  cost: z.coerce.number().min(0).max(100_000_000).default(0),
  garage: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  /** For "Token tax paid" / "Insurance renewed": the next due date. */
  nextDue: optionalDate,
});

/* ----------------------------------------------------------- bookings */

export const bookingSchema = z.object({
  type: z.enum(["test_drive", "inspection", "video_call"]),
  listingId: z.string().trim().optional(),
  name: z.string().trim().min(2, "Your name is required").max(80),
  phone,
  date: z.string().trim().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date"),
  slot: z.string().trim().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
});

export const bookingActionSchema = z.object({
  status: z.enum(["confirmed", "done", "cancelled"]),
  staffNote: z.string().trim().max(300).optional(),
});

/* ------------------------------------------------------------ reviews */

export const reviewSchema = z.object({
  targetType: z.enum(["dealer", "member"]),
  targetId: z.string().trim().min(1).max(40),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const reviewModerationSchema = z.object({ status: z.enum(["visible", "hidden"]) });

/* ----------------------------------------------------- instant offer */

export const instantOfferSchema = z.object({
  vehicleType: z.enum(["car", "bike"]).default("car"),
  make: z.string().trim().min(1, "Make is required").max(40),
  model: z.string().trim().min(1, "Model is required").max(40),
  year: z.coerce.number().int().min(1970).max(year + 1),
  mileage: z.coerce.number().min(0).max(2_000_000),
  condition: z.enum(["excellent", "good", "fair", "needs_work"]).default("good"),
  accident: z.boolean().default(false),
  city: z.string().trim().max(60).optional(),
});

/* ------------------------------------------------------------ alerts */

export const alertSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("search"), query: z.string().trim().max(500), label: z.string().trim().min(1).max(120) }),
  z.object({ kind: z.literal("price"), listingId: z.string().trim().min(1).max(40) }),
]);

/* -------------------------------------------------------- safe token */

export const tokenRequestSchema = z.object({
  vehicleId: z.string().trim().min(1),
  name: z.string().trim().min(2, "Your name is required").max(80),
  phone,
  cnicLast4: z.string().trim().regex(/^\d{4}$/, "Last 4 digits of your CNIC").optional().or(z.literal("")),
  amount: z.coerce.number().min(10_000, "Minimum token is Rs 10,000").max(5_000_000),
  method: z.enum(["bank_transfer", "jazzcash", "easypaisa", "cash"]),
  reference: z.string().trim().min(4, "Enter the transaction ID / reference").max(60),
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
});

export const tokenActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), holdDays: z.coerce.number().int().min(1).max(30).default(7), staffNote: z.string().max(300).optional() }),
  z.object({ action: z.literal("reject"), staffNote: z.string().trim().min(3, "Give a reason") }),
  z.object({ action: z.literal("refund"), staffNote: z.string().trim().min(3, "Give a reason") }),
  z.object({ action: z.literal("applied"), staffNote: z.string().max(300).optional() }),
]);
