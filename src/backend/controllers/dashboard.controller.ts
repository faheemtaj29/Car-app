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

import { analyticsService } from "@/backend/services/analytics.service";

export const analyticsController = {
  async report(req: Request) {
    const { error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const days = Number(new URL(req.url).searchParams.get("days")) || 30;
      return jsonOk(await analyticsService.report(days));
    } catch (e) {
      return fromServiceError(e);
    }
  },
};
