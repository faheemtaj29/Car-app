/**
 * HTTP handlers for buyer-engagement features: My Garage, bookings, reviews,
 * instant offers, alerts and safe token payments.
 */
import { NextResponse } from "next/server";
import { firstZodError, fromServiceError, jsonError, jsonOk, requireAuth } from "@/backend/lib/http";
import { getMember } from "@/backend/lib/memberSession";
import { tooMany } from "@/backend/lib/rateLimit";
import { garageService } from "@/backend/services/garage.service";
import { remindersToIcs } from "@/lib/garage";
import { bookingService } from "@/backend/services/booking.service";
import { offerService } from "@/backend/services/offer.service";
import { reviewService } from "@/backend/services/review.service";
import { alertService } from "@/backend/services/alert.service";
import { tokenService } from "@/backend/services/token.service";
import { alertSchema, tokenActionSchema, tokenRequestSchema, bookingActionSchema, bookingSchema, garageCarSchema, instantOfferSchema, reviewModerationSchema, reviewSchema, serviceEntrySchema } from "@/backend/validators/engagement.validator";

type Ctx = { params: Promise<{ id?: string }> };
const idOf = async (ctx: Ctx) => (await ctx.params).id || "";
const LIMITED = () => jsonError("Too many requests, please wait a minute and try again", 429);

class BadInput extends Error {}

async function requireMember() {
  const member = await getMember();
  return member ? { member, error: null } : { member: null, error: jsonError("Please log in to continue", 401) };
}

/** Wraps a member-only handler: login check, JSON body parsing, error mapping. */
function memberRoute<T>(fn: (member: NonNullable<Awaited<ReturnType<typeof getMember>>>, req: Request, ctx: Ctx) => Promise<T>) {
  return async (req: Request, ctx: Ctx) => {
    const { member, error } = await requireMember();
    if (error) return error;
    try {
      const out = await fn(member!, req, ctx);
      return out instanceof Response ? out : jsonOk(out);
    } catch (e) {
      if (e instanceof BadInput) return jsonError(e.message, 400);
      return fromServiceError(e);
    }
  };
}

async function parse<S extends { safeParse: (x: unknown) => { success: boolean; data?: unknown; error?: { issues: { message: string }[] } } }>(req: Request, schema: S) {
  const body = await req.json().catch(() => ({}));
  const r = schema.safeParse(body);
  if (!r.success) throw new BadInput(firstZodError(r.error!.issues));
  return r.data as S extends { safeParse: (x: unknown) => { data?: infer D } } ? NonNullable<D> : never;
}

