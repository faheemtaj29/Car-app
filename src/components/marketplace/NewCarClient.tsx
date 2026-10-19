"use client";

import { useState } from "react";
import { CITIES } from "@/lib/catalog";

export function NewCarQuoteForm({ carId, variants }: { carId: string; variants: string[] }) {
  const [f, setF] = useState({ name: "", phone: "", city: "", variant: variants[0] || "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/site/new-cars/${carId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not submit");
      setDone(true);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="nc-thanks">
        <b>✓ Request received!</b>
        <p>A dealer from your city will contact you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="nc-quote-form">
      <h4>Get a free quote</h4>
      {variants.length > 1 && (
        <label>
          Variant
          <select value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })}>
            {variants.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      <label>
        Your name
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={100} autoComplete="name" />
      </label>
      <label>
        Mobile number
        <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required inputMode="tel" autoComplete="tel" maxLength={20} />
      </label>
      <label>
        City
        <select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required>
          <option value="">Select city</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>
        Message (optional)
        <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} rows={2} maxLength={500} placeholder="Colour preference, financing needed…" />
      </label>
      {err && <div className="mk-error">{err}</div>}
      <button type="submit" className="site-btn" style={{ width: "100%" }} disabled={busy}>
        {busy ? "Sending…" : "Request a quote"}
      </button>
    </form>
  );
}
