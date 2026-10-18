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

// -----------------------------------------------------------------------
// Offer thread UI
// -----------------------------------------------------------------------
type OfferAmount = { amount: number; by: "buyer" | "seller"; note?: string; at: string };
type Offer = { _id: string; listingTitle: string; listingPrice: number; status: string; amounts: OfferAmount[]; sellerMemberId?: string; buyerName: string };

export function OfferThread({ offer, isBuyer, onUpdate }: { offer: Offer; isBuyer: boolean; onUpdate: () => void }) {
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const last = offer.amounts[offer.amounts.length - 1];
  const isMyTurn = offer.status === "pending" ? !isBuyer : (last.by === "buyer" ? !isBuyer : isBuyer);
  const canAct = isMyTurn && ["pending", "countered"].includes(offer.status);

  async function act(action: string, amount?: number) {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/site/offers/${offer._id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, amount }) });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="offer-thread">
      <div className="offer-header"><b>{offer.listingTitle}</b><span>List: Rs {offer.listingPrice.toLocaleString()}</span><em className={`offer-status ${offer.status}`}>{offer.status}</em></div>
      <div className="offer-log">{offer.amounts.map((a, i) => (<div key={i} className={`offer-entry ${a.by}`}><span>{a.by === "buyer" ? "You" : "Seller"}: Rs {a.amount.toLocaleString()}</span>{a.note ? <small>{a.note}</small> : null}</div>))}</div>
      {canAct ? (
        <div className="offer-actions">
          <input type="number" className="site-input" value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Counter amount (Rs)" style={{ width: 180 }} />
          <button type="button" className="site-btn" disabled={busy || !counter} onClick={() => act("counter", Number(counter))}>Counter</button>
          {!isBuyer && <button type="button" className="site-btn" disabled={busy} onClick={() => act("accept")}>Accept</button>}
          <button type="button" className="mk-link" disabled={busy} onClick={() => act("decline")}>Decline</button>
        </div>
      ) : null}
      {err ? <div className="mk-error">{err}</div> : null}
    </div>
  );
}

export function OffersSection() {
  const [data, setData] = useState<{ asBuyer: Offer[]; asSeller: Offer[] } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/site/offers");
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  if (!data) return null;
  const all = [...data.asBuyer.map((o) => ({ ...o, isBuyer: true })), ...data.asSeller.map((o) => ({ ...o, isBuyer: false }))];
  if (!all.length) return null;
  return (
    <div className="site-card" id="offers">
      <h3>Price offers</h3>
      {all.map((o) => <OfferThread key={o._id} offer={o} isBuyer={o.isBuyer} onUpdate={load} />)}
    </div>
  );
}

// -----------------------------------------------------------------------
// Seller ad stats
// -----------------------------------------------------------------------
type AdStat = { id: string; title: string; status: string; listPrice: number; views: number; contacts: number; messages: number; unread: number; photo?: string };

export function MyAdStats() {
  const [stats, setStats] = useState<AdStat[] | null>(null);
  useEffect(() => { fetch("/api/site/my-ads/stats").then((r) => r.ok ? r.json() : null).then((d) => setStats(d || [])); }, []);
  if (!stats || !stats.length) return null;
  return (
    <div className="site-card">
      <h3>My ad performance</h3>
      <div className="an-scroll">
        <table className="an-table">
          <thead><tr><th>Ad</th><th>Status</th><th>Price</th><th>Views</th><th>Contacts</th><th>Messages</th></tr></thead>
          <tbody>{stats.map((a) => (
            <tr key={a.id}>
              <td><a href={`/account`} className="mk-link">{a.title}</a></td>
              <td><em>{a.status}</em></td>
              <td>Rs {a.listPrice.toLocaleString()}</td>
              <td>{a.views}</td>
              <td>{a.contacts}</td>
              <td>{a.messages}{a.unread > 0 ? <b className="mk-badge">{a.unread}</b> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// AI Chat Assistant
// -----------------------------------------------------------------------
type ChatMsg = { role: "user" | "assistant"; content: string };

export function AiCarFinder() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const userMsg: ChatMsg = { role: "user", content: input };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/site/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chat", history: msgs, message: input }) });
      const d = await r.json();
      const reply = d.reply || "Sorry, AI assistant is not available right now.";
      // Extract search link if present
      const match = reply.match(/<search>([\s\S]*?)<\/search>/);
      let clean = reply.replace(/<search>[\s\S]*?<\/search>/, "").trim();
      setMsgs((m) => [...m, { role: "assistant", content: clean }]);
      if (match) {
        try {
          const q = JSON.parse(match[1]);
          const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
          setMsgs((m) => [...m, { role: "assistant", content: `[🔍 Show me matching cars](/cars?${qs.toString()})` }]);
        } catch { /* ignore */ }
      }
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]); }
    finally { setBusy(false); }
  }

  if (!open) return (
    <button type="button" className="ai-fab" onClick={() => setOpen(true)} title="AI car finder">🤖</button>
  );

  return (
    <div className="ai-chat">
      <div className="ai-chat-head"><b>🤖 AI Car Finder</b><button type="button" className="mk-link" onClick={() => setOpen(false)}>✕</button></div>
      <div className="ai-chat-body">
        {msgs.length === 0 ? <p className="mk-muted">Tell me what kind of car you&apos;re looking for — budget, city, usage…</p> : null}
        {msgs.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>{m.content}</div>
        ))}
        {busy ? <div className="ai-msg assistant">Thinking…</div> : null}
      </div>
      <div className="ai-chat-foot">
        <input className="site-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} placeholder="e.g. Corolla in Lahore under 25 lakh" />
        <button type="button" className="site-btn" disabled={busy || !input.trim()} onClick={send}>Send</button>
      </div>
    </div>
  );
}
