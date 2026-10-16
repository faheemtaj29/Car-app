"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyState, Field, Hero, ModalForm, Panel, inputClass } from "@/components/ui";
import { THEME_PRESETS } from "@/lib/theme";
import { prettyDate } from "@/lib/format";

type Branch = { code: string; name: string; address?: string; phone?: string };
type Settings = {
  businessName: string; tagline?: string; registrationNo?: string; ntn?: string; address?: string; phone?: string;
  whatsapp?: string; email?: string; facebook?: string; instagram?: string; currency: string;
  taxEnabled: boolean; taxName: string; taxRate: number; taxInclusive: boolean;
  defaultBranchCode: string; branches: Branch[];
  theme: { preset: string; primary: string; accent: string; sidebar: string; surface: string; radius: number; solid: boolean };
};
type User = { _id: string; name: string; email: string; phone?: string; role: "admin" | "staff"; isActive: boolean; lastLoginAt?: string };

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [uf, setUf] = useState({ name: "", email: "", phone: "", role: "staff", password: "", isActive: true });
  const [uErr, setUErr] = useState("");

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/users");
    if (r.ok) setUsers((await r.json()).users);
  }, []);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, [loadUsers]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!s) return;
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Settings saved. Reload to see the new name and colours everywhere." } : { ok: false, text: data.error || "Could not save" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openUser(u: User | null) {
    setUErr("");
    setEditing(u);
    setCreating(!u);
    setUf(u ? { name: u.name, email: u.email, phone: u.phone || "", role: u.role, password: "", isActive: u.isActive } : { name: "", email: "", phone: "", role: "staff", password: "", isActive: true });
  }

  async function saveUser(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(editing ? `/api/users/${editing._id}` : "/api/users", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uf),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUErr(data.error || "Could not save");
      return;
    }
    setEditing(null);
    setCreating(false);
    loadUsers();
  }

  if (!s) return <EmptyState message="Loading settings…" />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => (x ? { ...x, [k]: v } : x));
  const setBranch = (i: number, patch: Partial<Branch>) => set("branches", s.branches.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <>
      <Hero title="Settings" subtitle="Business profile, branches, tax, look & feel and staff accounts" />
      {msg ? <div className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</div> : null}
      <form onSubmit={save}>
        <Panel title="Business profile" meta="SHOWN ON THE WEBSITE AND DOCUMENTS">
          <div className="form-grid three">
            <Field label="Business name" required><input className={inputClass} value={s.businessName} onChange={(e) => set("businessName", e.target.value)} required /></Field>
            <Field label="Tagline"><input className={inputClass} value={s.tagline || ""} onChange={(e) => set("tagline", e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={s.phone || ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="WhatsApp"><input className={inputClass} value={s.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="03xx-xxxxxxx" /></Field>
            <Field label="Email"><input className={inputClass} type="email" value={s.email || ""} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Address"><input className={inputClass} value={s.address || ""} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="Facebook page URL"><input className={inputClass} value={s.facebook || ""} onChange={(e) => set("facebook", e.target.value)} /></Field>
            <Field label="Instagram URL"><input className={inputClass} value={s.instagram || ""} onChange={(e) => set("instagram", e.target.value)} /></Field>
            <Field label="NTN / registration"><input className={inputClass} value={s.ntn || ""} onChange={(e) => set("ntn", e.target.value)} /></Field>
          </div>
        </Panel>

        <Panel title="Branches / showrooms" meta={`DEFAULT ${s.defaultBranchCode}`}>
          {s.branches.map((b, i) => (
            <div className="form-grid three" key={i} style={{ alignItems: "end" }}>
              <Field label="Code"><input className={inputClass} value={b.code} onChange={(e) => setBranch(i, { code: e.target.value.toUpperCase() })} maxLength={12} required /></Field>
              <Field label="Name"><input className={inputClass} value={b.name} onChange={(e) => setBranch(i, { name: e.target.value })} required /></Field>
              <Field label="Phone / address">
                <div style={{ display: "flex", gap: 8 }}>
                  <input className={inputClass} value={b.phone || ""} onChange={(e) => setBranch(i, { phone: e.target.value })} placeholder="Phone" />
                  <input className={inputClass} value={b.address || ""} onChange={(e) => setBranch(i, { address: e.target.value })} placeholder="Address" />
                  <button type="button" className="link-btn" onClick={() => set("defaultBranchCode", b.code)} disabled={s.defaultBranchCode === b.code}>{s.defaultBranchCode === b.code ? "Default" : "Make default"}</button>
                  {s.branches.length > 1 ? <button type="button" className="link-btn danger" onClick={() => set("branches", s.branches.filter((_, j) => j !== i))}>Remove</button> : null}
                </div>
              </Field>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => set("branches", [...s.branches, { code: `BR${s.branches.length + 1}`, name: "" }])}>+ Add branch</button>
        </Panel>

        <div className="grid-2">
          <Panel title="Tax">
            <label className="check-row"><input type="checkbox" checked={s.taxEnabled} onChange={(e) => set("taxEnabled", e.target.checked)} /> Charge tax on manual receipts</label>
            <div className="form-grid three">
              <Field label="Tax name"><input className={inputClass} value={s.taxName} onChange={(e) => set("taxName", e.target.value)} /></Field>
              <Field label="Rate %"><input className={inputClass} type="number" min={0} max={100} step={0.01} value={s.taxRate} onChange={(e) => set("taxRate", Number(e.target.value))} /></Field>
              <Field label="Currency"><input className={inputClass} value={s.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} /></Field>
            </div>
            <label className="check-row"><input type="checkbox" checked={s.taxInclusive} onChange={(e) => set("taxInclusive", e.target.checked)} /> Prices include tax</label>
          </Panel>
          <Panel title="Look & feel">
            <div className="chips">
              {THEME_PRESETS.map((p) => (
                <button key={p.key} type="button" className={`filter-chip${s.theme.preset === p.key ? " active" : ""}`} onClick={() => set("theme", { ...s.theme, primary: p.primary, accent: p.accent, sidebar: p.sidebar, surface: p.surface, preset: p.key })}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <Field label="Primary colour"><input className={inputClass} type="color" value={s.theme.primary} onChange={(e) => set("theme", { ...s.theme, primary: e.target.value, preset: "custom" })} /></Field>
              <Field label="Accent colour"><input className={inputClass} type="color" value={s.theme.accent} onChange={(e) => set("theme", { ...s.theme, accent: e.target.value, preset: "custom" })} /></Field>
            </div>
          </Panel>
        </div>
        <div className="form-actions"><button type="submit" className="btn-dark">Save settings</button></div>
      </form>

      <Panel title="Staff accounts" meta="ADMINS SEE EVERYTHING · STAFF: SALES, SHOP & STOCK">
        <div className="table-scroll">
          <table className="reg">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td><b>{u.name}</b><div className="muted small">{u.phone || ""}</div></td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td><span className={`badge ${u.isActive ? "present" : "absent"}`}>{u.isActive ? "active" : "disabled"}</span></td>
                  <td>{prettyDate(u.lastLoginAt)}</td>
                  <td className="right"><button type="button" className="link-btn" onClick={() => openUser(u)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={() => openUser(null)}>+ Add staff member</button>
      </Panel>

      <ModalForm open={creating || Boolean(editing)} title={editing ? `Edit ${editing.name}` : "New staff member"} onClose={() => { setCreating(false); setEditing(null); }} onSubmit={saveUser} submitLabel="Save">
        {uErr ? <div className="alert err">{uErr}</div> : null}
        <div className="form-grid">
          <Field label="Name" required><input className={inputClass} value={uf.name} onChange={(e) => setUf({ ...uf, name: e.target.value })} required /></Field>
          <Field label="Email" required><input className={inputClass} type="email" value={uf.email} onChange={(e) => setUf({ ...uf, email: e.target.value })} required /></Field>
          <Field label="Phone"><input className={inputClass} value={uf.phone} onChange={(e) => setUf({ ...uf, phone: e.target.value })} /></Field>
          <Field label="Role">
            <select className={inputClass} value={uf.role} onChange={(e) => setUf({ ...uf, role: e.target.value })}>
              <option value="staff">Staff (sales, shop, stock)</option>
              <option value="admin">Admin (everything incl. accounts)</option>
            </select>
          </Field>
          <Field label={editing ? "New password (leave blank to keep)" : "Password"} required={!editing}>
            <input className={inputClass} type="password" value={uf.password} onChange={(e) => setUf({ ...uf, password: e.target.value })} minLength={8} required={!editing} autoComplete="new-password" />
          </Field>
          <label className="check-row" style={{ alignSelf: "end" }}><input type="checkbox" checked={uf.isActive} onChange={(e) => setUf({ ...uf, isActive: e.target.checked })} /> Can sign in</label>
        </div>
      </ModalForm>
    </>
  );
}
