"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatPKR } from "@/lib/dealership";
import { CAR_MODELS, BIKE_MODELS } from "@/lib/catalog";

type Variant = { name: string; engineCc: string; transmission: string; fuel: string; price: string };
type Quote = { _id: string; name: string; phone: string; city: string; variant?: string; message?: string; status: string; createdAt: string };

const emptyVariant = (): Variant => ({ name: "", engineCc: "", transmission: "Manual", fuel: "Petrol", price: "" });

const TRANSMISSIONS = ["Manual", "Automatic", "CVT"];
const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric", "CNG"];

export default function NewCarEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [f, setF] = useState({
    vehicleType: "car" as "car" | "bike", make: "", model: "", year: String(new Date().getFullYear()),
    bodyType: "", fuel: "Petrol", engineCc: "", published: false, sortOrder: "0",
    photos: "", brochureUrl: "", features: "", color: "",
  });
  const [variants, setVariants] = useState<Variant[]>([emptyVariant()]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/dashboard/new-cars/${id}`).then((r) => r.json()).then((d) => {
      setF({
        vehicleType: d.vehicleType, make: d.make, model: d.model, year: String(d.year),
        bodyType: d.bodyType || "", fuel: d.fuel || "Petrol", engineCc: d.engineCc ? String(d.engineCc) : "",
        published: d.published, sortOrder: String(d.sortOrder || 0),
        photos: (d.photos || []).join("\n"), brochureUrl: d.brochureUrl || "",
        features: (d.features || []).join("\n"), color: (d.color || []).join(", "),
      });
      setVariants((d.variants || []).map((v: { name: string; engineCc?: number; transmission?: string; fuel?: string; price: number }) => ({
        name: v.name, engineCc: v.engineCc ? String(v.engineCc) : "",
        transmission: v.transmission || "Manual", fuel: v.fuel || "", price: String(v.price),
      })));
      setQuotes(d.quotes || []);
    }).catch(() => setErr("Failed to load"));
  }, [id, isNew]);

  function setV(i: number, k: keyof Variant, v: string) {
    setVariants((prev) => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }

  async function save() {
    setBusy(true); setErr("");
    const payload = {
      ...f,
      year: Number(f.year),
      engineCc: f.engineCc ? Number(f.engineCc) : undefined,
      sortOrder: Number(f.sortOrder),
      photos: f.photos.split("\n").map((s) => s.trim()).filter(Boolean),
      features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
      color: f.color.split(",").map((s) => s.trim()).filter(Boolean),
      variants: variants.map((v) => ({
        name: v.name, engineCc: v.engineCc ? Number(v.engineCc) : undefined,
        transmission: v.transmission || undefined, fuel: v.fuel || undefined, price: Number(v.price),
      })),
      brochureUrl: f.brochureUrl || undefined,
    };
    try {
      const url = isNew ? "/api/dashboard/new-cars" : `/api/dashboard/new-cars/${id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setSaved(true);
      if (isNew) router.push("/dashboard/new-cars");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function updateQuote(quoteId: string, status: "contacted" | "closed") {
    await fetch(`/api/dashboard/new-cars/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId, status }) });
    setQuotes((q) => q.map((x) => x._id === quoteId ? { ...x, status } : x));
  }

  const makes = f.vehicleType === "bike" ? Object.keys(BIKE_MODELS) : Object.keys(CAR_MODELS);
  const models = (f.vehicleType === "bike" ? BIKE_MODELS : CAR_MODELS)[f.make] || [];

  return (
    <main style={{ padding: "24px 32px", maxWidth: 800 }}>
      <h2>{isNew ? "Add new car" : `Edit ${f.make} ${f.model}`}</h2>
      {err && <p style={{ color: "red" }}>{err}</p>}
      {saved && <p style={{ color: "green" }}>Saved ✓</p>}

      <div className="site-card mk-block" style={{ marginBottom: 24 }}>
        <h3>Basic Info</h3>
        <div className="site-form">
          <label>Type
            <select value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value as "car" | "bike" })}>
              <option value="car">Car</option>
              <option value="bike">Bike</option>
            </select>
          </label>
          <label>Make
            <select value={f.make} onChange={(e) => setF({ ...f, make: e.target.value, model: "" })}>
              <option value="">Select make</option>
              {makes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>Model
            <select value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })}>
              <option value="">Select model</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
              {f.model && !models.includes(f.model) && <option value={f.model}>{f.model}</option>}
            </select>
          </label>
          <label>Year <input type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} min={2000} max={2030} /></label>
          <label>Body type <input value={f.bodyType} onChange={(e) => setF({ ...f, bodyType: e.target.value })} placeholder="Sedan, SUV, Hatchback…" /></label>
          <label>Fuel <select value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })}>{FUELS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Engine cc <input type="number" value={f.engineCc} onChange={(e) => setF({ ...f, engineCc: e.target.value })} /></label>
          <label>Sort order <input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></label>
          <label style={{ gridColumn: "1/-1" }}>
            <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Published (visible on site)
          </label>
        </div>
      </div>

      <div className="site-card mk-block" style={{ marginBottom: 24 }}>
        <h3>Variants & Prices</h3>
        {variants.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <label>Name<input value={v.name} onChange={(e) => setV(i, "name", e.target.value)} required placeholder="1.3 MT" /></label>
            <label>cc<input type="number" value={v.engineCc} onChange={(e) => setV(i, "engineCc", e.target.value)} /></label>
            <label>Gearbox<select value={v.transmission} onChange={(e) => setV(i, "transmission", e.target.value)}>{TRANSMISSIONS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Fuel<select value={v.fuel} onChange={(e) => setV(i, "fuel", e.target.value)}><option value="">—</option>{FUELS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Price (Rs)<input type="number" value={v.price} onChange={(e) => setV(i, "price", e.target.value)} required placeholder="3500000" /></label>
            <button type="button" className="mk-link danger" style={{ paddingBottom: 6 }} onClick={() => setVariants((p) => p.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="mk-link" onClick={() => setVariants((p) => [...p, emptyVariant()])}>+ Add variant</button>
      </div>

      <div className="site-card mk-block" style={{ marginBottom: 24 }}>
        <h3>Photos, Features & Colours</h3>
        <div className="site-form">
          <label className="site-form-wide">Photo URLs (one per line)<textarea value={f.photos} onChange={(e) => setF({ ...f, photos: e.target.value })} rows={3} placeholder="https://…" /></label>
          <label className="site-form-wide">Features (one per line)<textarea value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} rows={4} placeholder="Cruise control&#10;Sunroof&#10;Lane assist…" /></label>
          <label>Available colours (comma-separated)<input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} placeholder="White, Silver, Red" /></label>
          <label>Brochure PDF URL<input value={f.brochureUrl} onChange={(e) => setF({ ...f, brochureUrl: e.target.value })} placeholder="https://…" /></label>
        </div>
      </div>

      <button type="button" className="site-btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>

      {/* Quote requests */}
      {quotes.length > 0 && (
        <div className="site-card mk-block" style={{ marginTop: 32 }}>
          <h3>Quote requests ({quotes.filter((q) => q.status === "new").length} new)</h3>
          <ul className="ax-list">
            {quotes.map((q) => (
              <li key={q._id}>
                <div>
                  <b>{q.name}</b> · {q.phone} · {q.city}{q.variant ? ` · ${q.variant}` : ""}
                  <small>{new Date(q.createdAt).toLocaleDateString("en-GB")}{q.message ? ` — "${q.message}"` : ""}</small>
                </div>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <em className={q.status === "new" ? "badge-warn" : "badge-ok"}>{q.status}</em>
                  {q.status === "new" && <button type="button" className="mk-link" onClick={() => updateQuote(q._id, "contacted")}>Mark contacted</button>}
                  {q.status !== "closed" && <button type="button" className="mk-link" onClick={() => updateQuote(q._id, "closed")}>Close</button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
