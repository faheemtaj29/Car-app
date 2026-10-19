"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPKR } from "@/lib/dealership";

type Quote = { _id: string; name: string; phone: string; city: string; variant?: string; status: string; createdAt: string };
type Car = { _id: string; make: string; model: string; year: number; published: boolean; variants: { name: string; price: number }[]; photos: string[]; quoteCount: number };

export default function NewCarsAdminPage() {
  const [cars, setCars] = useState<Car[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/dashboard/new-cars");
    if (r.ok) setCars(await r.json());
    else setErr("Failed to load");
  }

  useEffect(() => { load(); }, []);

  async function toggle(id: string, published: boolean) {
    setBusy(true);
    await fetch(`/api/dashboard/new-cars/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !published }) });
    await load();
    setBusy(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this car?")) return;
    await fetch(`/api/dashboard/new-cars/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>New Cars Catalogue</h2>
        <Link href="/dashboard/new-cars/new" className="site-btn">+ Add car</Link>
      </div>
      {err && <p style={{ color: "red" }}>{err}</p>}
      {!cars ? <p>Loading…</p> : (
        <div className="table-scroll">
          <table className="an-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Vehicle</th>
                <th>Variants</th>
                <th>Price range</th>
                <th>Quotes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((c) => {
                const prices = c.variants.map((v) => v.price);
                const lo = Math.min(...prices);
                const hi = Math.max(...prices);
                return (
                  <tr key={c._id}>
                    <td>
                      {c.photos[0]
                        ? <img src={c.photos[0]} alt="" style={{ width: 60, height: 44, objectFit: "cover", borderRadius: 4 }} />
                        : <span style={{ color: "#aaa" }}>—</span>}
                    </td>
                    <td><b>{c.year} {c.make} {c.model}</b></td>
                    <td>{c.variants.length}</td>
                    <td>{prices.length ? (lo === hi ? formatPKR(lo) : `${formatPKR(lo)} – ${formatPKR(hi)}`) : "—"}</td>
                    <td>{c.quoteCount > 0 ? <b style={{ color: "var(--color-primary)" }}>{c.quoteCount} new</b> : "0"}</td>
                    <td><em className={c.published ? "badge-ok" : "badge-warn"}>{c.published ? "Published" : "Draft"}</em></td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <Link href={`/dashboard/new-cars/${c._id}`} className="mk-link">Edit</Link>
                      <button type="button" className="mk-link" disabled={busy} onClick={() => toggle(c._id, c.published)}>
                        {c.published ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" className="mk-link danger" onClick={() => del(c._id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {cars.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#aaa" }}>No cars yet. Add one above.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
