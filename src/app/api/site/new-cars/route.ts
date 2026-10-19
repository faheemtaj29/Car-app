import { newCarService } from "@/backend/services/newcar.service";
import { jsonOk, fromServiceError } from "@/backend/lib/http";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "car" | "bike" | null;
    const make = searchParams.get("make") || undefined;
    const q = searchParams.get("q") || undefined;
    return jsonOk(await newCarService.list({ type: type || undefined, make, q }));
  } catch (e) { return fromServiceError(e); }
}
