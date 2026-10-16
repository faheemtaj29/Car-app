import { firstZodError, fromServiceError, jsonError, jsonOk } from "@/backend/lib/http";
import { clearSessionCookie, getSession } from "@/backend/lib/cookies";
import { tooMany } from "@/backend/lib/rateLimit";
import { authService } from "@/backend/services/auth.service";
import { loginSchema, setupSchema } from "@/backend/validators/erp.validator";

export const authController = {
  async login(req: Request) {
    if (tooMany(req, "staff-login", 10, 5 * 60_000)) return jsonError("Too many attempts, wait a few minutes", 429);
    try {
      const parsed = loginSchema.safeParse(await req.json());
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk(await authService.login(parsed.data));
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async setupStatus() {
    try {
      return jsonOk({ needsSetup: await authService.needsSetup() });
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async setup(req: Request) {
    try {
      const parsed = setupSchema.safeParse(await req.json());
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk(await authService.setup(parsed.data), 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async me() {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk({ user: session });
  },

  async logout() {
    await clearSessionCookie();
    return jsonOk({ ok: true });
  },
};
