/**
 * My Garage: the member's own cars, service log and reminders. Keeps people
 * coming back after they buy, and turns "oil change due" into a shop sale.
 */
import type { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/backend/config/database";
import { GarageCar, type IGarageCar } from "@/backend/models/Engagement";
import { ServiceError } from "@/backend/types";
import type { MemberSession } from "@/backend/lib/memberSession";
import { estimatedKm, needsAttention, reminders } from "@/lib/garage";
import type { garageCarSchema, serviceEntrySchema } from "@/backend/validators/engagement.validator";
import { shopService } from "@/backend/services/shop.service";

type Doc<T> = T & { _id: Types.ObjectId };
const MAX_CARS = 10;
const MAX_LOG = 300;

function withReminders(c: Doc<IGarageCar>) {
  const rs = reminders(c);
  return { ...c, _id: String(c._id), estimatedKm: estimatedKm(c), reminders: rs, attention: needsAttention(rs) };
}

async function owned(member: MemberSession, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ServiceError("NOT_FOUND", "Car not found", 404);
  const car = await GarageCar.findOne({ _id: id, memberId: member.id });
  if (!car) throw new ServiceError("NOT_FOUND", "Car not found", 404);
  return car;
}

const toDate = (v?: string) => (v ? new Date(v) : undefined);

export const garageService = {
  async list(member: MemberSession) {
    await dbConnect();
    const cars = await GarageCar.find({ memberId: member.id }).sort({ createdAt: 1 }).lean<Doc<IGarageCar>[]>();
    return cars.map(withReminders);
  },

  /** Count of reminders that are due or overdue across the member's cars (header badge). */
  async attentionCount(member: MemberSession) {
    const cars = await this.list(member);
    return cars.reduce((s, c) => s + c.attention, 0);
  },

  async create(member: MemberSession, data: z.infer<typeof garageCarSchema>) {
    await dbConnect();
    if ((await GarageCar.countDocuments({ memberId: member.id })) >= MAX_CARS) {
      throw new ServiceError("CONFLICT", `You can keep up to ${MAX_CARS} cars in your garage`, 409);
    }
    const car = await GarageCar.create({
      ...data,
      memberId: member.id,
      kmUpdatedAt: new Date(),
      tokenTaxDue: toDate(data.tokenTaxDue),
      insuranceDue: toDate(data.insuranceDue),
    });
    return withReminders(car.toObject());
  },

  async update(member: MemberSession, id: string, data: z.infer<typeof garageCarSchema>) {
    await dbConnect();
    const car = await owned(member, id);
    const kmChanged = data.km !== car.km;
    Object.assign(car, {
      ...data,
      tokenTaxDue: toDate(data.tokenTaxDue),
      insuranceDue: toDate(data.insuranceDue),
    });
    if (kmChanged) car.kmUpdatedAt = new Date();
    await car.save();
    return withReminders(car.toObject());
  },

  async remove(member: MemberSession, id: string) {
    await dbConnect();
    const car = await owned(member, id);
    await car.deleteOne();
    return { ok: true };
  },

  /** Logs a service; oil changes, services, tax and insurance also move their reminders. */
  async logService(member: MemberSession, id: string, entry: z.infer<typeof serviceEntrySchema>) {
    await dbConnect();
    const car = await owned(member, id);
    const date = toDate(entry.date) || new Date();
    if (date.getTime() > Date.now() + 86_400_000) throw new ServiceError("VALIDATION", "Service date cannot be in the future", 400);
    car.serviceLog.push({ date, km: entry.km, type: entry.type, cost: entry.cost, garage: entry.garage, notes: entry.notes });
    car.serviceLog.sort((a: { date: Date }, b: { date: Date }) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (car.serviceLog.length > MAX_LOG) car.serviceLog = car.serviceLog.slice(0, MAX_LOG);
    if (entry.type === "Oil change") car.lastOilKm = Math.max(car.lastOilKm ?? 0, entry.km);
    if (entry.type === "General service") {
      car.lastServiceKm = Math.max(car.lastServiceKm ?? 0, entry.km);
      car.lastOilKm = Math.max(car.lastOilKm ?? 0, entry.km); // a full service includes the oil
    }
    if (entry.type === "Token tax paid") car.tokenTaxDue = toDate(entry.nextDue) || new Date(date.getTime() + 365 * 86_400_000);
    if (entry.type === "Insurance renewed") car.insuranceDue = toDate(entry.nextDue) || new Date(date.getTime() + 365 * 86_400_000);
    // A newer odometer reading than our estimate resets the estimate.
    if (entry.km > estimatedKm(car.toObject())) {
      car.km = entry.km;
      car.kmUpdatedAt = date;
    }
    await car.save();
    return withReminders(car.toObject());
  },

  async removeService(member: MemberSession, id: string, entryId: string) {
    await dbConnect();
    const car = await owned(member, id);
    car.serviceLog = car.serviceLog.filter((e: { _id: Types.ObjectId }) => String(e._id) !== entryId);
    await car.save();
    return withReminders(car.toObject());
  },

  async one(member: MemberSession, id: string) {
    await dbConnect();
    return withReminders((await owned(member, id)).toObject());
  },

  /** Shop products that fit this car: exact model first, then make, then universal. */
  async parts(member: MemberSession, id: string) {
    const car = await this.one(member, id);
    const kind = car.vehicleType;
    const [byModel, byMake, oils] = await Promise.all([
      shopService.catalogue({ fit: kind, q: car.model }).catch(() => ({ products: [] })),
      shopService.catalogue({ fit: kind, q: car.make }).catch(() => ({ products: [] })),
      shopService.catalogue({ fit: kind, category: "Engine Oil" }).catch(() => ({ products: [] })),
    ]);
    const due = car.reminders.some((r) => r.key === "oil" && (r.status === "overdue" || r.status === "soon"));
    const seen = new Set<string>();
    const pick = (list: { _id: string }[]) => list.filter((p) => !seen.has(p._id) && seen.add(p._id));
    const ordered = due
      ? [...pick(oils.products), ...pick(byModel.products), ...pick(byMake.products)]
      : [...pick(byModel.products), ...pick(byMake.products), ...pick(oils.products)];
    return { products: ordered.slice(0, 8), oilDue: due };
  },

  /** Text block appended to an ad when the owner sells a garage car. */
  async sellSummary(member: MemberSession, id: string) {
    const car = await this.one(member, id);
    const log = car.serviceLog
      .slice(0, 15)
      .map((e) => `• ${new Date(e.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} — ${e.type} at ${e.km.toLocaleString()} km${e.garage ? ` (${e.garage})` : ""}`);
    return {
      car,
      description: log.length ? `Service record kept on this site:\n${log.join("\n")}` : "",
    };
  },
};
