import type { Metadata } from "next";
import { AccountApp } from "@/components/marketplace/Member";
import { AccountExtras, OffersSection, MyAdStats, AiCarFinder } from "@/components/marketplace/AccountExtras";
import { SellerSetup } from "@/components/marketplace/Seller";
import { SupplierDashboard } from "@/components/marketplace/SupplierDashboard";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <section className="site-section">
      <span className="site-kicker">My account</span>
      <h2>Your ads & orders</h2>
      <AccountApp />
      <SellerSetup />
      <SupplierDashboard />
      <MyAdStats />
      <OffersSection />
      <AccountExtras />
      <AiCarFinder />
    </section>
  );
}
