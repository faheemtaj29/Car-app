/**
 * Seller verification and business registration.
 *
 *  - Anyone who sells (private ad, dealer stock, parts) first gives their
 *    identity: legal name, CNIC number, address, and consent. No copy of the
 *    card is taken. It is kept for the record (fraud prevention, legal
 *    requests) and never published: the CNIC is encrypted, only an admin can
 *    read it, and every view is audit-logged.
 *  - Dealerships and parts suppliers also register a business profile, which
 *    staff approve before their listings go live. Business name, city, address
 *    and business phone are public on purpose (that is what buyers need).
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { MarketMember, type IMarketMember } from "@/backend/models/Marketplace";
import { ServiceError, type SessionUser } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { recordAudit } from "@/backend/lib/audit";
import { decryptField, encryptField, formatCnic, lookupHash, maskCnic, normaliseCnic } from "@/backend/lib/crypto";
import type { businessSchema, kycSchema, partnerReviewSchema } from "@/backend/validators/partner.validator";

type Doc<T> = T & { _id: Types.ObjectId };
type Member = Doc<IMarketMember>;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "business";

/** What the member themselves may see about their own verification. */
function ownView(m: Member) {
  return {
    accountType: m.accountType || "individual",
    kyc: {
      status: m.kyc?.status || "none",
      legalName: m.kyc?.legalName,
      cnic: m.kyc?.cnicLast4 ? maskCnic(m.kyc.cnicLast4) : undefined,
      city: m.kyc?.city,
      submittedAt: m.kyc?.submittedAt,
      reviewNote: m.kyc?.status === "rejected" ? m.kyc?.reviewNote : undefined,
    },
    business: m.business?.name
      ? { ...m.business, reviewNote: m.business.status === "rejected" ? m.business.reviewNote : undefined }
      : null,
  };
}

/** Public business card: only what a buyer needs, nothing personal. */
export function publicBusiness(m: Pick<Member, "business" | "createdAt" | "accountType" | "kyc" | "_id">) {
  if (!m.business?.name || m.business.status !== "approved") return null;
  return {
    id: String(m._id),
    type: m.accountType,
    name: m.business.name,
    slug: m.business.slug,
    city: m.business.city,
    address: m.business.address,
    phone: m.business.phone,
    whatsapp: m.business.whatsapp,
    about: m.business.about,
    categories: m.business.categories || [],
    verified: m.kyc?.status === "verified",
    memberSince: new Date(m.createdAt).toISOString(),
  };
}
export type PublicBusiness = NonNullable<ReturnType<typeof publicBusiness>>;

async function load(id: string) {
  const m = await MarketMember.findById(id).lean<Member>();
  if (!m || m.status !== "active") throw new ServiceError("UNAUTHORIZED", "Please log in again", 401);
  return m;
}

