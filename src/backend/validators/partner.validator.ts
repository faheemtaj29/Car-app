import { z } from "zod";
import { CITIES, PART_CATEGORIES } from "@/lib/catalog";

const phone = z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, "Enter a valid phone number");
const year = new Date().getFullYear() + 1;
const imageUrl = z.string().trim().refine((v) => /^\/uploads\/[\w/.-]+$/.test(v), "Upload the photo again");

export const kycSchema = z.object({
  legalName: z.string().trim().min(3, "Full name as on your CNIC").max(80),
  cnic: z.string().trim().min(13, "Enter your 13-digit CNIC").max(20),
  address: z.string().trim().min(10, "Enter your full address").max(300),
  city: z.string().trim().min(2, "City is required").max(60),
  consent: z.literal(true, { message: "Please agree to how we keep your information" }),
});

export const businessSchema = z.object({
  type: z.enum(["dealer", "supplier"]),
  name: z.string().trim().min(3, "Business name is required").max(80),
  address: z.string().trim().min(10, "Enter the full business address").max(300),
  city: z.string().trim().refine((c) => CITIES.some((x) => x.toLowerCase() === c.toLowerCase()), "Pick your city from the list"),
  phone,
  whatsapp: phone.optional().or(z.literal("")),
  ntn: z.string().trim().regex(/^[\d-]{7,12}$/, "NTN looks wrong").optional().or(z.literal("")),
  about: z.string().trim().max(800).optional(),
  categories: z.array(z.enum(PART_CATEGORIES)).max(PART_CATEGORIES.length).optional(),
});

export const partnerReviewSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("kyc"), decision: z.enum(["verified", "rejected"]), note: z.string().trim().max(300).optional() }),
  z.object({ target: z.literal("business"), decision: z.enum(["approved", "rejected", "suspended"]), note: z.string().trim().max(300).optional() }),
]);

export const fitmentSchema = z.object({
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().max(40).optional().or(z.literal("")),
  yearFrom: z.coerce.number().int().min(1960).max(year).optional(),
  yearTo: z.coerce.number().int().min(1960).max(year).optional(),
});

export const supplierProductSchema = z
  .object({
    title: z.string().trim().min(4, "Product name is required").max(120),
    brand: z.string().trim().max(40).optional(),
    category: z.enum(PART_CATEGORIES),
    kind: z.enum(["car", "bike", "both"]).default("car"),
    condition: z.enum(["new", "used", "refurbished"]).default("new"),
    price: z.coerce.number().min(1, "Enter the price").max(50_000_000),
    compareAtPrice: z.coerce.number().min(0).optional(),
    description: z.string().trim().max(3000).optional(),
    images: z.array(imageUrl).min(1, "Add at least one photo").max(8),
    universal: z.boolean().default(false),
    fitments: z.array(fitmentSchema).max(40).default([]),
    inStock: z.boolean().default(true),
    delivery: z.boolean().default(false),
    partNumber: z.string().trim().max(40).optional(),
  })
  .refine((p) => p.universal || p.fitments.length > 0, { message: "Add the vehicles it fits, or mark it universal", path: ["fitments"] })
  .refine((p) => p.fitments.every((f) => !f.yearFrom || !f.yearTo || f.yearFrom <= f.yearTo), { message: "Year range is back to front", path: ["fitments"] });

export const partsEnquirySchema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(80),
  phone,
  message: z.string().trim().max(800).optional(),
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
});

export const supplierProductModerationSchema = z.object({ status: z.enum(["active", "hidden"]), note: z.string().trim().max(300).optional() });
