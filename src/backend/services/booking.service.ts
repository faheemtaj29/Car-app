/**
 * Online booking: showroom test drives, home inspections by our mechanic and
 * WhatsApp video viewings. Each bookable slot has a unique key, so two people
 * cannot take the same slot even if they press "Book" at the same moment.
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { nextSequence } from "@/backend/lib/sequence";
import { Booking, type BookingType, type IBooking } from "@/backend/models/Engagement";
import { ClassifiedAd, type IClassifiedAd } from "@/backend/models/Marketplace";
import { Vehicle, type IVehicle } from "@/backend/models/Dealership";
import { ServiceError, type SessionUser } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { recordAudit } from "@/backend/lib/audit";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { BOOKING_LABEL, BOOKING_SLOTS, bookableDates, slotIsFuture } from "@/lib/booking";
import type { bookingActionSchema, bookingSchema } from "@/backend/validators/engagement.validator";

type Doc<T> = T & { _id: Types.ObjectId };
type Listing =
  | { source: "dealer"; id: string; title: string; doc: Doc<IVehicle> }
  | { source: "private"; id: string; title: string; doc: Doc<IClassifiedAd> };

async function nextNumber() {
  const year = new Date().getFullYear();
  return `BK-${year}-${String(await nextSequence(`BOOKING:${year}`)).padStart(5, "0")}`;
}

async function findListing(id?: string): Promise<Listing | null> {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  const v = await Vehicle.findOne({ _id: id, published: true, status: { $in: ["in_stock", "reserved"] } }).lean<Doc<IVehicle>>();
  if (v) return { source: "dealer", id, title: [v.year, v.make, v.model, v.variant].filter(Boolean).join(" "), doc: v };
  const a = await ClassifiedAd.findOne({ _id: id, status: "active", expiresAt: { $gt: new Date() } }).select("-messages").lean<Doc<IClassifiedAd>>();
  if (a) return { source: "private", id, title: [a.year, a.make, a.model, a.variant].filter(Boolean).join(" "), doc: a };
  return null;
}

/** One mechanic does home inspections; test drives and video calls are per car. */
function slotKey(type: BookingType, date: string, slot: string, listingId?: string) {
  return type === "inspection" ? `inspection|${date}|${slot}` : `${type}|${listingId}|${date}|${slot}`;
}

