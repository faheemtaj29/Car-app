import type { z } from "zod";
import { dbConnect } from "@/backend/config/database";
import { Settings, type ISettings } from "@/backend/models/Settings";
import { DEFAULT_THEME } from "@/lib/theme";
import type { settingsSchema } from "@/backend/validators/erp.validator";

type SettingsInput = z.infer<typeof settingsSchema>;
type OptionKey = keyof ISettings["optionLists"];

export const settingsService = {
  /** The singleton settings document, created with defaults on first use. */
  async get(): Promise<ISettings> {
    await dbConnect();
    let doc = await Settings.findOne().lean<ISettings>();
    if (!doc) doc = (await Settings.create({})).toObject() as ISettings;
    return {
      ...doc,
      branches: doc.branches?.length ? doc.branches : [{ code: "MAIN", name: "Main Showroom" }],
      theme: { ...DEFAULT_THEME, ...(doc.theme || {}) },
    };
  },

  async update(data: SettingsInput) {
    await dbConnect();
    await this.get();
    const branches = data.branches.map((b) => ({ ...b, code: b.code.toUpperCase().trim() }));
    const codes = new Set(branches.map((b) => b.code));
    if (codes.size !== branches.length) throw new Error("Branch codes must be unique");
    const defaultBranchCode = data.defaultBranchCode.toUpperCase();
    return Settings.findOneAndUpdate(
      {},
      {
        $set: {
          ...data,
          email: data.email || undefined,
          facebook: data.facebook || undefined,
          instagram: data.instagram || undefined,
          branches,
          defaultBranchCode: codes.has(defaultBranchCode) ? defaultBranchCode : branches[0].code,
          ...(data.theme ? { theme: { ...DEFAULT_THEME, ...data.theme } } : {}),
        },
      },
      { new: true }
    ).lean();
  },

  async addOption(key: OptionKey, value: string) {
    await this.get(); // make sure the document exists before $addToSet
    const clean = value.trim();
    await Settings.updateOne({}, { $addToSet: { [`optionLists.${key}`]: clean } });
    return clean;
  },
};
