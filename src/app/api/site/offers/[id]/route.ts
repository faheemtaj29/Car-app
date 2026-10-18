import { NextResponse } from "next/server";
import { getMember } from "@/backend/lib/memberSession";
import { offerService } from "@/backend/services/offer.service";
import { fromServiceError } from "@/backend/lib/http";
import { z } from "zod";

const actSchema = z.object({ action: z.enum(["counter", "accept", "decline"]), amount: z.coerce.number().positive().optional(), note: z.string().max(300).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMember();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = actSchema.parse(await req.json());
    return (await import("@/backend/lib/http")).jsonOk(await offerService.act(session, id, body));
  } catch (e) { return fromServiceError(e); }
}
