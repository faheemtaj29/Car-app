/**
 * Back-office HTTP handlers: settings, staff users, accounting, inventory.
 */
import {
  firstZodError,
  fromServiceError,
  jsonError,
  jsonOk,
  requireAuth,
} from "@/backend/lib/http";
import { settingsService } from "@/backend/services/settings.service";
import { authService } from "@/backend/services/auth.service";
import { accountingService } from "@/backend/services/accounting.service";
import { inventoryService } from "@/backend/services/inventory.service";
import {
  settingsSchema,
  optionListSchema,
  userSchema,
  ledgerSchema,
  inventorySchema,
  stockVoucherSchema,
  accountSchema,
  voucherSchema,
  voucherActionSchema,
} from "@/backend/validators/erp.validator";

type Ctx = { params: Promise<{ id: string }> };

export const settingsController = {
  async get() {
    const { error } = await requireAuth();
    if (error) return error;
    try {
      return jsonOk({ settings: await settingsService.get() });
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async update(req: Request) {
    const { error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const parsed = settingsSchema.safeParse(await req.json());
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ settings: await settingsService.update(parsed.data) });
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async addOption(req: Request) {
    const { error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const parsed = optionListSchema.safeParse(await req.json());
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ value: await settingsService.addOption(parsed.data.key, parsed.data.value) }, 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

export const usersController = {
  async list() {
    const { error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      return jsonOk({ users: await authService.listUsers() });
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async create(req: Request) {
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const parsed = userSchema.safeParse(await req.json());
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ user: await authService.saveUser(null, parsed.data, session!) }, 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async update(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const { id } = await ctx.params;
      const parsed = userSchema.safeParse(await req.json());
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ user: await authService.saveUser(id, parsed.data, session!) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

export const accountingController = {
  async list(req: Request) {
    const { error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const url = new URL(req.url);
      const view = url.searchParams.get("view");
      const type = url.searchParams.get("type");
      const status = url.searchParams.get("status");
      const branchCode = url.searchParams.get("branch");
      const range = {
        branchCode,
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      };
      if (view === "accounts") {
        return jsonOk({ accounts: await accountingService.accounts() });
      }
      if (view === "vouchers") {
        return jsonOk({
          vouchers: await accountingService.vouchers({ type, status, branchCode }),
        });
      }
      if (view === "next-voucher-number") {
        const voucherType = url.searchParams.get("type") || "journal";
        const date = url.searchParams.get("date") || new Date().toISOString();
        return jsonOk({
          number: await accountingService.nextVoucherNumberPreview(
            voucherType,
            branchCode || "MAIN",
            date
          ),
        });
      }
      if (view === "audit-log") {
        const voucherId = url.searchParams.get("voucherId");
        if (!voucherId) return jsonError("Select a voucher to view its audit history");
        return jsonOk({ events: await accountingService.auditTrail(voucherId) });
      }
      if (view === "trial-balance") {
        return jsonOk(await accountingService.trialBalance(range));
      }
      if (view === "statements") {
        return jsonOk(await accountingService.statements(range));
      }
      if (view === "profit-loss") {
        return jsonOk(await accountingService.profitAndLoss(range));
      }
      if (view === "balance-sheet") {
        return jsonOk(await accountingService.balanceSheet(range));
      }
      if (view === "day-book") {
        return jsonOk(await accountingService.dayBook(range));
      }
      if (view === "general-ledger") {
        const accountCode = url.searchParams.get("account");
        if (!accountCode) return jsonError("Select an account to view its ledger");
        return jsonOk(await accountingService.generalLedger({ ...range, accountCode }));
      }
      const [entries, summary] = await Promise.all([
        accountingService.list(type, branchCode),
        accountingService.summary(branchCode),
      ]);
      return jsonOk({ entries, summary });
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async create(req: Request) {
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const body = await req.json();
      if (body.kind === "seed") {
        return jsonOk(await accountingService.seedAccounts(), 201);
      }
      if (body.kind === "account") {
        const parsed = accountSchema.safeParse(body.account);
        if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
        return jsonOk({ account: await accountingService.createAccount(parsed.data) }, 201);
      }
      if (body.kind === "voucher") {
        const parsed = voucherSchema.safeParse(body.voucher);
        if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
        return jsonOk(
          { voucher: await accountingService.createVoucher(parsed.data, session!) },
          201
        );
      }
      if (body.kind === "reconcile") {
        return jsonOk({
          entry: await accountingService.setReconciled(body.id, Boolean(body.reconciled)),
        });
      }
      if (body.kind === "wht") {
        return jsonOk({ entry: await accountingService.applyWht(body.id) });
      }
      const parsed = ledgerSchema.safeParse(body);
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      const entry = await accountingService.create(parsed.data, session!.id);
      return jsonOk({ entry }, 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async update(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const { id } = await ctx.params;
      const body = await req.json();
      if (body.kind === "account") {
        return jsonOk({
          account: await accountingService.setAccountActive(id, Boolean(body.isActive)),
        });
      }
      if (body.kind === "voucher_update") {
        const parsed = voucherSchema.safeParse(body.voucher);
        if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
        return jsonOk({
          voucher: await accountingService.updateVoucherDraft(id, parsed.data, session!),
        });
      }
      const parsed = voucherActionSchema.safeParse(body);
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      switch (parsed.data.action) {
        case "post":
          return jsonOk({ voucher: await accountingService.postVoucher(id, session!) });
        case "void":
          return jsonOk({
            voucher: await accountingService.voidVoucher(
              id,
              parsed.data.reason || "",
              session!
            ),
          });
        case "approve":
          return jsonOk({
            voucher: await accountingService.approveVoucher(id, session!),
          });
        case "reject":
          return jsonOk({
            voucher: await accountingService.rejectVoucher(
              id,
              parsed.data.reason || "Rejected",
              session!
            ),
          });
        case "cancel":
          return jsonOk({
            voucher: await accountingService.cancelVoucher(
              id,
              parsed.data.reason || "Cancelled",
              session!
            ),
          });
        case "reverse":
          return jsonOk({
            voucher: await accountingService.reverseVoucher(
              id,
              parsed.data.reason || "Reversed",
              session!
            ),
          });
        default:
          return jsonError("Unsupported action");
      }
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async remove(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth(["admin"]);
    if (error) return error;
    try {
      const { id } = await ctx.params;
      if (new URL(req.url).searchParams.get("kind") === "voucher") {
        const body = await req.json().catch(() => ({}));
        return jsonOk(await accountingService.removeVoucher(id, body.reason || "", session!));
      }
      return jsonOk(await accountingService.remove(id));
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

export const inventoryController = {
  async list(req: Request) {
    const { error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const params = new URL(req.url).searchParams;
      const branchCode = params.get("branch");
      if (params.get("view") === "audit-log") {
        const voucherId = params.get("voucherId");
        if (!voucherId) return jsonError("Select a voucher to view its audit history");
        return jsonOk({ events: await inventoryService.auditTrail(voucherId) });
      }
      const [items, stats, vouchers] = await Promise.all([
        inventoryService.list(branchCode),
        inventoryService.stats(branchCode),
        inventoryService.vouchers({
          branchCode,
          type: params.get("type"),
          status: params.get("status"),
        }),
      ]);
      return jsonOk({ items, stats, vouchers });
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async create(req: Request) {
    const { session, error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const body = await req.json();
      if (body.kind === "voucher") {
        const parsed = stockVoucherSchema.safeParse(body.voucher);
        if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
        return jsonOk(
          { voucher: await inventoryService.createVoucher(parsed.data, session!) },
          201
        );
      }
      const parsed = inventorySchema.safeParse(body);
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ item: await inventoryService.create(parsed.data) }, 201);
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async update(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const { id } = await ctx.params;
      const body = await req.json();
      if (body.kind === "voucher") {
        const parsed = voucherActionSchema.safeParse(body);
        if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
        if (parsed.data.action === "post") {
          return jsonOk({ voucher: await inventoryService.postVoucher(id, session!) });
        }
        return jsonOk({
          voucher: await inventoryService.voidVoucher(
            id,
            parsed.data.reason || "",
            session!
          ),
        });
      }
      const parsed = inventorySchema.safeParse(body);
      if (!parsed.success) return jsonError(firstZodError(parsed.error.issues));
      return jsonOk({ item: await inventoryService.update(id, parsed.data) });
    } catch (e) {
      return fromServiceError(e);
    }
  },
  async remove(req: Request, ctx: Ctx) {
    const { session, error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const { id } = await ctx.params;
      if (new URL(req.url).searchParams.get("kind") === "voucher") {
        const body = await req.json().catch(() => ({}));
        return jsonOk(await inventoryService.removeVoucher(id, body.reason || "", session!));
      }
      return jsonOk(await inventoryService.remove(id));
    } catch (e) {
      return fromServiceError(e);
    }
  },
};

