/**
 * HTTP handlers for seller verification, dealer/supplier registration,
 * supplier products and parts search.
 */
import { firstZodError, fromServiceError, jsonError, jsonOk, requireAuth } from "@/backend/lib/http";
import { getMember } from "@/backend/lib/memberSession";
import { tooMany } from "@/backend/lib/rateLimit";
import { partnerService } from "@/backend/services/partner.service";
import { supplierService } from "@/backend/services/supplier.service";
import {
  businessSchema,
  kycSchema,
  partnerReviewSchema,
  partsEnquirySchema,
  supplierProductModerationSchema,
  supplierProductSchema,
} from "@/backend/validators/partner.validator";

type Ctx = { params: Promise<{ id?: string }> };
const idOf = async (ctx: Ctx) => (await ctx.params).id || "";
const LIMITED = () => jsonError("Too many requests, please wait a minute and try again", 429);
const body = (req: Request) => req.json().catch(() => ({}));

type Member = NonNullable<Awaited<ReturnType<typeof getMember>>>;
function member(fn: (m: Member, req: Request, ctx: Ctx) => Promise<Response | object>) {
  return async (req: Request, ctx: Ctx) => {
    const m = await getMember();
    if (!m) return jsonError("Please log in to continue", 401);
    try {
      const out = await fn(m, req, ctx);
      return out instanceof Response ? out : jsonOk(out);
    } catch (e) {
      return fromServiceError(e);
    }
  };
}

function staff(roles: ("admin" | "staff")[] | undefined, fn: (s: NonNullable<Awaited<ReturnType<typeof requireAuth>>["session"]>, req: Request, ctx: Ctx) => Promise<Response | object>) {
  return async (req: Request, ctx: Ctx) => {
    const { session, error } = await requireAuth(roles);
    if (error) return error;
    try {
      const out = await fn(session!, req, ctx);
      return out instanceof Response ? out : jsonOk(out);
    } catch (e) {
      return fromServiceError(e);
    }
  };
}

export const partnerController = {
  mine: member(async (m) => partnerService.mine(m)),
  submitKyc: member(async (m, req) => {
    if (tooMany(req, "kyc-submit", 10, 60 * 60_000, m.id)) return LIMITED();
    const parsed = kycSchema.safeParse(await body(req));
    if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
    return partnerService.submitKyc(m, parsed.data);
  }),
  applyBusiness: member(async (m, req) => {
    const parsed = businessSchema.safeParse(await body(req));
    if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
    return partnerService.applyBusiness(m, parsed.data);
  }),
  async directory(req: Request) {
    try {
      const p = new URL(req.url).searchParams;
      return jsonOk({ businesses: await partnerService.directory(p.get("type") === "supplier" ? "supplier" : "dealer", p.get("city")) });
    } catch (e) {
      return fromServiceError(e);
    }
  },

  /* staff */
  queue: staff(undefined, async (_s, req) => {
    const p = new URL(req.url).searchParams;
    return partnerService.queue({ kyc: p.get("kyc"), business: p.get("business"), type: p.get("type") });
  }),
  review: staff(["admin"], async (s, req, ctx) => {
    const parsed = partnerReviewSchema.safeParse(await body(req));
    if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
    return partnerService.review(await idOf(ctx), parsed.data, s);
  }),
  identity: staff(["admin"], async (s, _req, ctx) => partnerService.reveal(await idOf(ctx), s)),
};

export const supplierController = {
  mine: member(async (m) => ({ products: await supplierService.mine(m) })),
  create: member(async (m, req) => {
    if (tooMany(req, "supplier-product", 120, 60 * 60_000, m.id)) return LIMITED();
    const parsed = supplierProductSchema.safeParse(await body(req));
    if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
    return jsonOk({ product: await supplierService.create(m, parsed.data) }, 201);
  }),
  update: member(async (m, req, ctx) => {
    const parsed = supplierProductSchema.safeParse(await body(req));
    if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
    return { product: await supplierService.update(m, await idOf(ctx), parsed.data) };
  }),
  remove: member(async (m, _req, ctx) => supplierService.remove(m, await idOf(ctx))),
  readMessages: member(async (m, _req, ctx) => supplierService.readMessages(m, await idOf(ctx))),

  async search(req: Request) {
    try {
      const p = new URL(req.url).searchParams;
      const kind = p.get("kind");
      return jsonOk(
        await supplierService.search({
          q: p.get("q") || undefined,
          category: p.get("category") || undefined,
          city: p.get("city") || undefined,
          kind: kind === "bike" || kind === "car" ? kind : undefined,
          make: p.get("make") || undefined,
          model: p.get("model") || undefined,
          year: Number(p.get("year")) || undefined,
          universal: p.get("universal") === "1",
          supplierId: p.get("supplier") || undefined,
          page: Number(p.get("page")) || 1,
          sort: p.get("sort") || undefined,
        })
      );
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async one(_req: Request, ctx: Ctx) {
    try {
      return jsonOk({ part: await supplierService.one(await idOf(ctx), false) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async enquire(req: Request, ctx: Ctx) {
    if (tooMany(req, "part-enquiry", 8, 10 * 60_000)) return LIMITED();
    try {
      const parsed = partsEnquirySchema.safeParse(await body(req));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk(await supplierService.enquire(await idOf(ctx), parsed.data));
    } catch (e) {
      return fromServiceError(e);
    }
  },
  staffList: staff(undefined, async (_s, req) => ({ products: await supplierService.staffList(new URL(req.url).searchParams.get("status")) })),
  moderate: staff(undefined, async (s, req, ctx) => {
    const parsed = supplierProductModerationSchema.safeParse(await body(req));
    if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
    return supplierService.moderate(await idOf(ctx), parsed.data, s);
  }),
};
