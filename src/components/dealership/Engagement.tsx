"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, Panel } from "@/components/ui";
import { prettyDate } from "@/lib/format";
import { BOOKING_LABEL } from "@/lib/booking";
import { Pill, api, label, pkr } from "./shared";

function useList<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api<T>(url));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  return { data, error, setError, load };
}

function Chips({ value, options, counts, onChange }: { value: string; options: string[]; counts?: Record<string, number>; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((s) => (
        <button key={s} type="button" className={`filter-chip${value === s ? " active" : ""}`} onClick={() => onChange(s)}>
          {label(s)}{counts ? ` (${counts[s] || 0})` : ""}
        </button>
      ))}
      <button type="button" className={`filter-chip${value === "" ? " active" : ""}`} onClick={() => onChange("")}>All</button>
    </div>
  );
}

/* -------------------------------------------------------------- bookings */

type Booking = {
  _id: string; number: string; type: keyof typeof BOOKING_LABEL; listingId?: string; listingSource?: string; listingTitle?: string;
  name: string; phone: string; date: string; slot: string; address?: string; notes?: string; status: string; staffNote?: string;
};

export function DealershipBookings() {
  const [status, setStatus] = useState("requested");
  const { data, error, setError, load } = useList<{ bookings: Booking[]; counts: Record<string, number> }>(`/api/dealership/bookings${status ? `?status=${status}` : ""}`);

  async function act(b: Booking, next: string) {
    const staffNote = next === "cancelled" ? prompt("Reason (optional)") || undefined : undefined;
    try {
      await api(`/api/dealership/bookings/${b._id}`, { method: "POST", json: { status: next, staffNote } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="accounting-toolbar dl-toolbar no-print">
        <Chips value={status} options={["requested", "confirmed", "done", "cancelled"]} counts={data?.counts} onChange={setStatus} />
      </div>
      {error ? <div className="alert err">{error}</div> : null}
      <Panel title="Test drives, inspections & video viewings" meta="BOOKED BY BUYERS ON THE WEBSITE">
        {!data ? <EmptyState message="Loading…" /> : !data.bookings.length ? <EmptyState message="No bookings here." /> : (
          <div className="table-scroll">
            <table className="reg">
              <thead><tr><th>When</th><th>Type</th><th>Vehicle</th><th>Customer</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr key={b._id}>
                    <td><b>{prettyDate(b.date)}</b> {b.slot}<div className="muted small">{b.number}</div></td>
                    <td>{BOOKING_LABEL[b.type]}{b.address ? <div className="muted small">📍 {b.address}</div> : null}</td>
                    <td>
                      {b.listingId ? <a className="link-btn" href={`/cars/${b.listingId}`} target="_blank" rel="noreferrer">{b.listingTitle}</a> : "—"}
                      {b.listingSource === "private" ? <div className="muted small">Private ad</div> : null}
                    </td>
                    <td>{b.name}<div className="muted small"><a href={`tel:${b.phone}`}>{b.phone}</a> · <a href={`https://wa.me/${b.phone.replace(/\D/g, "").replace(/^0/, "92")}`} target="_blank" rel="noreferrer">WhatsApp</a></div>{b.notes ? <div className="muted small">“{b.notes}”</div> : null}</td>
                    <td><Pill value={b.status} />{b.staffNote ? <div className="muted small">{b.staffNote}</div> : null}</td>
                    <td className="right">
                      {b.status === "requested" ? <button type="button" className="link-btn" onClick={() => act(b, "confirmed")}>Confirm</button> : null}
                      {b.status === "confirmed" ? <button type="button" className="link-btn" onClick={() => act(b, "done")}>Done</button> : null}
                      {["requested", "confirmed"].includes(b.status) ? <button type="button" className="link-btn danger" onClick={() => act(b, "cancelled")}>Cancel</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* ----------------------------------------------------------- safe tokens */

type Token = {
  _id: string; number: string; vehicleId: string; vehicleTitle: string; name: string; phone: string; cnicLast4?: string; amount: number;
  method: string; reference: string; status: string; holdUntil?: string; dealNumber?: string; staffNote?: string; createdAt: string;
};

export function DealershipTokens({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState("requested");
  const [now] = useState(() => Date.now());
  const { data, error, setError, load } = useList<{ tokens: Token[]; counts: Record<string, number> }>(`/api/dealership/tokens${status ? `?status=${status}` : ""}`);

  async function act(t: Token, action: "verify" | "reject" | "refund" | "applied") {
    let staffNote: string | undefined;
    if (action === "verify" && !confirm(`Confirm ${pkr(t.amount)} (ref ${t.reference}) has arrived in the business account? This opens a deal and holds the car.`)) return;
    if (action === "reject" || action === "refund") {
      staffNote = prompt(action === "reject" ? "Why is this token rejected? (e.g. money not received)" : "Reason for refund") || "";
      if (staffNote.trim().length < 3) return;
    }
    try {
      await api(`/api/dealership/tokens/${t._id}`, { method: "POST", json: { action, staffNote } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="accounting-toolbar dl-toolbar no-print">
        <Chips value={status} options={["requested", "verified", "applied", "refunded", "cancelled"]} counts={data?.counts} onChange={setStatus} />
      </div>
      {error ? <div className="alert err">{error}</div> : null}
      <Panel title="Safe tokens" meta={isAdmin ? "CHECK THE BANK STATEMENT BEFORE VERIFYING" : "ONLY AN ADMIN CAN VERIFY OR REFUND"}>
        {!data ? <EmptyState message="Loading…" /> : !data.tokens.length ? <EmptyState message="No tokens here." /> : (
          <div className="table-scroll">
            <table className="reg">
              <thead><tr><th>Token</th><th>Vehicle</th><th>Buyer</th><th className="right">Amount</th><th>Paid via</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {data.tokens.map((t) => {
                  const expired = t.status === "verified" && t.holdUntil && new Date(t.holdUntil).getTime() < now;
                  return (
                    <tr key={t._id}>
                      <td><b>{t.number}</b><div className="muted small">{prettyDate(t.createdAt)}</div></td>
                      <td>{t.vehicleTitle}{t.dealNumber ? <div className="muted small">Deal {t.dealNumber}</div> : null}</td>
                      <td>{t.name}<div className="muted small">{t.phone}{t.cnicLast4 ? ` · CNIC …${t.cnicLast4}` : ""}</div></td>
                      <td className="num">{pkr(t.amount)}</td>
                      <td>{label(t.method)}<div className="muted small">Ref {t.reference}</div></td>
                      <td>
                        <Pill value={t.status} />
                        {t.holdUntil && t.status === "verified" ? <div className={`small ${expired ? "text-red" : "muted"}`}>{expired ? "Hold expired " : "Held until "}{prettyDate(t.holdUntil)}</div> : null}
                        {t.staffNote ? <div className="muted small">{t.staffNote}</div> : null}
                      </td>
                      <td className="right">
                        {isAdmin && t.status === "requested" ? (
                          <>
                            <button type="button" className="link-btn" onClick={() => act(t, "verify")}>Money received</button>
                            <button type="button" className="link-btn danger" onClick={() => act(t, "reject")}>Reject</button>
                          </>
                        ) : null}
                        {isAdmin && t.status === "verified" ? (
                          <>
                            <button type="button" className="link-btn" onClick={() => act(t, "applied")}>Sale going ahead</button>
                            <button type="button" className="link-btn danger" onClick={() => act(t, "refund")}>Refund</button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* --------------------------------------------------------------- reviews */

type Review = { _id: string; targetType: string; targetId: string; memberName: string; rating: number; comment?: string; status: string; createdAt: string };

export function DealershipReviews() {
  const [status, setStatus] = useState("visible");
  const { data, error, setError, load } = useList<{ reviews: Review[] }>(`/api/shop/reviews${status ? `?status=${status}` : ""}`);

  async function toggle(r: Review) {
    try {
      await api(`/api/shop/reviews/${r._id}`, { method: "POST", json: { status: r.status === "visible" ? "hidden" : "visible" } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="accounting-toolbar dl-toolbar no-print">
        <Chips value={status} options={["visible", "hidden"]} onChange={setStatus} />
      </div>
      {error ? <div className="alert err">{error}</div> : null}
      <Panel title="Reviews" meta="HIDE ABUSIVE OR FAKE REVIEWS; DON'T HIDE HONEST CRITICISM">
        {!data ? <EmptyState message="Loading…" /> : !data.reviews.length ? <EmptyState message="No reviews here." /> : (
          <div className="table-scroll">
            <table className="reg">
              <thead><tr><th>Date</th><th>About</th><th>By</th><th>Rating</th><th>Comment</th><th></th></tr></thead>
              <tbody>
                {data.reviews.map((r) => (
                  <tr key={r._id}>
                    <td>{prettyDate(r.createdAt)}</td>
                    <td>{r.targetType === "dealer" ? `Showroom ${r.targetId}` : "Private seller"}</td>
                    <td>{r.memberName}</td>
                    <td>{"★".repeat(r.rating)}<span className="muted">{"★".repeat(5 - r.rating)}</span></td>
                    <td style={{ maxWidth: 380 }}>{r.comment || <span className="muted">—</span>}</td>
                    <td className="right"><button type="button" className="link-btn" onClick={() => toggle(r)}>{r.status === "visible" ? "Hide" : "Show"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
