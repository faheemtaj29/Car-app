/**
 * New Cars catalogue — brand-new vehicles with variant pricing and quote requests.
 */
import { dbConnect } from "@/backend/config/database";
import { NewCar, type INewCar, type INewCarVariant } from "@/backend/models/NewCar";
import { ServiceError, type Doc } from "@/backend/types";

export type PublicNewCar = {
  _id: string;
  vehicleType: "car" | "bike";
  make: string;
  model: string;
  year: number;
  bodyType?: string;
  fuel?: string;
  engineCc?: number;
  color?: string[];
  photos: string[];
  variants: INewCarVariant[];
  specs?: Record<string, string | number | boolean>;
  features?: string[];
  brochureUrl?: string;
  minPrice: number;
  maxPrice: number;
};

type QuoteInput = { name: string; phone: string; city: string; variant?: string; message?: string };
type NewCarInput = Omit<INewCar, "quotes" | "createdAt" | "updatedAt">;

function toPublic(doc: Doc<INewCar>): PublicNewCar {
  const prices = doc.variants.map((v) => v.price).filter(Boolean);
  return {
    _id: String(doc._id),
    vehicleType: doc.vehicleType,
    make: doc.make,
    model: doc.model,
    year: doc.year,
    bodyType: doc.bodyType,
    fuel: doc.fuel,
    engineCc: doc.engineCc,
    color: doc.color,
    photos: doc.photos,
    variants: doc.variants,
    specs: doc.specs,
    features: doc.features,
    brochureUrl: doc.brochureUrl,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

export const newCarService = {
  async list(filters: { type?: "car" | "bike"; make?: string; q?: string } = {}): Promise<PublicNewCar[]> {
    await dbConnect();
    const query: Record<string, unknown> = { published: true };
    if (filters.type) query.vehicleType = filters.type;
    if (filters.make) query.make = filters.make;
    if (filters.q) {
      const re = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ make: re }, { model: re }, { bodyType: re }];
    }
    const docs = await NewCar.find(query).sort({ sortOrder: 1, make: 1, model: 1 }).limit(200).lean<Doc<INewCar>[]>();
    return docs.map(toPublic);
  },

  async get(id: string): Promise<PublicNewCar | null> {
    await dbConnect();
    const doc = await NewCar.findOne({ _id: id, published: true }).lean<Doc<INewCar>>();
    return doc ? toPublic(doc) : null;
  },

  async quote(id: string, input: QuoteInput): Promise<void> {
    await dbConnect();
    const car = await NewCar.findOne({ _id: id, published: true });
    if (!car) throw new ServiceError("NOT_FOUND", "Car not found", 404);
    if (!input.name?.trim() || !input.phone?.trim() || !input.city?.trim())
      throw new ServiceError("VALIDATION", "Name, phone and city are required", 400);
    car.quotes.push({
      name: input.name.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      variant: input.variant?.trim(),
      message: input.message?.trim(),
      createdAt: new Date(),
      status: "new",
    });
    await car.save();
    console.info(`[new-car-quote] ${car.make} ${car.model} — ${input.name} ${input.phone} ${input.city}`);
  },

  // ---- Admin ----

  async adminList(): Promise<(Doc<INewCar> & { quoteCount: number })[]> {
    await dbConnect();
    const docs = await NewCar.find({}).sort({ sortOrder: 1, make: 1, model: 1 }).lean<Doc<INewCar>[]>();
    return docs.map((d) => ({ ...d, quoteCount: (d.quotes || []).filter((q) => q.status === "new").length }));
  },

  async adminGet(id: string): Promise<Doc<INewCar> | null> {
    await dbConnect();
    return NewCar.findById(id).lean<Doc<INewCar>>();
  },

  async create(input: Partial<NewCarInput>): Promise<Doc<INewCar>> {
    await dbConnect();
    const doc = await NewCar.create({ ...input, quotes: [] });
    return doc.toObject();
  },

  async update(id: string, input: Partial<NewCarInput>): Promise<Doc<INewCar>> {
    await dbConnect();
    const doc = await NewCar.findByIdAndUpdate(id, { $set: input }, { new: true }).lean<Doc<INewCar>>();
    if (!doc) throw new ServiceError("NOT_FOUND", "Not found", 404);
    return doc;
  },

  async delete(id: string): Promise<void> {
    await dbConnect();
    await NewCar.findByIdAndDelete(id);
  },

  async updateQuote(carId: string, quoteId: string, status: "contacted" | "closed"): Promise<void> {
    await dbConnect();
    await NewCar.updateOne({ _id: carId, "quotes._id": quoteId }, { $set: { "quotes.$.status": status } });
  },
};
