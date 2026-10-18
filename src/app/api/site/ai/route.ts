/**
 * AI endpoints for buyers and sellers.
 * POST /api/site/ai  with { action: "describe" | "price" | "chat", ... }
 *
 * AI is gracefully off when ANTHROPIC_API_KEY is not set.
 */
import { NextResponse } from "next/server";
import { generateDescription, estimatePrice, chat, type ChatMessage } from "@/backend/lib/ai";
import { fromServiceError, jsonOk } from "@/backend/lib/http";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "describe") {
      const result = await generateDescription(body.vehicle);
      return jsonOk({ description: result });
    }
    if (body.action === "price") {
      const result = await estimatePrice(body.vehicle);
      return jsonOk({ estimate: result });
    }
    if (body.action === "chat") {
      const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const result = await chat(history, String(body.message || ""));
      return jsonOk({ reply: result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) { return fromServiceError(e); }
}
