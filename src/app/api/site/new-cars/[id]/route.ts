import { NextResponse } from "next/server";
import { newCarService } from "@/backend/services/newcar.service";
import { jsonOk, jsonError, fromServiceError } from "@/backend/lib/http";
import { z } from "zod";

const quoteSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(20),
  city: z.string().min(2).max(60),
  variant: z.string().max(80).optional(),
  message: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const car = await newCarService.get(id);
    if (!car) return jsonError("Not found", 404);
    return jsonOk(car);
  } catch (e) { return fromServiceError(e); }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = quoteSchema.parse(await req.json());
    await newCarService.quote(id, body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) { return fromServiceError(e); }
}
