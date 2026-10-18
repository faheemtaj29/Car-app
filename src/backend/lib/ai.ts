/**
 * AI features powered by Claude (Anthropic SDK).
 *
 * Requires in .env:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * If the key is not set all calls return null (graceful degradation).
 * Features:
 *   1. Ad description writer — seller fills specs, AI writes the pitch.
 *   2. Price estimator       — suggest a fair listing price.
 *   3. Smart chat assistant  — natural language car finder.
 */
import Anthropic from "@anthropic-ai/sdk";

function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

type VehicleDetails = {
  vehicleType: "car" | "bike";
  make: string; model: string; variant?: string; year: number;
  mileage: number; fuel?: string; transmission?: string; engineCc?: number;
  color?: string; bodyType?: string; condition: "new" | "used";
  features?: string[]; city: string;
};

/** Write a compelling ad description from structured specs. */
export async function generateDescription(v: VehicleDetails): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const featureList = (v.features || []).slice(0, 12).join(", ");
  const prompt = `You are a Pakistani car marketplace copywriter. Write a natural, honest and compelling ad description in English for this ${v.vehicleType} listing. Keep it under 120 words. Do not mention price. Be specific about real selling points — do not invent features not listed.

Vehicle details:
- ${v.year} ${v.make} ${v.model}${v.variant ? ` (${v.variant})` : ""}
- ${v.condition === "new" ? "Brand new" : `Used, ${v.mileage.toLocaleString()} km`}
- ${v.fuel || "Petrol"}${v.transmission ? `, ${v.transmission}` : ""}${v.engineCc ? `, ${v.engineCc}cc` : ""}
- Colour: ${v.color || "not specified"}
${featureList ? `- Features: ${featureList}` : ""}
- Location: ${v.city}

Return only the description text, no headings, no bullet points.`;

  const msg = await c.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : null;
}

/** Suggest a fair listing price based on market signals. */
export async function estimatePrice(v: Pick<VehicleDetails, "vehicleType" | "make" | "model" | "variant" | "year" | "mileage" | "condition" | "city">): Promise<{ low: number; mid: number; high: number; reasoning: string } | null> {
  const c = client();
  if (!c) return null;
  const prompt = `You are a Pakistani used car price expert. Based on current market conditions in Pakistan (2025–2026), suggest a realistic listing price range in Pakistani Rupees for:

${v.year} ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ""}, ${v.condition}, ${v.mileage.toLocaleString()} km, ${v.city}

Reply with ONLY valid JSON (no markdown, no extra text):
{"low": <number>, "mid": <number>, "high": <number>, "reasoning": "<1–2 sentence reason>"}`;

  const msg = await c.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  if (block.type !== "text") return null;
  try {
    const j = JSON.parse(block.text.trim().replace(/```json|```/g, ""));
    if (typeof j.low === "number" && typeof j.mid === "number" && typeof j.high === "number") return j;
  } catch { /* fall through */ }
  return null;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Smart chat: buyer describes what they want, AI replies with a search link. */
export async function chat(history: ChatMessage[], userMessage: string): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const system = `You are a helpful car-buying assistant on an online Pakistani marketplace. Help the buyer find a car or bike by understanding what they need in plain English or Roman Urdu. You can suggest makes/models, ask clarifying questions about budget, city, or usage. If the buyer has given enough info, end your reply with a JSON block like:
<search>{"make":"Toyota","model":"Corolla","city":"Lahore","minYear":2018,"maxPrice":2500000}</search>
Keep replies short (2–4 sentences). Use English. Do not hallucinate prices. Only suggest makes/models that exist in Pakistan.`;

  const messages = [
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const msg = await c.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 300,
    system,
    messages,
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : null;
}
