"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, Panel } from "@/components/ui";
import { prettyDate } from "@/lib/format";
import { fitmentLabel } from "@/lib/fitment";
import { Pill, api, label, pkr } from "./shared";

type Row = {
  _id: string; name: string; phone: string; email?: string; accountType: string; createdAt: string;
  kyc: { status: string; legalName?: string; cnic?: string; city?: string; submittedAt?: string; reviewedBy?: string; reviewNote?: string };
  business: null | { name: string; slug: string; status: string; city: string; address: string; phone: string; ntn?: string; about?: string; categories?: string[] };
};
type Identity = { legalName: string; cnic: string; address: string; city: string; consentAt: string };

/** Seller identity checks and dealer / supplier applications. */
export function DealershipPartners({ isAdmin }: { isAdmin: boolean }) {
  const [filter, setFilter] = useState<"pending" | "dealer" | "supplier" | "all">("pending");
  const [data, setData] = useState<{ members: Row[]; counts: { kycPending: number; businessPending: number } } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, Identity>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const qs = filter === "pending" ? "?kyc=pending&business=pending" : filter === "all" ? "" : `?type=${filter}`;
    try {
      setData(await api(`/api/shop/partners${qs}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function review(m: Row, target: "kyc" | "business", decision: string) {
    let note: string | undefined;
    if (decision === "rejected" || decision === "suspended") {
      note = prompt("Reason (the seller sees this)") || "";
      if (note.trim().length < 3) return;
    }
    try {
      await api(`/api/shop/partners/${m._id}`, { method: "POST", json: { target, decision, note } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reveal(m: Row) {
    try {
      const id = await api<Identity>(`/api/shop/partners/${m._id}/identity`);
      setRevealed((r) => ({ ...r, [m._id]: id }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="accounting-toolbar dl-toolbar no-print">
        <div className="chips">
          {([["pending", `Waiting (${(data?.counts.kycPending || 0) + (data?.counts.businessPending || 0)})`], ["dealer", "Dealers"], ["supplier", "Suppliers"], ["all", "Everyone verified"]] as const).map(([k, l]) => (
            <button key={k} type="button" className={`filter-chip${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {error ? <div className="alert err">{error}</div> : null}
      <Panel title="Sellers & partners" meta={isAdmin ? "CNIC NUMBERS ARE ENCRYPTED; EVERY VIEW IS LOGGED" : "ONLY AN ADMIN CAN APPROVE OR VIEW CNICS"}>
        {!data ? <EmptyState message="Loading…" /> : !data.members.length ? <EmptyState message="Nothing waiting." /> : (
          <div className="pt-list">
            {data.members.map((m) => {
              const id = revealed[m._id];
              return (
                <div key={m._id} className="pt-card">
                  <div className="pt-col">
                    <b>{m.name}</b> <span className="muted small">{label(m.accountType)} · {m.phone}{m.email ? ` · ${m.email}` : ""} · joined {prettyDate(m.createdAt)}</span>
                    <div className="pt-kyc">
                      <span>Identity: <Pill value={m.kyc.status} /></span>
                      {m.kyc.legalName ? <span>{m.kyc.legalName} · CNIC {id ? <b>{id.cnic}</b> : m.kyc.cnic} · {m.kyc.city}</span> : null}
                      {id ? <span className="muted small">{id.address} · consent given {prettyDate(id.consentAt)}</span> : null}
                      {m.kyc.reviewedBy ? <span className="muted small">Reviewed by {m.kyc.reviewedBy}{m.kyc.reviewNote ? `: ${m.kyc.reviewNote}` : ""}</span> : null}
                    </div>
                    {isAdmin && m.kyc.status !== "none" ? (
                      <div className="pt-actions">
                        {!id ? <button type="button" className="link-btn" onClick={() => reveal(m)}>Show full CNIC & address</button> : null}
                        {m.kyc.status !== "verified" ? <button type="button" className="link-btn" onClick={() => review(m, "kyc", "verified")}>✓ Identity verified</button> : null}
                        {m.kyc.status !== "rejected" ? <button type="button" className="link-btn danger" onClick={() => review(m, "kyc", "rejected")}>Reject identity</button> : null}
                      </div>
                    ) : null}
                  </div>
                  {m.business ? (
                    <div className="pt-col">
                      <b>{m.business.name}</b> <Pill value={m.business.status} />
                      <span className="muted small">{m.business.address}, {m.business.city} · {m.business.phone}{m.business.ntn ? ` · NTN ${m.business.ntn}` : ""}</span>
                      {m.business.categories?.length ? <span className="muted small">{m.business.categories.join(", ")}</span> : null}
                      {m.business.about ? <span className="small">{m.business.about}</span> : null}
                      {isAdmin ? (
                        <div className="pt-actions">
                          {m.business.status !== "approved" ? <button type="button" className="link-btn" onClick={() => review(m, "business", "approved")} disabled={m.kyc.status !== "verified"} title={m.kyc.status !== "verified" ? "Verify identity first" : ""}>✓ Approve business</button> : null}
                          {m.business.status === "pending" ? <button type="button" className="link-btn danger" onClick={() => review(m, "business", "rejected")}>Reject</button> : null}
                          {m.business.status === "approved" ? <button type="button" className="link-btn danger" onClick={() => review(m, "business", "suspended")}>Suspend</button> : null}
                          {m.business.status === "approved" ? <a className="link-btn" href={`/${m.accountType === "dealer" ? "dealers" : "suppliers"}/${m.business.slug}`} target="_blank" rel="noreferrer">Public page ↗</a> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

type SP = { _id: string; title: string; supplierName: string; category: string; price: number; universal: boolean; fitments: { make: string; model?: string; yearFrom?: number; yearTo?: number }[]; status: string; staffNote?: string; images: string[]; createdAt: string };

/** Online Shop → Supplier products: hide anything misleading or not allowed. */
export function SupplierProducts() {
  const [status, setStatus] = useState("active");
  const [rows, setRows] = useState<SP[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setRows((await api<{ products: SP[] }>(`/api/shop/supplier-products?status=${status}`)).products);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  async function act(p: SP, next: "active" | "hidden") {
    const note = next === "hidden" ? prompt("Why hide it? (the supplier sees this)") || "" : undefined;
    if (next === "hidden" && (note || "").trim().length < 3) return;
    try {
      await api(`/api/shop/supplier-products/${p._id}`, { method: "POST", json: { status: next, note } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        {["active", "hidden"].map((s) => <button key={s} type="button" className={`filter-chip${status === s ? " active" : ""}`} onClick={() => setStatus(s)}>{label(s)}</button>)}
      </div>
      {error ? <div className="alert err">{error}</div> : null}
      <Panel title="Supplier products" meta="LISTED BY REGISTERED SUPPLIERS; BUYERS CONTACT THEM DIRECTLY">
        {!rows ? <EmptyState message="Loading…" /> : !rows.length ? <EmptyState message="Nothing here." /> : (
          <div className="table-scroll">
            <table className="reg">
              <thead><tr><th></th><th>Product</th><th>Supplier</th><th>Fits</th><th className="right">Price</th><th></th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id}>
                    <td><div className="dl-thumb" style={p.images[0] ? { backgroundImage: `url("${p.images[0]}")` } : undefined} /></td>
                    <td><b>{p.title}</b><div className="muted small">{p.category} · {prettyDate(p.createdAt)}</div>{p.staffNote ? <div className="muted small">Note: {p.staffNote}</div> : null}</td>
                    <td>{p.supplierName}</td>
                    <td className="small">{p.universal ? "Universal" : p.fitments.map(fitmentLabel).join(", ")}</td>
                    <td className="num">{pkr(p.price)}</td>
                    <td className="right">
                      <a className="link-btn" href={`/parts/${p._id}`} target="_blank" rel="noreferrer">View</a>
                      {p.status === "active" ? <button type="button" className="link-btn danger" onClick={() => act(p, "hidden")}>Hide</button> : <button type="button" className="link-btn" onClick={() => act(p, "active")}>Show</button>}
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
