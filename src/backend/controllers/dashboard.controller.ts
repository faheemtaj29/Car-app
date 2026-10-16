import { fromServiceError, jsonOk, requireAuth } from "@/backend/lib/http";
import { dashboardService } from "@/backend/services/dashboard.service";

export const dashboardController = {
  async overview() {
    const { error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      return jsonOk(await dashboardService.overview());
    } catch (e) {
      return fromServiceError(e);
    }
  },
};