export const bookingService = {
  async availability(type: BookingType, listingId?: string) {
    await dbConnect();
    const dates = bookableDates();
    const prefix = type === "inspection" ? "inspection|" : `${type}|${listingId}|`;
    const taken = await Booking.find({ slotKey: { $regex: `^${prefix.replace(/[|]/g, "\\|")}` }, date: { $gte: new Date(`${dates[0]}T00:00:00Z`) } })
      .select("slotKey")
      .lean<{ slotKey: string }[]>();
    const busy = new Set(taken.map((t) => t.slotKey));
    return dates.map((date) => ({
      date,
      slots: BOOKING_SLOTS.map((slot) => ({ slot, free: slotIsFuture(date, slot) && !busy.has(slotKey(type, date, slot, listingId)) })),
    }));
  },

  async create(data: z.infer<typeof bookingSchema>, member: MemberSession | null) {
    await dbConnect();
    const listing = await findListing(data.listingId);
    if (data.listingId && !listing) throw new ServiceError("NOT_FOUND", "This vehicle is no longer listed", 404);
    if (data.type === "test_drive" && listing?.source !== "dealer") {
      throw new ServiceError("VALIDATION", "Test drives are booked on showroom cars. For private ads, book a video viewing or an inspection.", 400);
    }
    if (data.type === "video_call" && !listing) throw new ServiceError("VALIDATION", "Choose the car you want to see on video", 400);
    if (data.type === "inspection" && !data.address?.trim()) throw new ServiceError("VALIDATION", "Where should our mechanic come?", 400);
    if (!bookableDates().includes(data.date) || !(BOOKING_SLOTS as readonly string[]).includes(data.slot) || !slotIsFuture(data.date, data.slot)) {
      throw new ServiceError("VALIDATION", "That time is not available. Pick another slot.", 400);
    }
    const key = slotKey(data.type, data.date, data.slot, listing?.id);
    let booking: Doc<IBooking>;
    try {
      booking = (
        await Booking.create({
          number: await nextNumber(),
          type: data.type,
          listingId: listing?.id,
          listingSource: listing?.source,
          listingTitle: listing?.title,
          sellerMemberId: listing?.source === "private" ? listing.doc.memberId : undefined,
          memberId: member?.id,
          name: data.name,
          phone: data.phone,
          date: new Date(`${data.date}T00:00:00Z`),
          slot: data.slot,
          address: data.address || undefined,
          notes: data.notes || undefined,
          slotKey: key,
        })
      ).toObject();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ServiceError("CONFLICT", "Someone just booked that slot. Please pick another time.", 409);
      throw e;
    }
    // Showroom bookings land in the CRM as a lead; private sellers get it in their inbox.
    if (listing) {
      const text = `${BOOKING_LABEL[data.type]} booked for ${data.date} at ${data.slot} (${booking.number})${data.notes ? `. ${data.notes}` : ""}`;
      await marketplaceService
        .inquire(listing.id, { name: data.name, phone: data.phone, intent: data.type === "test_drive" ? "test_drive" : "buy", message: text, email: "", website: "" })
        .catch(() => undefined);
    }
    return booking;
  },

  async mine(member: MemberSession) {
    await dbConnect();
    const [mine, forMyAds] = await Promise.all([
      Booking.find({ memberId: member.id }).sort({ date: -1 }).limit(50).lean<Doc<IBooking>[]>(),
      Booking.find({ sellerMemberId: member.id, status: { $in: ["requested", "confirmed"] } }).sort({ date: 1 }).limit(50).lean<Doc<IBooking>[]>(),
    ]);
    return { mine, forMyAds };
  },

  /** A private seller confirms or cancels a video viewing of their own car. */
  async sellerAct(member: MemberSession, id: string, input: z.infer<typeof bookingActionSchema>) {
    await dbConnect();
    const b = await Booking.findOne({ _id: id, sellerMemberId: member.id });
    if (!b) throw new ServiceError("NOT_FOUND", "Booking not found", 404);
    return this.applyStatus(b, input);
  },

  async list(filter: { status?: string | null; from?: string | null }) {
    await dbConnect();
    const q: Record<string, unknown> = {};
    if (filter.status) q.status = filter.status;
    q.date = { $gte: filter.from ? new Date(filter.from) : new Date(Date.now() - 7 * 86_400_000) };
    const rows = await Booking.find(q).sort({ date: 1, slot: 1 }).limit(500).lean<Doc<IBooking>[]>();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    return { bookings: rows, counts };
  },

  async act(id: string, input: z.infer<typeof bookingActionSchema>, actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Booking not found", 404);
    const b = await Booking.findById(id);
    if (!b) throw new ServiceError("NOT_FOUND", "Booking not found", 404);
    const out = await this.applyStatus(b, input);
    await recordAudit({ module: "dealership", action: input.status, entity: "booking", entityId: id, summary: `${b.number} ${input.status}`, actor });
    return out;
  },

  async applyStatus(b: InstanceType<typeof Booking>, input: z.infer<typeof bookingActionSchema>) {
    const allowed: Record<string, string[]> = { requested: ["confirmed", "cancelled"], confirmed: ["done", "cancelled"], done: [], cancelled: [] };
    if (!allowed[b.status].includes(input.status)) throw new ServiceError("CONFLICT", `A ${b.status} booking cannot be marked ${input.status}`, 409);
    b.status = input.status;
    if (input.staffNote) b.staffNote = input.staffNote;
    if (input.status === "cancelled") b.slotKey = `${b.slotKey}|cancelled|${b._id}`; // frees the slot
    await b.save();
    return b.toObject();
  },
};
