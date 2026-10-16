/**
 * Back-office dashboard: dealership, shop, ads and money at a glance.
 * Each block is independent so one failing query never blanks the page.
 */
import { dbConnect } from "@/backend/config/database";
import { dealershipSnapshot } from "@/backend/services/dealership.service";
import { shopSnapshot } from "@/backend/services/shop.service";
import { accountingService } from "@/backend/services/accounting.service";
import { ClassifiedAd } from "@/backend/models/Marketplace";

async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    console.error(`Dashboard block "${label}" failed`, e);
    return null;
  }
}

export const dashboardService = {
  async overview() {
    await dbConnect();
    const [dealership, shop, adsPending, money] = await Promise.all([
      safe("dealership", dealershipSnapshot),
      safe("shop", shopSnapshot),
      safe("ads", () => ClassifiedAd.countDocuments({ status: "pending" })),
      safe("money", () => accountingService.summary(null)),
    ]);
    return { dealership, shop, adsPending: adsPending ?? 0, money };
  },
};
