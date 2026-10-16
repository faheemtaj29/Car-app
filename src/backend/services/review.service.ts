/**
 * Reviews and trust: buyers rate the showroom or a private seller, and every
 * seller gets a trust profile (rating, time on the site, ads sold, ID check).
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { Review, type IReview } from "@/backend/models/Engagement";
import { ClassifiedAd, MarketMember, type IMarketMember } from "@/backend/models/Marketplace";
import { ServiceError, type SessionUser } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { recordAudit } from "@/backend/lib/audit";
import type { reviewSchema } from "@/backend/validators/engagement.validator";
import { settingsService } from "@/backend/services/settings.service";
import { env } from "@/backend/config/env";

type Doc<T> = T & { _id: Types.ObjectId };

export type TrustProfile = {
  rating: number | null;
  reviews: number;
  stars: Record<1 | 2 | 3 | 4 | 5, number>;
  latest: { _id: string; memberName: string; rating: number; comment?: string; createdAt: string }[];
  memberSince?: string;
  adsPosted?: number;
  adsSold?: number;
  idVerified?: boolean;
  badges: string[];
};


export const reviewService = {
  async upsert(member: MemberSession, data: z.infer<typeof reviewSchema>) {
    await dbConnect();
    const me = await MarketMember.findById(member.id).lean<Doc<IMarketMember>>();
    if (!me || me.status !== "active") throw new ServiceError("UNAUTHORIZED", "Please log in again", 401);
    const minHours = env.reviewMinAccountHours;
    if (Date.now() - new Date(me.createdAt).getTime() < minHours * 3_600_000) {
      throw new ServiceError("FORBIDDEN", `New accounts can post reviews after ${minHours} hours`, 403);
    }
    if (data.targetType === "member") {
      if (data.targetId === member.id) throw new ServiceError("VALIDATION", "You cannot review yourself", 400);
      if (!Types.ObjectId.isValid(data.targetId) || !(await MarketMember.exists({ _id: data.targetId }))) {
        throw new ServiceError("NOT_FOUND", "Seller not found", 404);
      }
    } else {
      const branches = (await settingsService.get()).branches.map((b) => b.code);
      if (!branches.includes(data.targetId.toUpperCase())) throw new ServiceError("NOT_FOUND", "Showroom not found", 404);
      data = { ...data, targetId: data.targetId.toUpperCase() };
    }
    const filter = { targetType: data.targetType, targetId: data.targetId, memberId: new Types.ObjectId(member.id) };
    const review = await Review.findOneAndUpdate(
      filter,
      { $set: { rating: data.rating, comment: data.comment || undefined, memberName: me.name.split(" ")[0] }, $setOnInsert: { ...filter, status: "visible" } },
      { upsert: true, returnDocument: "after" }
    ).lean<Doc<IReview>>();
    return review;
  },

  async trust(targetType: "dealer" | "member", targetId: string): Promise<TrustProfile> {
    await dbConnect();
    const rows = await Review.find({ targetType, targetId, status: "visible" }).sort({ createdAt: -1 }).limit(500).lean<Doc<IReview>[]>();
    const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as TrustProfile["stars"];
    rows.forEach((r) => (stars[r.rating as 1] += 1));
    const rating = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null;
    const out: TrustProfile = {
      rating,
      reviews: rows.length,
      stars,
      latest: rows.slice(0, 5).map((r) => ({ _id: String(r._id), memberName: r.memberName, rating: r.rating, comment: r.comment, createdAt: new Date(r.createdAt).toISOString() })),
      badges: [],
    };
    if (targetType === "member" && Types.ObjectId.isValid(targetId)) {
      const [m, posted, sold] = await Promise.all([
        MarketMember.findById(targetId).select("createdAt idVerified").lean<Doc<IMarketMember>>(),
        ClassifiedAd.countDocuments({ memberId: targetId }),
        ClassifiedAd.countDocuments({ memberId: targetId, status: "sold" }),
      ]);
      out.memberSince = m?.createdAt ? new Date(m.createdAt).toISOString() : undefined;
      out.adsPosted = posted;
      out.adsSold = sold;
      out.idVerified = Boolean(m?.idVerified);
      if (m?.idVerified) out.badges.push("ID verified by showroom");
      if (sold >= 3) out.badges.push(`${sold} vehicles sold here`);
      if (m?.createdAt && Date.now() - new Date(m.createdAt).getTime() > 365 * 86_400_000) out.badges.push("Member over 1 year");
    } else {
      out.badges.push("Dealer stock is inspected", "Fair-price rated");
    }
    if (rating !== null && rating >= 4.5 && rows.length >= 5) out.badges.push("Top rated");
    return out;
  },

  async staffList(status?: string | null) {
    await dbConnect();
    return Review.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(300).lean<Doc<IReview>[]>();
  },

  async moderate(id: string, status: "visible" | "hidden", actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Review not found", 404);
    const r = await Review.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after" }).lean<Doc<IReview>>();
    if (!r) throw new ServiceError("NOT_FOUND", "Review not found", 404);
    await recordAudit({ module: "dealership", action: status, entity: "review", entityId: id, summary: `Review ${status}`, actor });
    return r;
  },

  async setMemberVerified(memberId: string, verified: boolean, actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(memberId)) throw new ServiceError("NOT_FOUND", "Member not found", 404);
    // Plain update + read (the member schema hides passwordHash, and some stores
    // cannot apply that projection inside findAndModify).
    const res = await MarketMember.updateOne({ _id: memberId }, { $set: { idVerified: verified, idVerifiedAt: verified ? new Date() : undefined } });
    if (!res.matchedCount) throw new ServiceError("NOT_FOUND", "Member not found", 404);
    const m = (await MarketMember.findById(memberId).select("name idVerified").lean<Doc<IMarketMember>>())!;
    await recordAudit({ module: "dealership", action: verified ? "verified" : "unverified", entity: "member", entityId: memberId, summary: `${m.name} ID ${verified ? "verified" : "unverified"}`, actor });
    return { _id: String(m._id), idVerified: Boolean(m.idVerified) };
  },
};
