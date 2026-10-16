import type { Metadata } from "next";
import { BankLease, OwnershipCost } from "@/components/marketplace/MoneyTools";
import { settingsService } from "@/backend/services/settings.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Car finance & running-cost calculator",
  description: "Compare bank car-lease instalments side by side and see what a car really costs to run each month.",
};

export default async function CarFinancePage() {
  const { costs, banks } = await settingsService.finance();
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Money tools</span>
      <h2>Car finance & running cost</h2>
      <p className="site-lead">Compare every bank&apos;s lease for the same car, check what you are eligible for, and see the true monthly cost before you buy.</p>
      <div className="mk-detail">
        <div className="site-card mk-block">
          <h3>Compare bank leasing</h3>
          <BankLease banks={banks} price={3_000_000} carYear={new Date().getFullYear() - 2} editablePrice />
        </div>
        <div className="site-card mk-block">
          <h3>Running cost of a 1300cc petrol car</h3>
          <OwnershipCost costs={costs} banks={banks} kind="car" price={3_000_000} engineCc={1300} fuel="Petrol" />
          <p className="mk-muted small">Open any car&apos;s page to see this worked out for that exact car.</p>
        </div>
      </div>
    </section>
  );
}
