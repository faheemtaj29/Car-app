/**
 * Parts & accessories listed by registered suppliers. Buyers contact the
 * supplier directly (call, WhatsApp, or a message here); the showroom's own
 * shop keeps its cart and checkout.
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { SupplierProduct, type ISupplierProduct } from "@/backend/models/Partners";
import { MarketMember } from "@/backend/models/Marketplace";
import { ServiceError, type SessionUser } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { recordAudit } from "@/backend/lib/audit";
import { editableFitments, fitmentFilter, fitmentKeys, normaliseFitments, type VehiclePick } from "@/lib/fitment";
import { partnerService, type PublicBusiness } from "@/backend/services/partner.service";
import type { partsEnquirySchema, supplierProductModerationSchema, supplierProductSchema } from "@/backend/validators/partner.validator";

type Doc<T> = T & { _id: Types.ObjectId };
const MAX_PRODUCTS = 500;
const PAGE = 24;

function fitFields(data: { universal: boolean; fitments: { make: string; model?: string; yearFrom?: number; yearTo?: number }[] }) {
  const list = data.universal ? [] : data.fitments;
  return { fitments: normaliseFitments(list), fitKeys: fitmentKeys(list) };
}
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type PublicPart = {
  _id: string;
  title: string;
  brand?: string;
  category: string;
  kind: "car" | "bike" | "both";
  condition: string;
  price: number;
  compareAtPrice?: number;
  description?: string;
  images: string[];
  universal: boolean;
  fitments: { make: string; model?: string; yearFrom?: number; yearTo?: number }[];
  inStock: boolean;
  delivery: boolean;
  partNumber?: string;
  city?: string;
  supplier: PublicBusiness | null;
};

function toPublic(p: Doc<ISupplierProduct>, supplier: PublicBusiness | null): PublicPart {
  return {
    _id: String(p._id),
    title: p.title,
    brand: p.brand,
    category: p.category,
    kind: p.kind,
    condition: p.condition,
    price: p.price,
    compareAtPrice: p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : undefined,
    description: p.description,
    images: p.images,
    universal: p.universal,
    fitments: editableFitments(p.fitments),
    inStock: p.inStock,
    delivery: p.delivery,
    partNumber: p.partNumber,
    city: p.city,
    supplier,
  };
}

export type PartsFilters = VehiclePick & { q?: string; category?: string; city?: string; universal?: boolean; supplierId?: string; page?: number; sort?: string };

export const supplierService = {
  async create(member: MemberSession, data: z.infer<typeof supplierProductSchema>) {
    await dbConnect();
    const { member: m } = await partnerService.sellerGate(member.id, "parts");
    if ((await SupplierProduct.countDocuments({ supplierId: member.id, status: { $ne: "removed" } })) >= MAX_PRODUCTS) {
      throw new ServiceError("CONFLICT", `You can list up to ${MAX_PRODUCTS} products`, 409);
    }
    const p = await SupplierProduct.create({ ...data, ...fitFields(data), supplierId: member.id, city: m.business?.city, status: "active" });
    return p.toObject();
  },

  async update(member: MemberSession, id: string, data: z.infer<typeof supplierProductSchema>) {
    await dbConnect();
    await partnerService.sellerGate(member.id, "parts");
    const p = await SupplierProduct.findOne({ _id: id, supplierId: member.id, status: { $ne: "removed" } });
    if (!p) throw new ServiceError("NOT_FOUND", "Product not found", 404);
    // A product staff hid stays hidden after edits until staff show it again.
    Object.assign(p, { ...data, ...fitFields(data) });
    await p.save();
    return p.toObject();
  },

  async remove(member: MemberSession, id: string) {
    await dbConnect();
    const res = await SupplierProduct.updateOne({ _id: id, supplierId: member.id }, { $set: { status: "removed" } });
    if (!res.matchedCount) throw new ServiceError("NOT_FOUND", "Product not found", 404);
    return { ok: true };
  },

  async mine(member: MemberSession) {
    await dbConnect();
    return SupplierProduct.find({ supplierId: member.id, status: { $ne: "removed" } }).sort({ updatedAt: -1 }).limit(MAX_PRODUCTS).lean<Doc<ISupplierProduct>[]>();
  },

  async readMessages(member: MemberSession, id: string) {
    await dbConnect();
    const p = await SupplierProduct.findOne({ _id: id, supplierId: member.id });
    if (!p) throw new ServiceError("NOT_FOUND", "Product not found", 404);
    p.messages.forEach((m: { read: boolean }) => (m.read = true));
    await p.save();
    return { ok: true };
  },

  /** Public search. A chosen make/model/year returns only parts that fit it. */
  async search(f: PartsFilters) {
    await dbConnect();
    // Only products of approved, active suppliers are public.
    const approved = (await MarketMember.find({ accountType: "supplier", "business.status": "approved", status: "active" }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map((m) => m._id);
    const q: Record<string, unknown> = { status: "active", supplierId: { $in: approved } };
    const and: Record<string, unknown>[] = [];
    if (f.kind) q.kind = { $in: [f.kind, "both"] };
    if (f.category) q.category = f.category;
    if (f.city) q.city = new RegExp(`^${esc(f.city)}$`, "i");
    if (f.supplierId) q.supplierId = { $in: approved.filter((x) => String(x) === f.supplierId) };
    if (f.q?.trim()) {
      const rx = new RegExp(esc(f.q.trim()), "i");
      and.push({ $or: [{ title: rx }, { brand: rx }, { partNumber: rx }, { description: rx }] });
    }
    const fitQ = fitmentFilter("fitKeys", f, Boolean(f.universal), "universal");
    if (fitQ) and.push(fitQ);
    if (and.length) q.$and = and;
    const sorts: Record<string, Record<string, 1 | -1>> = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } };
    const page = Math.max(1, f.page || 1);
    const [rows, total] = await Promise.all([
      SupplierProduct.find(q).sort(sorts[f.sort || "newest"] || sorts.newest).skip((page - 1) * PAGE).limit(PAGE).select("-messages").lean<Doc<ISupplierProduct>[]>(),
      SupplierProduct.countDocuments(q),
    ]);
    const suppliers = await partnerService.businessMap(rows.map((r) => String(r.supplierId)));
    return { parts: rows.map((r) => toPublic(r, suppliers.get(String(r.supplierId)) || null)), total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
  },

  async one(id: string, countView = true) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Product not found", 404);
    const filter = { _id: id, status: "active" };
    if (countView) await SupplierProduct.updateOne(filter, { $inc: { views: 1 } });
    const p = await SupplierProduct.findOne(filter).select("-messages").lean<Doc<ISupplierProduct>>();
    if (!p) throw new ServiceError("NOT_FOUND", "This product is no longer listed", 404);
    const supplier = (await partnerService.businessMap([String(p.supplierId)])).get(String(p.supplierId)) || null;
    if (!supplier) throw new ServiceError("NOT_FOUND", "This product is no longer listed", 404);
    return toPublic(p, supplier);
  },

  async enquire(id: string, data: z.infer<typeof partsEnquirySchema>) {
    await dbConnect();
    const p = await SupplierProduct.findOne({ _id: id, status: "active" });
    if (!p) throw new ServiceError("NOT_FOUND", "This product is no longer listed", 404);
    const now = Date.now();
    if (p.messages.slice(-5).some((m: { phone: string; at: Date }) => m.phone === data.phone && now - new Date(m.at).getTime() < 600_000)) return { ok: true, duplicate: true };
    p.messages.push({ name: data.name, phone: data.phone, message: data.message || undefined, at: new Date(), read: false });
    if (p.messages.length > 200) p.messages = p.messages.slice(-200);
    p.contacts = (p.contacts || 0) + 1;
    await p.save();
    return { ok: true };
  },

  /* ----------------------------------------------------------- staff */

  async staffList(status?: string | null) {
    await dbConnect();
    const rows = await SupplierProduct.find(status ? { status } : { status: { $ne: "removed" } }).sort({ createdAt: -1 }).limit(500).select("-messages").lean<Doc<ISupplierProduct>[]>();
    const suppliers = await partnerService.businessMap(rows.map((r) => String(r.supplierId)));
    return rows.map((r) => ({ ...r, _id: String(r._id), supplierName: suppliers.get(String(r.supplierId))?.name || "(not approved)" }));
  },

  async moderate(id: string, input: z.infer<typeof supplierProductModerationSchema>, actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Product not found", 404);
    const res = await SupplierProduct.updateOne({ _id: id, status: { $ne: "removed" } }, { $set: { status: input.status, staffNote: input.note } });
    if (!res.matchedCount) throw new ServiceError("NOT_FOUND", "Product not found", 404);
    await recordAudit({ module: "dealership", action: `part_${input.status}`, entity: "supplier_product", entityId: id, summary: `Supplier product ${input.status}${input.note ? `: ${input.note}` : ""}`, actor });
    return { ok: true };
  },
};
