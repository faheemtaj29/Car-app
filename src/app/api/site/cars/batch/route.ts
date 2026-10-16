import { fromServiceError, jsonOk } from "@/backend/lib/http";
import { marketplaceService } from "@/backend/services/marketplace.service";

/** GET /api/site/cars/batch?ids=a,b,c — public listings for Saved / Compare. */
export async function GET(req: Request) {
  try {
    const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean);
    return jsonOk({ listings: await marketplaceService.listingsByIds(ids) });
  } catch (e) {
    return fromServiceError(e);
  }
}
