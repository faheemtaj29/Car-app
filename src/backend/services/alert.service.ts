/**
 * Saved searches and price watches. Matches are worked out when the member
 * opens the site (no background jobs to run), and shown as a 🔔 count with a
 * WhatsApp share link so they can forward a find to family.
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { Alert, type IAlert } from "@/backend/models/Engagement";
import { ServiceError } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { marketplaceService, parseListingFilters, type PublicListing } from "@/backend/services/marketplace.service";
import type { alertSchema } from "@/backend/validators/engagement.validator";

type Doc<T> = T & { _id: Types.ObjectId };
const MAX_ALERTS = 20;

/** "/cars?ask=…&city=Lahore" → filters for that page. */
function filtersOf(query: string) {
  const [path, qs = ""] = query.split("?");
  const params = new URLSearchParams(qs);
  const type = path === "/bikes" ? "bike" : "car";
  return { ...parseListingFilters((k) => (k === "feat" ? params.getAll("feat").join(",") || null : params.get(k))), type: type as "car" | "bike", page: 1 };
}

export type AlertView = {
  _id: string;
  kind: "search" | "price";
  label: string;
  query?: string;
  listingId?: string;
  createdAt: string;
  newCount: number;
  matches: PublicListing[];
  price?: { base: number; now: number | null };
};

export const alertService = {
  async create(member: MemberSession, data: z.infer<typeof alertSchema>) {
    await dbConnect();
    if ((await Alert.countDocuments({ memberId: member.id, active: true })) >= MAX_ALERTS) {
      throw new ServiceError("CONFLICT", `You can keep up to ${MAX_ALERTS} alerts. Delete one first.`, 409);
    }
    if (data.kind === "search") {
      if (!/^\/(cars|bikes)(\?.*)?$/.test(data.query)) throw new ServiceError("VALIDATION", "Only car or bike searches can be saved", 400);
      const dup = await Alert.findOne({ memberId: member.id, kind: "search", query: data.query, active: true });
      if (dup) return dup.toObject();
      return (await Alert.create({ memberId: member.id, kind: "search", query: data.query, label: data.label, lastSeenAt: new Date() })).toObject();
    }
    const [listing] = await marketplaceService.listingsByIds([data.listingId]);
    if (!listing) throw new ServiceError("NOT_FOUND", "This vehicle is no longer listed", 404);
    const dup = await Alert.findOne({ memberId: member.id, kind: "price", listingId: data.listingId, active: true });
    if (dup) return dup.toObject();
    return (
      await Alert.create({ memberId: member.id, kind: "price", listingId: data.listingId, label: listing.title, basePrice: listing.price, lastSeenAt: new Date() })
    ).toObject();
  },

  async list(member: MemberSession): Promise<AlertView[]> {
    await dbConnect();
    const alerts = await Alert.find({ memberId: member.id, active: true }).sort({ createdAt: -1 }).lean<Doc<IAlert>[]>();
    const watchIds = alerts.filter((a) => a.kind === "price" && a.listingId).map((a) => a.listingId!);
    const watched = new Map((await marketplaceService.listingsByIds(watchIds)).map((l) => [l._id, l]));
    return Promise.all(
      alerts.map(async (a) => {
        const base = { _id: String(a._id), kind: a.kind, label: a.label, query: a.query, listingId: a.listingId, createdAt: new Date(a.createdAt).toISOString() };
        if (a.kind === "search" && a.query) {
          const res = await marketplaceService.search({ ...filtersOf(a.query), since: new Date(a.lastSeenAt) }).catch(() => ({ listings: [], total: 0 }));
          return { ...base, newCount: res.total, matches: res.listings.slice(0, 6) };
        }
        const now = watched.get(a.listingId || "");
        const dropped = now && a.basePrice && now.price < a.basePrice ? 1 : 0;
        return { ...base, newCount: dropped || (now ? 0 : 1), matches: now ? [now] : [], price: { base: a.basePrice || 0, now: now?.price ?? null } };
      })
    );
  },

  async unseen(member: MemberSession) {
    const list = await this.list(member);
    return list.reduce((s, a) => s + (a.newCount > 0 ? 1 : 0), 0);
  },

  /** "Seen": new matches reset; a price watch re-bases on today's price. */
  async seen(member: MemberSession, id: string) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Alert not found", 404);
    const a = await Alert.findOne({ _id: id, memberId: member.id });
    if (!a) throw new ServiceError("NOT_FOUND", "Alert not found", 404);
    a.lastSeenAt = new Date();
    if (a.kind === "price" && a.listingId) {
      const [l] = await marketplaceService.listingsByIds([a.listingId]);
      if (l) a.basePrice = l.price;
      else a.active = false; // car is gone; nothing left to watch
    }
    await a.save();
    return { ok: true };
  },

  async remove(member: MemberSession, id: string) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Alert not found", 404);
    await Alert.deleteOne({ _id: id, memberId: member.id });
    return { ok: true };
  },
};
