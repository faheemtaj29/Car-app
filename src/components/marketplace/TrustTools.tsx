"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { TrustProfile } from "@/backend/services/review.service";
import { formatPKR } from "@/lib/dealership";

const Stars = ({ value }: { value: number }) => (
  <span className="tr-stars" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <i key={i} className={value >= i - 0.25 ? "on" : value >= i - 0.75 ? "half" : ""}>★</i>)}
  </span>
);

/** Seller / showroom trust card with reviews and a "rate them" form. */
export function TrustCard({ trust, targetType, targetId, name }: { trust: TrustProfile; targetType: "dealer" | "member"; targetId: string; name: string }) {
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/site/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, rating, comment: comment || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return setMsg({ ok: false, text: "Please log in to leave a review." });
    setMsg(res.ok ? { ok: true, text: "Thanks — your review is posted." } : { ok: false, text: data.error || "Could not post" });
    if (res.ok) setWriting(false);
  }

  return (
    <div className="tr">
      <div className="tr-head">
        {trust.rating !== null ? (
          <>
            <b className="tr-score">{trust.rating.toFixed(1)}</b>
            <div><Stars value={trust.rating} /><small>{trust.reviews} review{trust.reviews === 1 ? "" : "s"}</small></div>
          </>
        ) : (
          <small className="mk-muted">No reviews yet for {name}</small>
        )}
      </div>
      {trust.badges.length ? <div className="tr-badges">{trust.badges.map((b) => <span key={b}>✓ {b}</span>)}</div> : null}
      {trust.memberSince ? (
        <p className="mk-muted small">
          On the site since {new Date(trust.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          {trust.adsPosted ? ` · ${trust.adsPosted} ad${trust.adsPosted === 1 ? "" : "s"} posted` : ""}
          {trust.adsSold ? ` · ${trust.adsSold} sold` : ""}
          {trust.idVerified ? "" : " · ID not yet verified"}
        </p>
      ) : null}
      {trust.latest.length ? (
        <ul className="tr-list">
          {trust.latest.slice(0, 3).map((r) => (
            <li key={r._id}>
              <Stars value={r.rating} /> <b>{r.memberName}</b>
              {r.comment ? <p>{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <div className={msg.ok ? "al-ok" : "mk-error"}>{msg.text}{!msg.ok && msg.text.includes("log in") ? <> <Link href="/account">Log in</Link></> : null}</div> : null}
      {writing ? (
        <form className="tr-form" onSubmit={submit}>
          <div className="tr-pick">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" className={i <= rating ? "on" : ""} onClick={() => setRating(i)} aria-label={`${i} star`}>★</button>
            ))}
          </div>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="How was your experience? (optional)" />
          <button type="submit" className="site-btn small">Post review</button>
        </form>
      ) : (
        <button type="button" className="mk-link" onClick={() => setWriting(true)}>★ Rate {name}</button>
      )}
    </div>
  );
}

const METHODS = [
  ["bank_transfer", "Bank transfer"],
  ["jazzcash", "JazzCash"],
  ["easypaisa", "Easypaisa"],
] as const;

/** Hold a showroom car with token money sent to the showroom's own account. */
export function SafeToken({ vehicleId, price, instructions, holdDays }: { vehicleId: string; price: number; instructions: string; holdDays: number }) {
  const suggested = Math.min(Math.max(Math.round((price * 0.02) / 10000) * 10000, 25000), 200000);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: String(suggested), method: "bank_transfer", reference: "", name: "", phone: "", cnicLast4: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/site/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId, ...f, amount: Number(f.amount) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit");
      setDone(data.token.number);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bk-done">
        <b>✓ Token submitted — {done}</b>
        <p>We check that the money arrived (usually within an hour in showroom hours), then hold this car for you for {holdDays} days and send you the receipt. If we can&apos;t hold it, your token is refunded in full.</p>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="tk">
        <p>Like this car? Hold it for <b>{holdDays} days</b> with a refundable token. The money goes to the showroom&apos;s own account and is recorded against your purchase.</p>
        <button type="button" className="site-btn" onClick={() => setOpen(true)}>🔒 Hold with a token</button>
      </div>
    );
  }
  return (
    <form className="tk" onSubmit={submit}>
      <div className="tk-steps">
        <b>1. Send the token to:</b>
        <pre>{instructions}</pre>
        <b>2. Enter the transaction details:</b>
      </div>
      <div className="bk-fields">
        <label>Amount (PKR)<input type="number" min={10000} step={5000} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></label>
        <label>Sent with<select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Transaction ID / reference" required minLength={4} />
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name (as on CNIC)" required minLength={2} />
        <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Mobile number" required inputMode="tel" />
        <input value={f.cnicLast4} onChange={(e) => setF({ ...f, cnicLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Last 4 digits of CNIC (optional)" inputMode="numeric" />
        <input className="mk-hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden="true" />
      </div>
      {error ? <div className="mk-error">{error}</div> : null}
      <button type="submit" className="site-btn" disabled={busy}>{busy ? "Submitting…" : `Submit token of ${formatPKR(Number(f.amount) || 0)}`}</button>
      <p className="mk-muted small">Never send money to a personal account or to anyone who calls you. Only use the account shown above.</p>
    </form>
  );
}
