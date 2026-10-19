"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Hero, Panel } from "@/components/ui";
import { DealershipOverview } from "@/components/dealership/Overview";
import { formatCompact } from "@/lib/format";

type Data = {
  dealership: {
    unitsInStock: number; stockCost: number; stockList: number; mtdUnits: number; mtdGross: number;
    openDeals: number; followUpsDue: number; webLeads7d: number; publishedListings: number;
  } | null;
  shop: { listed: number; pending: number; toShip: number; mtdOrders: number; mtdRevenue: number } | null;
  adsPending: number;
  money: { income: number; expense: number; balance: number } | null;
};

function KPI({ href, label, value, tone, icon }: { href: string; label: string; value: string | number; tone?: "good" | "warn" | "bad"; icon: string }) {
  const color = tone === "good" ? "var(--jade-dark)" : tone === "warn" ? "#96650f" : tone === "bad" ? "var(--red)" : undefined;
  return (
    <Link href={href} className="dash-kpi">
      <div className="dash-kpi-icon">{icon}</div>
      <div className="dash-kpi-body">
        <div className="dash-kpi-label">{label}</div>
        <div className="dash-kpi-value" style={{ color }}>{value}</div>
      </div>
    </Link>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="dash-action">
      <span className="dash-action-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error || "Could not load"))))
      .then(setD)
      .catch((e: Error) => setError(e.message));
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const alerts = [
    d?.dealership?.followUpsDue ? `${d.dealership.followUpsDue} follow-up${d.dealership.followUpsDue > 1 ? "s" : ""} due today` : null,
    d?.shop?.pending ? `${d.shop.pending} new shop order${d.shop.pending > 1 ? "s" : ""}` : null,
    d?.adsPending ? `${d.adsPending} classified ad${d.adsPending > 1 ? "s" : ""} awaiting review` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="dash-wrap">
      <Hero
        title={greet}
        subtitle={today}
        live={alerts.length > 0 ? `${alerts.length} item${alerts.length > 1 ? "s" : ""} need attention` : "All clear"}
      />

      {error ? <div className="alert err" style={{ marginBottom: 18 }}>{error}</div> : null}

      {alerts.length > 0 && (
        <div className="dash-alerts">
          {alerts.map((a) => <div key={a} className="dash-alert-item">⚠️ {a}</div>)}
        </div>
      )}

      {/* Quick actions */}
      <Panel title="Quick Actions" meta="SHORTCUTS">
        <div className="dash-actions-row">
          <QuickAction href="/dealership?tab=inventory" label="Add Vehicle" icon="🚗" />
          <QuickAction href="/dealership?tab=deals" label="New Deal" icon="🤝" />
          <QuickAction href="/dealership?tab=classifieds" label="Review Ads" icon="📋" />
          <QuickAction href="/ecommerce?tab=orders" label="Shop Orders" icon="📦" />
          <QuickAction href="/dealership?tab=customers" label="Customers" icon="👥" />
          <QuickAction href="/accounting?tab=vouchers" label="New Voucher" icon="📒" />
          <QuickAction href="/settings" label="Settings" icon="⚙️" />
          <QuickAction href="/" label="View Website" icon="🌐" />
        </div>
      </Panel>

      {/* KPI overview */}
      <Panel title="Sales Floor" meta="ALL BRANCHES">
        <div className="dash-kpi-grid">
          <KPI href="/dealership?tab=inventory" label="In Stock" value={d?.dealership?.unitsInStock ?? "—"} icon="🚗" />
          <KPI href="/dealership?tab=inventory" label="Stock Cost" value={d?.dealership ? formatCompact(d.dealership.stockCost) : "—"} icon="💰" />
          <KPI href="/dealership?tab=deals" label="Sold (MTD)" value={d?.dealership?.mtdUnits ?? "—"} tone="good" icon="✅" />
          <KPI href="/dealership?tab=deals" label="Gross Profit" value={d?.dealership ? formatCompact(d.dealership.mtdGross) : "—"} tone="good" icon="📈" />
          <KPI href="/dealership?tab=deals" label="Open Deals" value={d?.dealership?.openDeals ?? "—"} icon="🔄" />
          <KPI href="/dealership?tab=customers" label="Follow-ups Due" value={d?.dealership?.followUpsDue ?? "—"} tone={d?.dealership?.followUpsDue ? "bad" : undefined} icon="📞" />
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Website & Online Shop" meta="LIVE">
          <div className="dash-kpi-grid dash-kpi-grid-3">
            <KPI href="/ecommerce?tab=orders" label="New Orders" value={d?.shop?.pending ?? 0} tone={d?.shop?.pending ? "warn" : undefined} icon="🛒" />
            <KPI href="/ecommerce?tab=orders" label="To Dispatch" value={d?.shop?.toShip ?? 0} icon="📮" />
            <KPI href="/ecommerce?tab=orders" label="Shop Revenue" value={formatCompact(d?.shop?.mtdRevenue ?? 0)} tone="good" icon="💳" />
            <KPI href="/dealership?tab=classifieds" label="Ads Pending" value={d?.adsPending ?? 0} tone={d?.adsPending ? "bad" : undefined} icon="📢" />
            <KPI href="/dealership?tab=customers" label="Web Leads (7d)" value={d?.dealership?.webLeads7d ?? 0} icon="🎯" />
            <KPI href="/cars" label="Live Listings" value={d?.dealership?.publishedListings ?? 0} tone="good" icon="🌐" />
          </div>
        </Panel>

        <Panel title="Financials" meta="POSTED VOUCHERS">
          <div className="dash-kpi-grid dash-kpi-grid-1">
            <KPI href="/accounting?tab=pnl&node=income-statement" label="Total Income" value={formatCompact(d?.money?.income ?? 0)} tone="good" icon="⬆️" />
            <KPI href="/accounting?tab=pnl&node=income-statement" label="Total Expenses" value={formatCompact(d?.money?.expense ?? 0)} icon="⬇️" />
            <KPI href="/accounting?tab=overview&node=accounting-dashboard" label="Net Balance" value={formatCompact(d?.money?.balance ?? 0)} tone={(d?.money?.balance ?? 0) < 0 ? "bad" : "good"} icon="🏦" />
          </div>
        </Panel>
      </div>

      <DealershipOverview branch="" onOpenCustomer={() => router.push("/dealership?tab=customers")} />
    </div>
  );
}
