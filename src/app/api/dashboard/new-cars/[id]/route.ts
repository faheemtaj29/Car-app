import { newCarService } from "@/backend/services/newcar.service";
import { requireAuth, jsonOk, jsonError, fromServiceError } from "@/backend/lib/http";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await params;
    const car = await newCarService.adminGet(id);
    if (!car) return jsonError("Not found", 404);
    return jsonOk(car);
  } catch (e) { return fromServiceError(e); }
}

export async function PUT(req: Request, { params }: Params) {
  const { error } = await requireAuth(["admin", "staff"]);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    return jsonOk(await newCarService.update(id, body));
  } catch (e) { return fromServiceError(e); }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;
  try {
    const { id } = await params;
    await newCarService.delete(id);
    return jsonOk({ ok: true });
  } catch (e) { return fromServiceError(e); }
}

const quoteUpdateSchema = z.object({ quoteId: z.string(), status: z.enum(["contacted", "closed"]) });

export async function PATCH(req: Request, { params }: Params) {
  const { error } = await requireAuth(["admin", "staff"]);
  if (error) return error;
  try {
    const { id } = await params;
    const { quoteId, status } = quoteUpdateSchema.parse(await req.json());
    await newCarService.updateQuote(id, quoteId, status);
    return jsonOk({ ok: true });
  } catch (e) { return fromServiceError(e); }
}
