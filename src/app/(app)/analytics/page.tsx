"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Hero, Panel } from "@/components/ui";
import { formatCompact } from "@/lib/format";

type Row = { label: string; count: number };
type Report = {
  days: number;
  totals: Record<"newMembers" | "newAds" | "leads" | "bookings" | "partEnquiries" | "searches" | "tokensVerified" | "tokenAmount" | "shopOrders" | "shopRevenue" | "dealers" | "suppliers", number>;
  waiting: Record<"ads" | "identities" | "businesses" | "tokens" | "bookings", number>;
  trend: { day: string; members: number; ads: number; enquiries: number }[];
  topMakes: Row[]; topModels: Row[]; topParts: Row[]; leadSources: Row[]; noResult: Row[];
  demand: { city: string; searches: number; listings: number }[];
  gaps: { city: string; searches: number; listings: number }[];
  popular: { id: string; title: string; city: string; views: number; contacts: number }[];
};

// Fixed order; validated for colour-blind separation. Text never wears these colours.
const SERIES = [
  { key: "members", label: "New members", color: "#14916a" },
  { key: "ads", label: "New ads", color: "#cf7415" },
  { key: "enquiries", label: "Enquiries & bookings", color: "#3567b8" },
] as const;

const shortDay = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function TrendChart({ trend }: { trend: Report["trend"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 720, H = 220, L = 34, R = 10, T = 12, B = 26;
  const max = Math.max(4, ...trend.flatMap((t) => SERIES.map((s) => t[s.key])));
  const x = (i: number) => L + (trend.length <= 1 ? 0 : (i * (W - L - R)) / (trend.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(trend.length / 7);

  return (
    <div>
      <div className="an-legend">
        {SERIES.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
        <button type="button" className="mk-link" onClick={() => setTable(!table)}>{table ? "Show chart" : "Show as table"}</button>
      </div>
      {table ? (
        <div className="an-scroll">
          <table className="an-table">
            <thead><tr><th>Day</th>{SERIES.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>{trend.map((t) => <tr key={t.day}><td>{shortDay(t.day)}</td>{SERIES.map((s) => <td key={s.key}>{t[s.key]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="an-chart">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily new members, new ads and enquiries" onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              setHover(Math.max(0, Math.min(trend.length - 1, Math.round(((px - L) / (W - L - R)) * (trend.length - 1)))));
            }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-dim)">{t}</text>
              </g>
            ))}
            {trend.map((t, i) => (i % labelEvery === 0 ? <text key={t.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-dim)">{shortDay(t.day)}</text> : null))}
            {SERIES.map((s) => (
              <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={trend.map((t, i) => `${x(i)},${y(t[s.key])}`).join(" ")} />
            ))}
            {hover !== null ? (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--text-dim)" strokeDasharray="3 3" />
                {SERIES.map((s) => <circle key={s.key} cx={x(hover)} cy={y(trend[hover][s.key])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />)}
              </g>
            ) : null}
          </svg>
          {hover !== null ? (
            <div className="an-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
              <b>{shortDay(trend[hover].day)}</b>
              {SERIES.map((s) => <div key={s.key}><i style={{ background: s.color }} />{s.label}: <b>{trend[hover][s.key]}</b></div>)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One measure, one colour: bars of a ranked list. */
function Bars({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="mk-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="an-bars">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.count}`}>
          <span className="an-bar-label">{r.label}</span>
          <span className="an-bar-track"><span style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} /></span>
          <span className="an-bar-val">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="pay-stat">
      <div className="tag">{label}</div>
      <div className="num">{value}</div>
      {note ? <small className="mk-muted">{note}</small> : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/analytics?days=${days}`)
      .then(async (res) => (res.ok ? res.json() : Promise.reject(new Error((await res.json()).error || "Could not load"))))
      .then((d) => live && (setR(d), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [days]);

  const t = r?.totals;
  const w = r?.waiting;
  return (
    <>
      <Hero title="Analytics" subtitle="Who is joining, what buyers search for, and where the money comes from" />
      <div className="an-range" role="group" aria-label="Time range">
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" className={d === days ? "on" : ""} onClick={() => setDays(d)}>Last {d} days</button>
        ))}
      </div>
      {error ? <div className="alert err">{error}</div> : null}
      {!r || !t || !w ? (!error ? <p className="mk-muted">Loading…</p> : null) : (
        <>
          {w.ads + w.identities + w.businesses + w.tokens + w.bookings > 0 ? (
            <Panel title="Waiting for you" meta="NOW">
              <div className="pay-stat-row">
                <Link href="/ecommerce?tab=ads" className="pay-stat"><div className="tag">Ads to review</div><div className="num">{w.ads}</div></Link>
                <Link href="/dealership?tab=partners" className="pay-stat"><div className="tag">Identities to check</div><div className="num">{w.identities}</div></Link>
                <Link href="/dealership?tab=partners" className="pay-stat"><div className="tag">Businesses to approve</div><div className="num">{w.businesses}</div></Link>
                <Link href="/dealership?tab=tokens" className="pay-stat"><div className="tag">Tokens to verify</div><div className="num">{w.tokens}</div></Link>
                <Link href="/dealership?tab=bookings" className="pay-stat"><div className="tag">Bookings to confirm</div><div className="num">{w.bookings}</div></Link>
              </div>
            </Panel>
          ) : null}

          <Panel title={`Last ${r.days} days`} meta="TOTALS">
            <div className="pay-stat-row">
              <Stat label="New members" value={t.newMembers} note={`${t.dealers} dealers · ${t.suppliers} suppliers`} />
              <Stat label="New ads" value={t.newAds} />
              <Stat label="Enquiries" value={t.leads + t.partEnquiries} note={`${t.leads} cars · ${t.partEnquiries} parts`} />
              <Stat label="Bookings" value={t.bookings} />
              <Stat label="Safe tokens" value={`Rs ${formatCompact(t.tokenAmount)}`} note={`${t.tokensVerified} verified`} />
              <Stat label="Shop sales" value={`Rs ${formatCompact(t.shopRevenue)}`} note={`${t.shopOrders} orders`} />
              <Stat label="Searches" value={t.searches} note="make / model searches" />
            </div>
          </Panel>

          <Panel title="Daily activity" meta="TREND">
            <TrendChart trend={r.trend} />
          </Panel>

          <div className="an-grid">
            <Panel title="Most searched makes"><Bars rows={r.topMakes} empty="No searches yet" /></Panel>
            <Panel title="Most searched models"><Bars rows={r.topModels} empty="No searches yet" /></Panel>
            <Panel title="Parts searched by vehicle"><Bars rows={r.topParts} empty="No parts searches yet" /></Panel>
            <Panel title="Where enquiries come from"><Bars rows={r.leadSources} empty="No enquiries yet" /></Panel>
          </div>

          <Panel title="Where buyers want cars but we have few" meta="OPPORTUNITIES">
            {r.gaps.length ? (
              <div className="an-scroll">
                <table className="an-table">
                  <thead><tr><th>City</th><th>Searches</th><th>Cars listed</th></tr></thead>
                  <tbody>{r.gaps.map((g) => <tr key={g.city}><td>{g.city}</td><td>{g.searches}</td><td>{g.listings}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="mk-muted">Not enough searches yet.</p>}
            {r.noResult.length ? (
              <>
                <h3 className="an-sub">Searched but nothing found</h3>
                <Bars rows={r.noResult} empty="" />
              </>
            ) : null}
          </Panel>

          <Panel title="Most viewed listings" meta="LIVE">
            {r.popular.length ? (
              <div className="an-scroll">
                <table className="an-table">
                  <thead><tr><th>Car</th><th>City</th><th>Views</th><th>Contacts</th></tr></thead>
                  <tbody>{r.popular.map((p) => <tr key={p.id}><td>{p.title}</td><td>{p.city}</td><td>{p.views}</td><td>{p.contacts}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="mk-muted">No listings yet.</p>}
          </Panel>
        </>
      )}
    </>
  );
}
