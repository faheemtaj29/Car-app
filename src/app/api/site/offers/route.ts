import { NextResponse } from "next/server";
import { getMember } from "@/backend/lib/memberSession";
import { offerService } from "@/backend/services/offer.service";
import { jsonOk, jsonError, fromServiceError } from "@/backend/lib/http";
import { z } from "zod";

const makeSchema = z.object({ listingId: z.string().min(1), amount: z.coerce.number().positive(), note: z.string().max(300).optional() });

export async function POST(req: Request) {
  const session = await getMember();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = makeSchema.parse(await req.json());
    return jsonOk(await offerService.make(session, body), 201);
  } catch (e) { return fromServiceError(e); }
}

export async function GET() {
  const session = await getMember();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return jsonOk(await offerService.mine(session)); }
  catch (e) { return fromServiceError(e); }
}
