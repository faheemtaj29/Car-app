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

function Tile({ href, label, value, tone }: { href: string; label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "var(--jade-dark)" : tone === "warn" ? "#96650f" : tone === "bad" ? "var(--red)" : undefined;
  return (
    <Link href={href} className="pay-stat">
      <div className="tag">{label}</div>
      <div className="num" style={{ color }}>{value}</div>
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

  return (
    <>
      <Hero title={greet} subtitle="Today across the showroom, the online shop and your books" />
      {error ? <div className="alert err">{error}</div> : null}

      <Panel title="Sales floor" meta="ALL BRANCHES">
        <div className="pay-stat-row" style={{ marginTop: 4 }}>
          <Tile href="/dealership?tab=inventory" label="Cars & bikes in stock" value={d?.dealership?.unitsInStock ?? "—"} />
          <Tile href="/dealership?tab=inventory" label="Stock at cost" value={d?.dealership ? formatCompact(d.dealership.stockCost) : "—"} />
          <Tile href="/dealership?tab=deals" label="Sold this month" value={d?.dealership?.mtdUnits ?? "—"} tone="good" />
          <Tile href="/dealership?tab=deals" label="Gross profit (MTD)" value={d?.dealership ? formatCompact(d.dealership.mtdGross) : "—"} tone="good" />
          <Tile href="/dealership?tab=deals" label="Open deals" value={d?.dealership?.openDeals ?? "—"} />
          <Tile href="/dealership?tab=customers" label="Follow-ups due" value={d?.dealership?.followUpsDue ?? "—"} tone={d?.dealership?.followUpsDue ? "bad" : undefined} />
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Online shop & website" meta="WEBSITE">
          <div className="pay-stat-row" style={{ marginTop: 4 }}>
            <Tile href="/ecommerce?tab=orders" label="New orders" value={d?.shop?.pending ?? 0} tone={d?.shop?.pending ? "warn" : undefined} />
            <Tile href="/ecommerce?tab=orders" label="To dispatch" value={d?.shop?.toShip ?? 0} />
            <Tile href="/ecommerce?tab=orders" label="Shop revenue (MTD)" value={formatCompact(d?.shop?.mtdRevenue ?? 0)} tone="good" />
            <Tile href="/dealership?tab=classifieds" label="Ads awaiting review" value={d?.adsPending ?? 0} tone={d?.adsPending ? "bad" : undefined} />
            <Tile href="/dealership?tab=customers" label="Web leads (7 days)" value={d?.dealership?.webLeads7d ?? 0} />
            <Tile href="/cars" label="Live vehicle listings" value={d?.dealership?.publishedListings ?? 0} />
          </div>
        </Panel>
        <Panel title="Money" meta="POSTED VOUCHERS">
          <div className="pay-stat-row" style={{ marginTop: 4 }}>
            <Tile href="/accounting?tab=pnl&node=income-statement" label="Income" value={formatCompact(d?.money?.income ?? 0)} tone="good" />
            <Tile href="/accounting?tab=pnl&node=income-statement" label="Expenses" value={formatCompact(d?.money?.expense ?? 0)} />
            <Tile href="/accounting?tab=overview&node=accounting-dashboard" label="Net" value={formatCompact(d?.money?.balance ?? 0)} tone={(d?.money?.balance ?? 0) < 0 ? "bad" : "good"} />
          </div>
          <div className="chips" style={{ marginTop: 6 }}>
            <Link className="filter-chip" href="/dealership?tab=inventory">+ Add vehicle</Link>
            <Link className="filter-chip" href="/dealership?tab=deals">+ New deal</Link>
            <Link className="filter-chip" href="/ecommerce?tab=products">+ Shop product</Link>
            <Link className="filter-chip" href="/inventory?tab=vouchers&type=purchase&node=purchase">+ Stock purchase</Link>
          </div>
        </Panel>
      </div>

      <DealershipOverview branch="" onOpenCustomer={() => router.push("/dealership?tab=customers")} />
    </>
  );
}
