import { z } from "zod";

const hex = (label: string) => z.string().regex(/^#[0-9a-fA-F]{6}$/, `Use a hex colour like ${label}`);

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required"),
  tagline: z.string().trim().max(120).optional(),
  registrationNo: z.string().optional(),
  ntn: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  currency: z.string().default("PKR"),
  taxEnabled: z.boolean().default(false),
  taxName: z.string().default("GST"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  taxInclusive: z.boolean().default(true),
  defaultBranchCode: z.string().trim().min(1).default("MAIN"),
  branches: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(12),
        name: z.string().trim().min(1),
        address: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .min(1, "Keep at least one branch"),
  theme: z
    .object({
      preset: z.string().default("jade"),
      primary: hex("#157A5C"),
      accent: hex("#E8992E"),
      sidebar: hex("#0E211A"),
      surface: hex("#F4F6F2"),
      radius: z.coerce.number().min(0).max(28).default(14),
      solid: z.boolean().default(true),
    })
    .optional(),
  costs: z
    .object({
      petrolPerLitre: z.coerce.number().min(0).max(5000),
      dieselPerLitre: z.coerce.number().min(0).max(5000),
      cngPerKg: z.coerce.number().min(0).max(5000),
      electricityPerKwh: z.coerce.number().min(0).max(1000),
      insurancePct: z.coerce.number().min(0).max(20),
      bikeInsurancePct: z.coerce.number().min(0).max(20),
      depreciationPct: z.coerce.number().min(0).max(50),
      bikeAnnualTax: z.coerce.number().min(0).max(100000),
      tokenTax: z.record(z.string(), z.array(z.object({ maxCc: z.coerce.number().min(1), amount: z.coerce.number().min(0) })).max(12)),
      updatedNote: z.string().max(200).optional(),
    })
    .optional(),
  tokenInstructions: z.string().trim().max(1000).optional(),
  tokenEnabled: z.boolean().default(false),
  tokenHoldDays: z.coerce.number().int().min(1).max(30).default(7),
  banks: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        markupPct: z.coerce.number().min(0).max(60),
        minDownPct: z.coerce.number().min(0).max(90),
        maxYears: z.coerce.number().int().min(1).max(10),
        processingFee: z.coerce.number().min(0),
        insurancePct: z.coerce.number().min(0).max(20),
        maxCarAge: z.coerce.number().int().min(0).max(30),
        islamic: z.boolean().default(false),
      })
    )
    .max(15)
    .optional(),
});

export const optionListSchema = z.object({
  key: z.enum(["ledgerCategories", "inventoryCategories", "inventoryUnits", "inventoryLocations", "suppliers"]),
  value: z.string().trim().min(1).max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const setupSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required"),
  name: z.string().trim().min(2, "Your name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const userSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().optional(),
  role: z.enum(["admin", "staff"]).default("staff"),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const ledgerSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1),
  title: z.string().min(1),
  amount: z.coerce.number().min(0),
  date: z.string().min(1),
  method: z.enum(["cash", "bank", "online", "cheque"]).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  branchCode: z.string().optional(),
  taxAmount: z.coerce.number().min(0).optional(),
});

export const accountSchema = z.object({
  code: z.string().regex(/^\d+$/, "Account code must contain digits only"),
  name: z.string().min(2),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  level: z.coerce.number().int().min(1).max(5),
  parentCode: z.string().optional().nullable(),
  isControl: z.boolean().default(false),
  isPosting: z.boolean().default(true),
  isCashBank: z.boolean().default(false),
  isActive: z.boolean().default(true),
  openingBalance: z.coerce.number().min(0).default(0),
  openingBalanceSide: z.enum(["debit", "credit"]).default("debit"),
});

const voucherLineSchema = z
  .object({
    accountCode: z.string().min(1),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
    narration: z.string().optional(),
  })
  .refine((line) => (line.debit > 0) !== (line.credit > 0), {
    message: "Each line must have either debit or credit",
  });

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  accountCode: z.string().optional(),
});

export const voucherSchema = z.object({
  voucherType: z.enum([
    "journal",
    "receipt",
    "payment",
    "contra",
    "sales_invoice",
    "purchase_invoice",
  ]),
  date: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  branchCode: z.string().min(1),
  partyType: z.enum(["customer", "supplier", "other"]).optional().nullable(),
  partyId: z.string().optional().nullable(),
  partyName: z.string().optional(),
  narration: z.string().min(2),
  reference: z.string().optional(),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  items: z.array(invoiceItemSchema).default([]),
  lines: z.array(voucherLineSchema).default([]),
  postNow: z.boolean().default(false),
});

export const voucherActionSchema = z.object({
  action: z.enum(["post", "void", "approve", "reject", "cancel", "reverse"]),
  reason: z.string().optional(),
});

export const inventorySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().default("pcs"),
  quantity: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).default(5),
  unitCost: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).default(0),
  location: z.string().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  branchCode: z.string().optional(),
});

const stockVoucherItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number(),
  rate: z.coerce.number().min(0).default(0),
});

export const stockVoucherSchema = z.object({
  voucherType: z.enum([
    "purchase",
    "sales",
    "purchase_return",
    "sales_return",
    "transfer",
    "adjustment",
  ]),
  date: z.string().min(1),
  branchCode: z.string().min(1),
  toBranchCode: z.string().optional().nullable(),
  partyName: z.string().optional(),
  reference: z.string().optional(),
  narration: z.string().min(2),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  items: z.array(stockVoucherItemSchema).min(1),
  postNow: z.boolean().default(false),
});

