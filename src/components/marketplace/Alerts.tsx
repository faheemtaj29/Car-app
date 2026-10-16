"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthPanel, call, useMe } from "./Member";
import { ListingCard } from "./Listing";
import type { AlertView } from "@/backend/services/alert.service";
import { formatPKR } from "@/lib/dealership";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** "🔔 Alert me" on a search results page. */
export function SaveSearchButton({ query, label }: { query: string; label: string }) {
  const [state, setState] = useState<"idle" | "saved" | "login" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function save() {
    const r = await post("/api/site/alerts", { kind: "search", query, label });
    if (r.status === 401) return setState("login");
    if (!r.ok) {
      setMsg(r.data.error || "Could not save");
      return setState("error");
    }
    setState("saved");
  }
  if (state === "saved") return <span className="al-ok">✓ We&apos;ll show new matches under <Link href="/alerts">🔔 Alerts</Link></span>;
  if (state === "login") return <span className="al-ok"><Link href="/account">Log in</Link> to save searches</span>;
  return (
    <>
      <button type="button" className="al-btn" onClick={save}>🔔 Alert me about new matches</button>
      {state === "error" ? <span className="mk-error small">{msg}</span> : null}
    </>
  );
}

/** "Tell me if the price drops" on a listing. */
export function WatchPriceButton({ listingId }: { listingId: string }) {
  const [state, setState] = useState<"idle" | "saved" | "login" | "error">("idle");
  async function watch() {
    const r = await post("/api/site/alerts", { kind: "price", listingId });
    setState(r.status === 401 ? "login" : r.ok ? "saved" : "error");
  }
  if (state === "saved") return <span className="al-ok">✓ Watching the price</span>;
  if (state === "login") return <span className="al-ok"><Link href="/account">Log in</Link> to watch prices</span>;
  return <button type="button" className="al-btn" onClick={watch}>📉 Tell me if the price drops</button>;
}

/** 🔔 and 🔧 counts in the site header (only shown when something is waiting). */
export function HeaderBadges({ garageLabel = "Garage" }: { garageLabel?: string }) {
  const [b, setB] = useState<{ loggedIn: boolean; alerts: number; garage: number } | null>(null);
  useEffect(() => {
    fetch("/api/site/badges").then((r) => r.json()).then(setB).catch(() => undefined);
  }, []);
  return (
    <>
      <Link href="/garage" className="hb" title="My Garage">🔧<span className="hb-label">{garageLabel}</span>{b?.garage ? <i>{b.garage}</i> : null}</Link>
      {b?.loggedIn ? <Link href="/alerts" className="hb" title="Alerts">🔔{b.alerts ? <i>{b.alerts}</i> : null}</Link> : null}
    </>
  );
}

export function AlertsApp() {
  const { state, reload } = useMe();
  const [alerts, setAlerts] = useState<AlertView[] | null>(null);
  const load = useCallback(async () => {
    setAlerts((await call<{ alerts: AlertView[] }>("/api/site/alerts")).alerts);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state === "in") load().catch(() => setAlerts([]));
  }, [state, load]);

  if (state === "loading") return <p className="mk-muted">Loading…</p>;
  if (state === "out") return <AuthPanel onDone={reload} intro="Log in to save searches and watch prices." />;
  if (!alerts) return <p className="mk-muted">Loading…</p>;
  if (!alerts.length) {
    return (
      <div className="site-card">
        <h3>No alerts yet</h3>
        <p>Search for a car, then press <b>🔔 Alert me about new matches</b>. On any car page, press <b>📉 Tell me if the price drops</b>.</p>
        <Link href="/cars" className="site-btn">Browse cars</Link>
      </div>
    );
  }

  async function act(id: string, how: "seen" | "delete") {
    await fetch(`/api/site/alerts/${id}`, { method: how === "seen" ? "POST" : "DELETE" });
    load();
  }

  return (
    <div className="al-list">
      {alerts.map((a) => {
        const share = a.matches[0] ? `https://wa.me/?text=${encodeURIComponent(`Found this: ${a.matches[0].title} — ${formatPKR(a.matches[0].price)} ${location.origin}/${a.matches[0].vehicleType === "bike" ? "bikes" : "cars"}/${a.matches[0]._id}`)}` : null;
        return (
          <div key={a._id} className={`site-card al-card${a.newCount ? " new" : ""}`}>
            <div className="al-head">
              <div>
                <b>{a.kind === "search" ? "🔎" : "📉"} {a.label}</b>
                <div className="mk-muted small">
                  {a.kind === "search"
                    ? a.newCount ? `${a.newCount} new since you last looked` : "No new matches yet"
                    : a.price?.now == null
                      ? "This vehicle is no longer listed"
                      : a.price.now < a.price.base
                        ? `Price dropped ${formatPKR(a.price.base - a.price.now)} — now ${formatPKR(a.price.now)}`
                        : `Still ${formatPKR(a.price.now)}`}
                </div>
              </div>
              <div className="al-actions">
                {a.kind === "search" && a.query ? <Link href={a.query} className="mk-link">Open search</Link> : null}
                {share ? <a href={share} target="_blank" rel="noopener noreferrer" className="mk-link">Share on WhatsApp</a> : null}
                {a.newCount ? <button type="button" className="mk-link" onClick={() => act(a._id, "seen")}>Mark seen</button> : null}
                <button type="button" className="mk-link danger" onClick={() => act(a._id, "delete")}>Delete</button>
              </div>
            </div>
            {a.matches.length && (a.newCount || a.kind === "price") ? <div className="mk-grid small">{a.matches.map((m) => <ListingCard key={m._id} car={m} />)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
