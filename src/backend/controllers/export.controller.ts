/**
 * CSV downloads for the back office (open in Excel / Google Sheets).
 */
import { fromServiceError, requireAuth } from "@/backend/lib/http";
import { dealService } from "@/backend/services/dealership.service";
import { dbConnect } from "@/backend/config/database";
import { ShopOrder, type IShopOrder } from "@/backend/models/Marketplace";
import { toCsv } from "@/lib/shop";

function csvResponse(name: string, body: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens UTF-8 (Urdu names, ₨) correctly.
  return new Response("\uFEFF" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

const day = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const exportController = {
  async deals(req: Request) {
    const { error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      const p = new URL(req.url).searchParams;
      const deals = await dealService.list({ branch: p.get("branch"), status: p.get("status") });
      const rows = deals.map((d) => [
        d.number, day(d.createdAt), d.status, d.branchCode, d.customerName, d.vehicleLabel, d.stockNo, d.salesperson || "",
        d.salePrice, d.discount, d.tradeInAllowance, d.taxAmount, d.registrationFee + d.otherFees, d.totals.payable,
        d.paid, d.financing?.status === "approved" ? d.financing.amount : 0, d.financing?.lender || "", d.totals.balance,
        d.costOfSale ?? "", d.grossProfit ?? "", d.commission ?? "", day(d.deliveredAt),
      ]);
      return csvResponse(
        "deals",
        toCsv(
          ["Deal", "Date", "Status", "Branch", "Customer", "Vehicle", "Stock no", "Salesperson", "Sale price", "Discount",
           "Trade-in", "Tax", "Fees", "Payable", "Received", "Financed", "Lender", "Balance", "Cost", "Gross profit",
           "Commission", "Delivered"],
          rows
        )
      );
    } catch (e) {
      return fromServiceError(e);
    }
  },

  async orders(req: Request) {
    const { error } = await requireAuth(["admin", "staff"]);
    if (error) return error;
    try {
      await dbConnect();
      const status = new URL(req.url).searchParams.get("status");
      const orders = await ShopOrder.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(10000).lean<IShopOrder[]>();
      const rows = orders.map((o) => [
        o.number, day(o.createdAt), o.status, o.customerName, o.phone, o.city, o.address,
        o.lines.map((l) => `${l.qty}x ${l.sku}`).join("; "), o.subtotal, o.couponCode || "", o.discount || 0,
        o.deliveryFee, o.total, o.paymentMethod, o.paymentStatus, o.courier || "", o.trackingNumber || "",
      ]);
      return csvResponse(
        "shop-orders",
        toCsv(
          ["Order", "Date", "Status", "Customer", "Phone", "City", "Address", "Items", "Subtotal", "Coupon", "Discount",
           "Delivery", "Total", "Payment", "Paid", "Courier", "Tracking"],
          rows
        )
      );
    } catch (e) {
      return fromServiceError(e);
    }
  },
};
