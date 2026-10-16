"use client";

import { FormEvent, useEffect, useState } from "react";
import { BOOKING_LABEL } from "@/lib/booking";

type Type = keyof typeof BOOKING_LABEL;
type Day = { date: string; slots: { slot: string; free: boolean }[] };

const ICON: Record<Type, string> = { test_drive: "🚗", inspection: "🔍", video_call: "📹" };
const HINT: Record<Type, string> = {
  test_drive: "Drive it at our showroom. We keep the car ready for you.",
  inspection: "Our mechanic checks the car where it is: 200+ points, report on WhatsApp.",
  video_call: "See the car live on a WhatsApp video call before you travel.",
};

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Pick a type, a day and a free slot; slots already taken are disabled. */
export function BookingWidget({ listingId, types }: { listingId?: string; types: Type[] }) {
  const [type, setType] = useState<Type>(types[0]);
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ number: string; date: string; slot: string } | null>(null);

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ type, ...(listingId ? { listing: listingId } : {}) });
    fetch(`/api/site/bookings/slots?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        const list: Day[] = d.days || [];
        setDays(list);
        const first = list.find((x) => x.slots.some((s) => s.free));
        setDate(first?.date || "");
        setSlot("");
      })
      .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
  }, [type, listingId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/site/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, listingId, date, slot, ...form, address: form.address || undefined, notes: form.notes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not book");
      setDone({ number: data.booking.number, date, slot });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bk-done">
        <b>✓ {BOOKING_LABEL[type]} requested</b>
        <p>{dayLabel(done.date)} at {done.slot}. Reference <b>{done.number}</b>. We will confirm on your phone shortly.</p>
      </div>
    );
  }

  const day = days?.find((d) => d.date === date);
  return (
    <form className="bk" onSubmit={submit}>
      {types.length > 1 ? (
        <div className="bk-types">
          {types.map((t) => (
            <button key={t} type="button" className={t === type ? "on" : ""} onClick={() => setType(t)}>{ICON[t]} {BOOKING_LABEL[t]}</button>
          ))}
        </div>
      ) : null}
      <p className="mk-muted small">{HINT[type]}</p>
      {!days ? <p className="mk-muted">Loading times…</p> : (
        <>
          <div className="bk-days">
            {days.slice(0, 10).map((d) => {
              const free = d.slots.filter((s) => s.free).length;
              return (
                <button key={d.date} type="button" disabled={!free} className={d.date === date ? "on" : ""} onClick={() => { setDate(d.date); setSlot(""); }}>
                  {dayLabel(d.date)}<small>{free ? `${free} free` : "Full"}</small>
                </button>
              );
            })}
          </div>
          {day ? (
            <div className="bk-slots">
              {day.slots.map((s) => (
                <button key={s.slot} type="button" disabled={!s.free} className={s.slot === slot ? "on" : ""} onClick={() => setSlot(s.slot)}>{s.slot}</button>
              ))}
            </div>
          ) : null}
        </>
      )}
      <div className="bk-fields">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" required minLength={2} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile number (03xx-xxxxxxx)" required inputMode="tel" />
        {type === "inspection" ? <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Where is the car? Full address" required /> : null}
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything we should know? (optional)" />
        <input className="mk-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden="true" />
      </div>
      {error ? <div className="mk-error">{error}</div> : null}
      <button type="submit" className="site-btn" disabled={busy || !slot}>{busy ? "Booking…" : slot ? `Book ${dayLabel(date)} at ${slot}` : "Pick a time"}</button>
    </form>
  );
}
