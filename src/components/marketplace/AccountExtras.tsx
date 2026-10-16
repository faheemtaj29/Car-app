"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOKING_LABEL } from "@/lib/booking";
import { formatPKR } from "@/lib/dealership";

type Booking = { _id: string; number: string; type: keyof typeof BOOKING_LABEL; listingTitle?: string; name: string; phone: string; date: string; slot: string; status: string; notes?: string };
type Token = { _id: string; number: string; vehicleTitle: string; amount: number; status: string; holdUntil?: string };

const when = (b: Booking) => `${new Date(b.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} at ${b.slot}`;
const TOKEN_NOTE: Record<string, string> = {
  requested: "Checking that the money arrived",
  verified: "Car is held for you",
  applied: "Counted towards your purchase",
  refunded: "Refunded",
  cancelled: "Not accepted",
};

/** Bookings (as buyer and as seller) and safe tokens, under the account page. */
export function AccountExtras() {
  const [data, setData] = useState<{ mine: Booking[]; forMyAds: Booking[]; tokens: Token[] } | null>(null);
  const load = useCallback(async () => {
    const [b, t] = await Promise.all([fetch("/api/site/bookings/mine"), fetch("/api/site/tokens/mine")]);
    if (!b.ok) return setData(null);
    const bookings = await b.json();
    setData({ ...bookings, tokens: t.ok ? (await t.json()).tokens : [] });
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => undefined);
  }, [load]);

  async function act(id: string, status: "confirmed" | "cancelled") {
    await fetch(`/api/site/bookings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  if (!data || (!data.mine.length && !data.forMyAds.length && !data.tokens.length)) return null;
  return (
    <div className="ax">
      {data.forMyAds.length ? (
        <div className="site-card">
          <h3>Viewing requests for your ads</h3>
          <ul className="ax-list">
            {data.forMyAds.map((b) => (
              <li key={b._id}>
                <div><b>{BOOKING_LABEL[b.type]}</b> · {b.listingTitle}<small>{when(b)} · {b.name} · <a href={`https://wa.me/${b.phone.replace(/\D/g, "").replace(/^0/, "92")}`} target="_blank" rel="noopener noreferrer">WhatsApp {b.phone}</a></small></div>
                <span>
                  {b.status === "requested" ? <button type="button" className="mk-link" onClick={() => act(b._id, "confirmed")}>Confirm</button> : <em>{b.status}</em>}
                  <button type="button" className="mk-link danger" onClick={() => act(b._id, "cancelled")}>Decline</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.mine.length ? (
        <div className="site-card">
          <h3>My bookings</h3>
          <ul className="ax-list">
            {data.mine.map((b) => (
              <li key={b._id}><div><b>{BOOKING_LABEL[b.type]}</b>{b.listingTitle ? ` · ${b.listingTitle}` : ""}<small>{when(b)} · {b.number}</small></div><em>{b.status}</em></li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.tokens.length ? (
        <div className="site-card">
          <h3>My tokens</h3>
          <ul className="ax-list">
            {data.tokens.map((t) => (
              <li key={t._id}><div><b>{t.vehicleTitle}</b><small>{t.number} · {formatPKR(t.amount)}{t.holdUntil && t.status === "verified" ? ` · held until ${new Date(t.holdUntil).toLocaleDateString("en-GB")}` : ""}</small></div><em>{TOKEN_NOTE[t.status] || t.status}</em></li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
