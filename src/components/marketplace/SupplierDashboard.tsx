"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { FitmentEditor, type FitRow } from "@/components/FitmentEditor";
import { PART_CATEGORIES } from "@/lib/catalog";
import { editableFitments, fitmentLabel } from "@/lib/fitment";
import { formatPKR } from "@/lib/dealership";
import { usePartner } from "./Seller";

type Product = {
  _id: string; title: string; brand?: string; category: string; kind: "car" | "bike" | "both"; condition: "new" | "used" | "refurbished";
  price: number; compareAtPrice?: number; description?: string; images: string[]; universal: boolean; fitments: FitRow[];
  inStock: boolean; delivery: boolean; partNumber?: string; status: string; staffNote?: string; views: number; contacts: number;
  messages: { _id: string; name: string; phone: string; message?: string; at: string; read: boolean }[];
};
type Form = Omit<Product, "_id" | "status" | "staffNote" | "views" | "contacts" | "messages" | "price" | "compareAtPrice"> & { price: string; compareAtPrice: string };

const blank = (): Form => ({ title: "", brand: "", category: "Filters", kind: "car", condition: "new", price: "", compareAtPrice: "", description: "", images: [], universal: false, fitments: [{ make: "" }], inStock: true, delivery: false, partNumber: "" });

/** A supplier's own products: add, edit, mark out of stock, read buyer messages. */
export function SupplierDashboard() {
  const { partner } = usePartner();
  const [rows, setRows] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<{ id?: string; f: Form } | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/site/supplier/products");
    if (res.ok) setRows((await res.json()).products);
  }, []);
  const ready = partner && partner !== "out" && partner.accountType === "supplier" && partner.business?.status === "approved";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready) load();
  }, [ready, load]);
  if (!ready) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    const f = editing.f;
    const body = {
      ...f, price: Number(f.price), compareAtPrice: f.compareAtPrice ? Number(f.compareAtPrice) : undefined,
      brand: f.brand || undefined, description: f.description || undefined, partNumber: f.partNumber || undefined,
      fitments: f.universal ? [] : f.fitments.filter((x) => x.make.trim()).map((x) => ({ ...x, model: x.model || undefined })),
    };
    const res = await fetch(editing.id ? `/api/site/supplier/products/${editing.id}` : "/api/site/supplier/products", {
      method: editing.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Could not save");
    setEditing(null);
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await fetch(`/api/site/supplier/products/${p._id}`, { method: "DELETE" });
    load();
  }

  if (editing) {
    const f = editing.f;
    const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing({ ...editing, f: { ...f, [k]: v } });
    return (
      <form className="site-card site-form" onSubmit={save}>
        <h3>{editing.id ? "Edit product" : "Add a product"}</h3>
        <div className="site-form-section">Photos</div>
        <ImageUploader value={f.images} onChange={(v) => set("images", v)} endpoint="/api/site/member/upload" max={8} />
        <div className="site-form-grid">
          <label>Product name<input value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={4} placeholder="Brake pads front — genuine" /></label>
          <label>Brand<input value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Toyota Genuine, Denso…" /></label>
          <label>Category<select value={f.category} onChange={(e) => set("category", e.target.value)}>{PART_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>For<select value={f.kind} onChange={(e) => set("kind", e.target.value as Form["kind"])}><option value="car">Cars</option><option value="bike">Bikes</option><option value="both">Cars & bikes</option></select></label>
          <label>Condition<select value={f.condition} onChange={(e) => set("condition", e.target.value as Form["condition"])}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
          <label>Part number (OEM)<input value={f.partNumber} onChange={(e) => set("partNumber", e.target.value)} /></label>
          <label>Price (PKR)<input type="number" min={1} value={f.price} onChange={(e) => set("price", e.target.value)} required /></label>
          <label>Was (optional)<input type="number" min={0} value={f.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} /></label>
        </div>
        <div className="site-form-section">Which vehicles does it fit?</div>
        <label className="mk-check-row"><input type="checkbox" checked={f.universal} onChange={(e) => set("universal", e.target.checked)} /> Universal (fits any {f.kind === "bike" ? "bike" : "car"}: oils, car care, gadgets)</label>
        {!f.universal ? <FitmentEditor value={f.fitments} onChange={(v) => set("fitments", v)} kind={f.kind} /> : null}
        <label className="site-form-wide">Description<textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="mk-check-row"><input type="checkbox" checked={f.inStock} onChange={(e) => set("inStock", e.target.checked)} /> In stock</label>
        <label className="mk-check-row"><input type="checkbox" checked={f.delivery} onChange={(e) => set("delivery", e.target.checked)} /> I deliver to other cities</label>
        {error ? <div className="mk-error">{error}</div> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="submit" className="site-btn" disabled={!f.images.length}>{editing.id ? "Save" : "Publish product"}</button>
          <button type="button" className="mk-link" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="site-card">
      <div className="al-head">
        <h3>My products ({rows?.length ?? "…"})</h3>
        <div className="al-actions">
          {partner.business ? <Link className="mk-link" href={`/suppliers/${partner.business.slug}`}>My public shop ↗</Link> : null}
          <button type="button" className="site-btn small" onClick={() => setEditing({ f: blank() })}>+ Add product</button>
        </div>
      </div>
      {!rows?.length ? <p className="mk-muted">No products yet. Add your first one: buyers searching for their exact car will find it.</p> : (
        <ul className="ax-list">
          {rows.map((p) => {
            const unread = p.messages.filter((m) => !m.read).length;
            return (
              <li key={p._id} className="sp-row">
                <div>
                  <b>{p.title}</b> {p.status === "hidden" ? <em className="mk-error">Hidden by staff{p.staffNote ? `: ${p.staffNote}` : ""}</em> : null}
                  <small>{formatPKR(p.price)} · {p.universal ? "Universal" : p.fitments.map(fitmentLabel).join(", ")} · {p.inStock ? "In stock" : "Out of stock"} · {p.views} views · {p.contacts} enquiries</small>
                  {open === p._id ? (
                    <ul className="sp-msgs">{p.messages.slice().reverse().map((m) => <li key={m._id}><b>{m.name}</b> · <a href={`https://wa.me/${m.phone.replace(/\D/g, "").replace(/^0/, "92")}`} target="_blank" rel="noopener noreferrer">{m.phone}</a>{m.message ? ` — ${m.message}` : ""}</li>)}</ul>
                  ) : null}
                </div>
                <span>
                  {p.messages.length ? (
                    <button type="button" className="mk-link" onClick={() => { setOpen(open === p._id ? null : p._id); if (unread) fetch(`/api/site/supplier/products/${p._id}`, { method: "POST" }).then(load); }}>
                      ✉ {p.messages.length}{unread ? ` (${unread} new)` : ""}
                    </button>
                  ) : null}
                  <button type="button" className="mk-link" onClick={() => setEditing({ id: p._id, f: { ...p, brand: p.brand || "", description: p.description || "", partNumber: p.partNumber || "", price: String(p.price), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "", fitments: p.fitments.length ? editableFitments(p.fitments) : [{ make: "" }] } })}>Edit</button>
                  <button type="button" className="mk-link danger" onClick={() => remove(p)}>Delete</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
