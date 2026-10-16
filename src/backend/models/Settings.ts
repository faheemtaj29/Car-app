import { Schema, Types, models, model } from "mongoose";

export interface IBranch {
  code: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface IOptionLists {
  ledgerCategories: string[];
  inventoryCategories: string[];
  inventoryUnits: string[];
  inventoryLocations: string[];
  suppliers: string[];
}

export interface ITheme {
  preset: string;
  primary: string;
  accent: string;
  sidebar: string;
  surface: string;
  radius: number;
  solid: boolean;
}

/** Singleton business settings: profile, tax, branches, dropdowns, theme. */
export interface ISettings {
  businessName: string;
  tagline?: string;
  registrationNo?: string;
  ntn?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  currency: string;
  taxEnabled: boolean;
  taxName: string;
  taxRate: number;
  taxInclusive: boolean;
  defaultBranchCode: string;
  branches: IBranch[];
  optionLists: IOptionLists;
  theme: ITheme;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: String,
    phone: String,
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    businessName: { type: String, default: "Auto Marketplace", trim: true },
    tagline: { type: String, default: "Cars, bikes, parts & accessories" },
    registrationNo: String,
    ntn: String,
    address: String,
    phone: String,
    whatsapp: String,
    email: String,
    facebook: String,
    instagram: String,
    currency: { type: String, default: "PKR" },
    taxEnabled: { type: Boolean, default: false },
    taxName: { type: String, default: "GST" },
    taxRate: { type: Number, default: 0 },
    taxInclusive: { type: Boolean, default: true },
    defaultBranchCode: { type: String, default: "MAIN", uppercase: true },
    branches: { type: [BranchSchema], default: [{ code: "MAIN", name: "Main Showroom" }] },
    optionLists: {
      ledgerCategories: { type: [String], default: [] },
      inventoryCategories: { type: [String], default: ["Engine Oil", "Accessories", "Spare Parts", "Tyres", "Batteries", "Riding Gear"] },
      inventoryUnits: { type: [String], default: ["pcs", "litre", "set", "pair", "box"] },
      inventoryLocations: { type: [String], default: [] },
      suppliers: { type: [String], default: [] },
    },
    theme: {
      preset: { type: String, default: "jade" },
      primary: { type: String, default: "#157A5C" },
      accent: { type: String, default: "#E8992E" },
      sidebar: { type: String, default: "#0E211A" },
      surface: { type: String, default: "#F4F6F2" },
      radius: { type: Number, default: 14 },
      solid: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const Settings = models.Settings || model<ISettings>("Settings", SettingsSchema);

/**
 * Fixed _id for the one settings document: concurrent first requests on a
 * fresh install then collide on the key instead of creating duplicates.
 */
export const SETTINGS_ID = new Types.ObjectId("000000000000000000000001");

/** Returns the settings document, creating it once if missing (race-safe). */
export async function ensureSettings(): Promise<ISettings & { _id: Types.ObjectId }> {
  const find = () => Settings.findOne().sort({ _id: 1 }).lean<ISettings & { _id: Types.ObjectId }>();
  const existing = await find();
  if (existing) return existing;
  try {
    await Settings.create({ _id: SETTINGS_ID });
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
  }
  return (await find())!;
}