export const garageController = {
  list: memberRoute(async (m) => ({ cars: await garageService.list(m) })),
  create: memberRoute(async (m, req) => {
      if (tooMany(req, "garage-write", 60, 60 * 60_000, m.id)) return LIMITED();
      return NextResponse.json({ car: await garageService.create(m, await parse(req, garageCarSchema)) }, { status: 201 });
    }),
  one: memberRoute(async (m, _req, ctx) => ({ car: await garageService.one(m, await idOf(ctx)) })),
  update: memberRoute(async (m, req, ctx) => ({ car: await garageService.update(m, await idOf(ctx), await parse(req, garageCarSchema)) })),
  remove: memberRoute(async (m, _req, ctx) => garageService.remove(m, await idOf(ctx))),
  logService: memberRoute(async (m, req, ctx) => {
      if (tooMany(req, "garage-write", 60, 60 * 60_000, m.id)) return LIMITED();
      return { car: await garageService.logService(m, await idOf(ctx), await parse(req, serviceEntrySchema)) };
    }),
  removeService: memberRoute(async (m, req, ctx) => {
    const entry = new URL(req.url).searchParams.get("entry") || "";
    return { car: await garageService.removeService(m, await idOf(ctx), entry) };
  }),
  parts: memberRoute(async (m, _req, ctx) => garageService.parts(m, await idOf(ctx))),
  sell: memberRoute(async (m, _req, ctx) => garageService.sellSummary(m, await idOf(ctx))),
  calendar: memberRoute(async (m, _req, ctx) => {
    const car = await garageService.one(m, await idOf(ctx));
    const ics = remindersToIcs(`${car.year} ${car.make} ${car.model}`, car.reminders);
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="garage-${car._id}.ics"`,
      },
    });
  }),
};


/* ------------------------------------------------------------ bookings */


const BOOKING_TYPES_SET = new Set(["test_drive", "inspection", "video_call"]);

export const bookingController = {
  async slots(req: Request) {
    try {
      const p = new URL(req.url).searchParams;
      const type = p.get("type") || "";
      if (!BOOKING_TYPES_SET.has(type)) return jsonError("Unknown booking type");
      return jsonOk({ days: await bookingService.availability(type as "test_drive", p.get("listing") || undefined) });
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async create(req: Request) {
    if (tooMany(req, "booking", 6, 10 * 60_000)) return LIMITED();
    try {
      const parsed = bookingSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ booking: await bookingService.create(parsed.data, await getMember()) }, 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },

  mine: memberRoute(async (m) => bookingService.mine(m)),
  sellerAct: memberRoute(async (m, req, ctx) => ({ booking: await bookingService.sellerAct(m, await idOf(ctx), await parse(req, bookingActionSchema)) })),

  async staffList(req: Request) {
    const { error } = await requireAuth();
    if (error) return error;
    try {
      const p = new URL(req.url).searchParams;
      return jsonOk(await bookingService.list({ status: p.get("status"), from: p.get("from") }));
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async staffAct(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth();
    if (error) return error;
    try {
      const parsed = bookingActionSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ booking: await bookingService.act(await idOf(ctx), parsed.data, session!) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

/* ---------------------------------------------------- reviews & trust */

export const reviewController = {
  async trust(req: Request) {
    try {
      const p = new URL(req.url).searchParams;
      const type = p.get("targetType") === "member" ? "member" : "dealer";
      return jsonOk(await reviewService.trust(type, (p.get("targetId") || "").slice(0, 40)));
    } catch (e) {
      return fromServiceError(e);
    }
  },
  write: memberRoute(async (m, req) => {
    if (tooMany(req, "review", 10, 60 * 60_000, m.id)) return LIMITED();
    return { review: await reviewService.upsert(m, await parse(req, reviewSchema)) };
  }),
  async staffList(req: Request) {
    const { error } = await requireAuth();
    if (error) return error;
    try {
      return jsonOk({ reviews: await reviewService.staffList(new URL(req.url).searchParams.get("status")) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async moderate(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth();
    if (error) return error;
    try {
      const parsed = reviewModerationSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ review: await reviewService.moderate(await idOf(ctx), parsed.data.status, session!) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async verifyMember(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const body = await req.json().catch(() => ({}));
      return jsonOk({ member: await reviewService.setMemberVerified(await idOf(ctx), body.verified === true, session!) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

/* ------------------------------------------------------- instant offer */

export const offerController = {
  async instant(req: Request) {
    if (tooMany(req, "instant-offer", 20, 10 * 60_000)) return LIMITED();
    try {
      const parsed = instantOfferSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ offer: await offerService.instant(parsed.data) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

/* -------------------------------------------------------------- alerts */

export const alertController = {
  list: memberRoute(async (m) => ({ alerts: await alertService.list(m) })),
  create: memberRoute(async (m, req) => {
    if (tooMany(req, "alert", 30, 60 * 60_000, m.id)) return LIMITED();
    return NextResponse.json({ alert: await alertService.create(m, await parse(req, alertSchema)) }, { status: 201 });
  }),
  seen: memberRoute(async (m, _req, ctx) => alertService.seen(m, await idOf(ctx))),
  remove: memberRoute(async (m, _req, ctx) => alertService.remove(m, await idOf(ctx))),
  /** Header badge: unseen alerts + garage reminders due. Logged-out visitors get zeros. */
  async badges() {
    const m = await getMember();
    if (!m) return jsonOk({ loggedIn: false, alerts: 0, garage: 0 });
    try {
      const [alerts, garage] = await Promise.all([alertService.unseen(m), garageService.attentionCount(m)]);
      return jsonOk({ loggedIn: true, alerts, garage });
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

/* ---------------------------------------------------------- safe token */

export const tokenController = {
  async create(req: Request) {
    if (tooMany(req, "token", 5, 60 * 60_000)) return LIMITED();
    try {
      const parsed = tokenRequestSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      const t = await tokenService.create(parsed.data, await getMember());
      return jsonOk({ token: { number: t.number, status: t.status, amount: t.amount, vehicleTitle: t.vehicleTitle } }, 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },
  mine: memberRoute(async (m) => ({ tokens: await tokenService.mine(m) })),
  async staffList(req: Request) {
    const { error } = await requireAuth();
    if (error) return error;
    try {
      return jsonOk(await tokenService.list(new URL(req.url).searchParams.get("status")));
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async staffAct(req: Request, ctx: Ctx) {
    // Money moves: verifying or refunding a token is for admins only.
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const parsed = tokenActionSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ token: await tokenService.act(await idOf(ctx), parsed.data, session!) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
};
