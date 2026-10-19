import { newCarService } from "@/backend/services/newcar.service";
import { requireAuth, jsonOk, fromServiceError } from "@/backend/lib/http";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;
  void session;
  try { return jsonOk(await newCarService.adminList()); }
  catch (e) { return fromServiceError(e); }
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth(["admin", "staff"]);
  if (error) return error;
  void session;
  try {
    const body = await req.json();
    return jsonOk(await newCarService.create(body), 201);
  } catch (e) { return fromServiceError(e); }
}
