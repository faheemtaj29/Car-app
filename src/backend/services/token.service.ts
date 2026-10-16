/**
 * Safe token: a buyer holds a showroom car by sending token money to the
 * showroom's own account and submitting the transaction reference here.
 *
 *   requested → (staff confirm the money arrived) verified → applied | refunded
 *   requested → cancelled (money never arrived / rejected)
 *
 * Verifying opens a deal with the token as its first payment, so the car is
 * reserved atomically and the receipt is booked as a customer deposit by the
 * same tested code path as any showroom deposit. Refunding cancels that deal,
 * which releases the car and reverses the receipt.
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { AccountingCounter } from "@/backend/models/Accounting";
import { nextSequence } from "@/backend/lib/sequence";
import { DealerCustomer, Vehicle, type IVehicle } from "@/backend/models/Dealership";
import { TokenRequest, type ITokenRequest } from "@/backend/models/Engagement";
import { ServiceError, type SessionUser } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { recordAudit } from "@/backend/lib/audit";
import { dealService } from "@/backend/services/dealership.service";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { settingsService } from "@/backend/services/settings.service";
import type { tokenActionSchema, tokenRequestSchema } from "@/backend/validators/engagement.validator";

type Doc<T> = T & { _id: Types.ObjectId };
const PAYMENT_METHOD = { bank_transfer: "bank", jazzcash: "online", easypaisa: "online", cash: "cash" } as const;

async function nextNumber() {
  const year = new Date().getFullYear();
  return `TK-${year}-${String(await nextSequence(`TOKEN:${year}`)).padStart(5, "0")}`;
}

export const tokenService = {
  /** What the car page needs to show the Safe token box. */
  async publicInfo() {
    const s = await settingsService.get();
    return { enabled: Boolean(s.tokenEnabled && s.tokenInstructions), instructions: s.tokenInstructions || "", holdDays: s.tokenHoldDays || 7 };
  },

  async create(data: z.infer<typeof tokenRequestSchema>, member: MemberSession | null) {
    await dbConnect();
    const info = await this.publicInfo();
    if (!info.enabled) throw new ServiceError("FORBIDDEN", "Online token is not available right now. Please contact the showroom.", 403);
    if (!Types.ObjectId.isValid(data.vehicleId)) throw new ServiceError("NOT_FOUND", "Vehicle not found", 404);
    const v = await Vehicle.findOne({ _id: data.vehicleId, published: true }).lean<Doc<IVehicle>>();
    if (!v) throw new ServiceError("NOT_FOUND", "This car is not available for online token", 404);
    if (v.status !== "in_stock") throw new ServiceError("CONFLICT", "This car is already reserved. Join the waitlist by contacting the showroom.", 409);
    if (data.amount > v.listPrice) throw new ServiceError("VALIDATION", "Token cannot be more than the car's price", 400);
    const ref = data.reference.toUpperCase().replace(/\s+/g, "");
    if (await TokenRequest.exists({ reference: ref, status: { $ne: "cancelled" } })) {
      throw new ServiceError("CONFLICT", "This transaction reference has already been submitted", 409);
    }
    const title = [v.year, v.make, v.model, v.variant].filter(Boolean).join(" ");
    const token = await TokenRequest.create({
      number: await nextNumber(),
      vehicleId: v._id,
      vehicleTitle: `${title} (${v.stockNo})`,
      memberId: member?.id,
      name: data.name,
      phone: data.phone,
      cnicLast4: data.cnicLast4 || undefined,
      amount: data.amount,
      method: data.method,
      reference: ref,
    });
    // The buyer also becomes a hot lead in the CRM right away.
    await marketplaceService
      .inquire(String(v._id), { name: data.name, phone: data.phone, intent: "buy", message: `Safe token ${token.number}: sent ${data.amount.toLocaleString()} via ${data.method.replace("_", " ")}, ref ${ref}`, email: "", website: "" })
      .catch(() => undefined);
    return token.toObject();
  },

  async mine(member: MemberSession) {
    await dbConnect();
    return TokenRequest.find({ memberId: member.id }).sort({ createdAt: -1 }).limit(20).lean<Doc<ITokenRequest>[]>();
  },

  async list(status?: string | null) {
    await dbConnect();
    const rows = await TokenRequest.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(300).lean<Doc<ITokenRequest>[]>();
    const counts: Record<string, number> = {};
    for (const r of await TokenRequest.find({}).select("status").lean<{ status: string }[]>()) counts[r.status] = (counts[r.status] || 0) + 1;
    return { tokens: rows, counts };
  },

  async act(id: string, input: z.infer<typeof tokenActionSchema>, actor: SessionUser) {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Token not found", 404);
    const t = await TokenRequest.findById(id);
    if (!t) throw new ServiceError("NOT_FOUND", "Token not found", 404);
    const now = new Date();

    if (input.action === "verify") {
      if (t.status !== "requested") throw new ServiceError("CONFLICT", `A ${t.status} token cannot be verified`, 409);
      // Two staff pressing Verify must not open two deals. Inserting a record
      // with a fixed _id is atomic on every MongoDB-compatible store, so the
      // second press fails here before touching anything.
      const lockId = `LOCK:token-verify:${t._id}`;
      try {
        await AccountingCounter.create({ _id: lockId, seq: 0 });
      } catch (e) {
        if ((e as { code?: number }).code === 11000) throw new ServiceError("CONFLICT", "Someone else is already handling this token", 409);
        throw e;
      }
      await TokenRequest.updateOne({ _id: t._id }, { $set: { status: "verified", verifiedAt: now } });
      const unclaim = async () => {
        await TokenRequest.updateOne({ _id: t._id }, { $set: { status: "requested" }, $unset: { verifiedAt: 1 } });
        await AccountingCounter.deleteOne({ _id: lockId });
      };
      const v = await Vehicle.findById(t.vehicleId).lean<Doc<IVehicle>>();
      const customer = await DealerCustomer.findOne({ phone: t.phone });
      if (!v || !customer) {
        await unclaim();
        throw new ServiceError("NOT_FOUND", !v ? "The car no longer exists" : "Buyer's lead not found", 404);
      }
      if (customer.stage === "lost") {
        customer.stage = "negotiation";
        await customer.save();
      }
      let dealId: string | undefined;
      try {
        const deal = await dealService.create(
          { customerId: String(customer._id), vehicleId: String(v._id), salePrice: v.listPrice, discount: 0, tradeInAllowance: 0, tradeInPayoff: 0, includeTradeIn: false, taxAmount: 0, registrationFee: 0, otherFees: 0, commissionRate: 0, reserve: false, notes: `Opened from safe token ${t.number}` },
          actor
        );
        dealId = String(deal._id);
        // The payment reserves the car atomically (fails if someone else holds it).
        const paid = await dealService.act(dealId, { action: "payment", payment: { amount: t.amount, method: PAYMENT_METHOD[t.method as keyof typeof PAYMENT_METHOD], reference: `${t.number} · ${t.reference}`, note: "Safe token" } }, actor);
        const holdDays = input.holdDays || (await this.publicInfo()).holdDays;
        await TokenRequest.updateOne(
          { _id: t._id },
          { $set: { dealId: deal._id, dealNumber: paid.number, holdUntil: new Date(now.getTime() + holdDays * 86_400_000), staffNote: input.staffNote } }
        );
      } catch (e) {
        if (dealId) await dealService.act(dealId, { action: "cancel", reason: `Token ${t.number} could not be verified` }, actor).catch(() => undefined);
        await unclaim();
        throw e;
      }
      await recordAudit({ module: "dealership", action: "token_verified", entity: "token", entityId: id, summary: `${t.number} verified, ${t.amount.toLocaleString()} for ${t.vehicleTitle}`, actor });
      return TokenRequest.findById(t._id).lean();
    }

    if (input.action === "reject") {
      if (t.status !== "requested") throw new ServiceError("CONFLICT", `A ${t.status} token cannot be rejected`, 409);
      t.status = "cancelled";
    } else if (input.action === "refund") {
      if (t.status !== "verified") throw new ServiceError("CONFLICT", "Only a verified token can be refunded", 409);
      if (t.dealId) await dealService.act(String(t.dealId), { action: "cancel", reason: `Token ${t.number} refunded: ${input.staffNote}` }, actor);
      t.status = "refunded";
    } else {
      if (t.status !== "verified") throw new ServiceError("CONFLICT", "Only a verified token can be applied to the sale", 409);
      t.status = "applied";
    }
    t.closedAt = now;
    if (input.staffNote) t.staffNote = input.staffNote;
    await t.save();
    await recordAudit({ module: "dealership", action: `token_${input.action}`, entity: "token", entityId: id, summary: `${t.number} ${t.status}`, actor });
    return t.toObject();
  },
};