export const partnerService = {
  async mine(member: MemberSession) {
    await dbConnect();
    return ownView(await load(member.id));
  },

  async submitKyc(member: MemberSession, data: z.infer<typeof kycSchema>) {
    await dbConnect();
    const m = await load(member.id);
    if (m.kyc?.status === "verified") throw new ServiceError("CONFLICT", "Your identity is already verified. Contact us to change it.", 409);
    const cnic = normaliseCnic(data.cnic);
    if (!cnic || !/^[1-7]/.test(cnic)) throw new ServiceError("VALIDATION", "Enter a valid 13-digit CNIC (e.g. 35202-1234567-1)", 400);
    const hash = lookupHash(cnic);
    const other = await MarketMember.findOne({ _id: { $ne: m._id }, "kyc.cnicHash": hash, "kyc.status": { $in: ["pending", "verified"] } }).select("_id").lean();
    if (other) throw new ServiceError("CONFLICT", "This CNIC is already registered to another account. Please log in to that account or contact us.", 409);
    await MarketMember.updateOne(
      { _id: m._id },
      {
        $set: {
          "kyc.status": "pending",
          "kyc.legalName": data.legalName,
          "kyc.cnicEnc": encryptField(cnic),
          "kyc.cnicHash": hash,
          "kyc.cnicLast4": cnic.slice(-4),
          "kyc.address": data.address,
          "kyc.city": data.city,
          "kyc.consentAt": new Date(),
          "kyc.submittedAt": new Date(),
        },
        $unset: { "kyc.reviewNote": 1, "kyc.reviewedAt": 1 },
      }
    );
    return ownView(await load(member.id));
  },

  async applyBusiness(member: MemberSession, data: z.infer<typeof businessSchema>) {
    await dbConnect();
    const m = await load(member.id);
    if (!m.kyc || m.kyc.status === "none" || m.kyc.status === "rejected") {
      throw new ServiceError("VALIDATION", "Verify the owner's identity (CNIC) first", 400);
    }
    if (m.business?.status === "approved" && m.accountType !== data.type) {
      throw new ServiceError("CONFLICT", "Contact us to change an approved business type", 409);
    }
    let slug = m.business?.slug || slugify(`${data.name} ${data.city}`);
    if (!m.business?.slug) {
      for (let i = 2; await MarketMember.exists({ "business.slug": slug, _id: { $ne: m._id } }); i++) slug = `${slugify(`${data.name} ${data.city}`)}-${i}`;
    }
    // Edits to an approved profile stay live; first applications wait for review.
    const status = m.business?.status === "approved" ? "approved" : "pending";
    await MarketMember.updateOne(
      { _id: m._id },
      {
        $set: {
          accountType: data.type,
          business: { ...data, type: undefined, slug, status, submittedAt: m.business?.submittedAt || new Date(), reviewedAt: m.business?.reviewedAt },
        },
      }
    );
    return ownView(await load(member.id));
  },

  /** Rules for selling, used by the ad and parts services. */
  async sellerGate(memberId: string, what: "vehicle" | "parts") {
    const m = await load(memberId);
    const kyc = m.kyc?.status || "none";
    if (kyc === "none" || kyc === "rejected") {
      throw new ServiceError(
        "FORBIDDEN",
        kyc === "rejected"
          ? `Your identity check was not accepted${m.kyc?.reviewNote ? `: ${m.kyc.reviewNote}` : ""}. Please update it under My account → Verification.`
          : "Before you sell, verify your identity (CNIC) under My account → Verification. It is kept for our records only and never shown on the site.",
        403
      );
    }
    const type = m.accountType || "individual";
    if (what === "parts" && type !== "supplier") throw new ServiceError("FORBIDDEN", "Register as a parts supplier to list products", 403);
    if (what === "vehicle" && type === "supplier") throw new ServiceError("FORBIDDEN", "Supplier accounts list parts. Use a personal account to sell a vehicle.", 403);
    if (type !== "individual" && m.business?.status !== "approved") {
      throw new ServiceError("FORBIDDEN", m.business?.status === "suspended" ? "Your business account is suspended. Contact us." : "Your business registration is under review. You can list once it is approved.", 403);
    }
    return { member: m, type, trusted: type !== "individual" && kyc === "verified" };
  },

  async bySlug(slug: string) {
    await dbConnect();
    const m = await MarketMember.findOne({ "business.slug": slug.toLowerCase(), "business.status": "approved", status: "active" }).lean<Member>();
    return m ? publicBusiness(m) : null;
  },

  async directory(type: "dealer" | "supplier", city?: string | null) {
    await dbConnect();
    const q: Record<string, unknown> = { accountType: type, "business.status": "approved", status: "active" };
    if (city) q["business.city"] = city;
    const rows = await MarketMember.find(q).sort({ "business.name": 1 }).limit(500).lean<Member[]>();
    return rows.map(publicBusiness).filter(Boolean) as PublicBusiness[];
  },

  /** Business cards for a batch of member ids (listings, products). */
  async businessMap(ids: string[]) {
    await dbConnect();
    const valid = [...new Set(ids)].filter((x) => Types.ObjectId.isValid(x));
    if (!valid.length) return new Map<string, PublicBusiness>();
    const rows = await MarketMember.find({ _id: { $in: valid }, "business.status": "approved" }).lean<Member[]>();
    return new Map(rows.map((m) => [String(m._id), publicBusiness(m)!]).filter(([, b]) => b) as [string, PublicBusiness][]);
  },

  /* ------------------------------------------------------------ staff */

  async queue(filter: { kyc?: string | null; business?: string | null; type?: string | null }) {
    await dbConnect();
    const or: Record<string, unknown>[] = [];
    if (filter.kyc) or.push({ "kyc.status": filter.kyc });
    if (filter.business) or.push({ "business.status": filter.business });
    const q: Record<string, unknown> = or.length ? { $or: or } : { $or: [{ "kyc.status": { $in: ["pending", "verified", "rejected"] } }, { "business.status": { $exists: true } }] };
    if (filter.type) q.accountType = filter.type;
    const rows = await MarketMember.find(q).sort({ "kyc.submittedAt": -1 }).limit(300).lean<Member[]>();
    const counts = { kycPending: 0, businessPending: 0 };
    for (const r of await MarketMember.find({ $or: [{ "kyc.status": "pending" }, { "business.status": "pending" }] }).select("kyc.status business.status").lean<Member[]>()) {
      if (r.kyc?.status === "pending") counts.kycPending++;
      if (r.business?.status === "pending") counts.businessPending++;
    }
    return {
      counts,
      members: rows.map((m) => ({
        _id: String(m._id),
        name: m.name,
        phone: m.phone,
        email: m.email,
        accountType: m.accountType || "individual",
        createdAt: m.createdAt,
        kyc: { status: m.kyc?.status || "none", legalName: m.kyc?.legalName, cnic: m.kyc?.cnicLast4 ? maskCnic(m.kyc.cnicLast4) : undefined, city: m.kyc?.city, submittedAt: m.kyc?.submittedAt, reviewedBy: m.kyc?.reviewedBy, reviewNote: m.kyc?.reviewNote },
        business: m.business?.name ? m.business : null,
      })),
    };
  },

  /** Full identity for an admin, logged. */
  async reveal(id: string, actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Member not found", 404);
    const m = await MarketMember.findById(id).select("+kyc.cnicEnc +kyc.address name").lean<Member>();
    if (!m?.kyc?.cnicEnc) throw new ServiceError("NOT_FOUND", "No identity on file", 404);
    await recordAudit({ module: "dealership", action: "kyc_viewed", entity: "member", entityId: id, summary: `Identity of ${m.name} viewed`, actor });
    return {
      legalName: m.kyc.legalName,
      cnic: formatCnic(decryptField(m.kyc.cnicEnc)),
      address: m.kyc.address,
      city: m.kyc.city,
      consentAt: m.kyc.consentAt,
    };
  },

  async review(id: string, input: z.infer<typeof partnerReviewSchema>, actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Member not found", 404);
    const m = await MarketMember.findById(id).lean<Member>();
    if (!m) throw new ServiceError("NOT_FOUND", "Member not found", 404);
    const now = new Date();
    if (input.target === "kyc") {
      if (!m.kyc || m.kyc.status === "none") throw new ServiceError("CONFLICT", "No identity submitted", 409);
      await MarketMember.updateOne(
        { _id: m._id },
        { $set: { "kyc.status": input.decision, "kyc.reviewedAt": now, "kyc.reviewedBy": actor.name, "kyc.reviewNote": input.note, idVerified: input.decision === "verified", idVerifiedAt: input.decision === "verified" ? now : undefined } }
      );
    } else {
      if (!m.business?.name) throw new ServiceError("CONFLICT", "No business registered", 409);
      if (input.decision === "approved" && m.kyc?.status !== "verified") throw new ServiceError("VALIDATION", "Verify the owner's identity before approving the business", 400);
      await MarketMember.updateOne({ _id: m._id }, { $set: { "business.status": input.decision, "business.reviewedAt": now, "business.reviewNote": input.note } });
    }
    await recordAudit({ module: "dealership", action: `${input.target}_${input.decision}`, entity: "member", entityId: id, summary: `${m.name}: ${input.target} ${input.decision}${input.note ? ` (${input.note})` : ""}`, actor });
    return { ok: true };
  },
};
