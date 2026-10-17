"use client";

import { FormEvent, useState } from "react";

/** "Message the supplier" on a part page. */
export function PartEnquiry({ id }: { id: string }) {
  const [f, setF] = useState({ name: "", phone: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    const res = await fetch(`/api/site/parts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not send");
      return setState("idle");
    }
    setState("sent");
  }
  if (state === "sent") return <div className="bk-done"><b>✓ Message sent</b><p>The supplier will call you back.</p></div>;
  return (
    <form className="bk" onSubmit={submit} style={{ marginTop: 10 }}>
      <div className="bk-fields">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name" required minLength={2} />
        <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Mobile number" required inputMode="tel" />
        <input value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Your car model & year, quantity…" />
        <input className="mk-hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden="true" />
      </div>
      {error ? <div className="mk-error">{error}</div> : null}
      <button type="submit" className="site-btn ghost" disabled={state === "busy"}>Message supplier</button>
    </form>
  );
}
