"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthPanel, call, useMe } from "./Member";
import { ProductCard } from "./ShopCards";
import type { PublicProduct } from "@/backend/services/shop.service";
import { SERVICE_TYPES, type Reminder } from "@/lib/garage";
import { PROVINCES } from "@/lib/ownership";
import { formatPKR } from "@/lib/dealership";

type Entry = { _id: string; date: string; km: number; type: string; cost: number; garage?: string; notes?: string };
type Car = {
  _id: string; vehicleType: "car" | "bike"; make: string; model: string; variant?: string; year: number; engineCc?: number;
  fuel?: string; transmission?: string; color?: string; registrationNo?: string; province: string; km: number; dailyKm: number;
  oilIntervalKm: number; lastOilKm?: number; serviceIntervalKm: number; lastServiceKm?: number; tokenTaxDue?: string; insuranceDue?: string;
  serviceLog: Entry[]; estimatedKm: number; reminders: Reminder[]; attention: number;
};

type CarForm = Record<"make" | "model" | "variant" | "year" | "engineCc" | "fuel" | "transmission" | "color" | "registrationNo" | "province" | "km" | "dailyKm" | "oilIntervalKm" | "lastOilKm" | "serviceIntervalKm" | "lastServiceKm" | "tokenTaxDue" | "insuranceDue", string> & { vehicleType: "car" | "bike" };

const blank = (): CarForm => ({
  vehicleType: "car", make: "", model: "", variant: "", year: String(new Date().getFullYear() - 3), engineCc: "", fuel: "Petrol", transmission: "Automatic",
  color: "", registrationNo: "", province: "Punjab", km: "", dailyKm: "30", oilIntervalKm: "5000", lastOilKm: "", serviceIntervalKm: "10000", lastServiceKm: "",
  tokenTaxDue: "", insuranceDue: "",
});

const day = (v?: string) => (v ? v.slice(0, 10) : "");
const toForm = (c: Car): CarForm => ({
  vehicleType: c.vehicleType, make: c.make, model: c.model, variant: c.variant || "", year: String(c.year), engineCc: c.engineCc ? String(c.engineCc) : "",
  fuel: c.fuel || "", transmission: c.transmission || "", color: c.color || "", registrationNo: c.registrationNo || "", province: c.province,
  km: String(c.estimatedKm), dailyKm: String(c.dailyKm), oilIntervalKm: String(c.oilIntervalKm), lastOilKm: c.lastOilKm != null ? String(c.lastOilKm) : "",
  serviceIntervalKm: String(c.serviceIntervalKm), lastServiceKm: c.lastServiceKm != null ? String(c.lastServiceKm) : "",
  tokenTaxDue: day(c.tokenTaxDue), insuranceDue: day(c.insuranceDue),
});

function payload(f: CarForm) {
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  return {
    ...f, year: Number(f.year), engineCc: num(f.engineCc), km: Number(f.km || 0), dailyKm: Number(f.dailyKm || 0),
    oilIntervalKm: Number(f.oilIntervalKm), lastOilKm: num(f.lastOilKm), serviceIntervalKm: Number(f.serviceIntervalKm), lastServiceKm: num(f.lastServiceKm),
    tokenTaxDue: f.tokenTaxDue || undefined, insuranceDue: f.insuranceDue || undefined,
    variant: f.variant || undefined, registrationNo: f.registrationNo || undefined, color: f.color || undefined,
  };
}

const ICON: Record<Reminder["key"], string> = { oil: "🛢️", service: "🔧", token: "🧾", insurance: "🛡️" };

export function GarageApp() {
  const { state, reload } = useMe();
  const [cars, setCars] = useState<Car[] | null>(null);
  const [editing, setEditing] = useState<{ id?: string; form: CarForm } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setCars((await call<{ cars: Car[] }>("/api/site/garage")).cars);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state === "in") load();
  }, [state, load]);

  if (state === "loading") return <p className="mk-muted">Loading…</p>;
  if (state === "out") return <AuthPanel onDone={reload} intro="Log in or create a free account to keep your car's service record and get reminders." />;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await call(editing.id ? `/api/site/garage/${editing.id}` : "/api/site/garage", editing.id ? "PUT" : "POST", payload(editing.form));
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (editing) {
    const f = editing.form;
    const set = (k: keyof CarForm, v: string) => setEditing({ ...editing, form: { ...f, [k]: v } });
    return (
      <form className="site-form site-form-admission" onSubmit={save}>
        {error ? <div className="mk-error">{error}</div> : null}
        <div className="mk-chips" style={{ marginBottom: 12 }}>
          {(["car", "bike"] as const).map((t) => (
            <button key={t} type="button" className={f.vehicleType === t ? "active" : ""} onClick={() => setEditing({ ...editing, form: { ...f, vehicleType: t, oilIntervalKm: t === "bike" ? "1500" : "5000", serviceIntervalKm: t === "bike" ? "3000" : "10000" } })}>
              {t === "car" ? "🚗 Car" : "🏍️ Motorbike"}
            </button>
          ))}
        </div>
        <div className="site-form-section">Your vehicle</div>
        <div className="site-form-grid">
          <label>Make<input value={f.make} onChange={(e) => set("make", e.target.value)} required /></label>
          <label>Model<input value={f.model} onChange={(e) => set("model", e.target.value)} required /></label>
          <label>Variant<input value={f.variant} onChange={(e) => set("variant", e.target.value)} /></label>
          <label>Model year<input type="number" value={f.year} onChange={(e) => set("year", e.target.value)} required /></label>
          <label>Engine (cc)<input type="number" min={0} value={f.engineCc} onChange={(e) => set("engineCc", e.target.value)} /></label>
          <label>Fuel<select value={f.fuel} onChange={(e) => set("fuel", e.target.value)}>{["Petrol", "Diesel", "Hybrid", "Electric", "CNG"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Registration no.<input value={f.registrationNo} onChange={(e) => set("registrationNo", e.target.value.toUpperCase())} placeholder="LEA-22-1234" /></label>
          <label>Province<select value={f.province} onChange={(e) => set("province", e.target.value)}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        <div className="site-form-section">Odometer & reminders</div>
        <div className="site-form-grid">
          <label>Odometer now (km)<input type="number" min={0} value={f.km} onChange={(e) => set("km", e.target.value)} required /></label>
          <label>Daily driving (km)<input type="number" min={0} value={f.dailyKm} onChange={(e) => set("dailyKm", e.target.value)} /></label>
          <label>Oil change every (km)<input type="number" min={500} value={f.oilIntervalKm} onChange={(e) => set("oilIntervalKm", e.target.value)} /></label>
          <label>Last oil change at (km)<input type="number" min={0} value={f.lastOilKm} onChange={(e) => set("lastOilKm", e.target.value)} /></label>
          <label>Service every (km)<input type="number" min={1000} value={f.serviceIntervalKm} onChange={(e) => set("serviceIntervalKm", e.target.value)} /></label>
          <label>Last service at (km)<input type="number" min={0} value={f.lastServiceKm} onChange={(e) => set("lastServiceKm", e.target.value)} /></label>
          <label>Token tax due<input type="date" value={f.tokenTaxDue} onChange={(e) => set("tokenTaxDue", e.target.value)} /></label>
          <label>Insurance renewal<input type="date" value={f.insuranceDue} onChange={(e) => set("insuranceDue", e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" className="site-btn">{editing.id ? "Save" : "Add to my garage"}</button>
          <button type="button" className="mk-link" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="gr">
      {error ? <div className="mk-error">{error}</div> : null}
      {!cars ? <p className="mk-muted">Loading…</p> : null}
      {cars && !cars.length ? (
        <div className="site-card gr-empty">
          <h3>Add your car or bike</h3>
          <p>We&apos;ll remind you when the oil change, service, token tax and insurance are due, keep a service record that raises your resale value, and show parts that fit.</p>
          <button type="button" className="site-btn" onClick={() => setEditing({ form: blank() })}>+ Add my vehicle</button>
        </div>
      ) : null}
      {cars?.map((c) => <GarageCard key={c._id} car={c} onEdit={() => setEditing({ id: c._id, form: toForm(c) })} onChanged={load} />)}
      {cars && cars.length ? <button type="button" className="mk-link" onClick={() => setEditing({ form: blank() })}>+ Add another vehicle</button> : null}
    </div>
  );
}

function GarageCard({ car, onEdit, onChanged }: { car: Car; onEdit: () => void; onChanged: () => void }) {
  const [log, setLog] = useState(false);
  const [entry, setEntry] = useState({ type: "Oil change", km: String(car.estimatedKm), cost: "", garage: "", date: new Date().toISOString().slice(0, 10), nextDue: "", notes: "" });
  const [parts, setParts] = useState<{ products: PublicProduct[]; oilDue: boolean } | null>(null);
  const [error, setError] = useState("");
  const title = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;

  useEffect(() => {
    call<{ products: PublicProduct[]; oilDue: boolean }>(`/api/site/garage/${car._id}/parts`).then(setParts).catch(() => undefined);
  }, [car._id, car.serviceLog.length]);

  async function addEntry(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await call(`/api/site/garage/${car._id}/service`, "POST", { ...entry, km: Number(entry.km), cost: Number(entry.cost || 0), nextDue: entry.nextDue || undefined, garage: entry.garage || undefined, notes: entry.notes || undefined });
      setLog(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeCar() {
    if (!confirm(`Remove ${title} and its service record?`)) return;
    await call(`/api/site/garage/${car._id}`, "DELETE").catch(() => undefined);
    onChanged();
  }

  const spent = car.serviceLog.reduce((s, x) => s + (x.cost || 0), 0);

  return (
    <div className="site-card gr-car">
      <div className="gr-head">
        <div>
          <h3>{car.vehicleType === "bike" ? "🏍️" : "🚗"} {title}</h3>
          <div className="mk-muted">{car.registrationNo || "No plate added"} · ~{car.estimatedKm.toLocaleString()} km today · {car.province}</div>
        </div>
        <div className="gr-actions">
          <button type="button" className="mk-link" onClick={onEdit}>Edit</button>
          <a className="mk-link" href={`/api/site/garage/${car._id}/calendar`}>📅 Add reminders to calendar</a>
          <Link className="mk-link" href={`/post-ad?garage=${car._id}`}>Sell this {car.vehicleType}</Link>
          <button type="button" className="mk-link danger" onClick={removeCar}>Remove</button>
        </div>
      </div>

      <div className="gr-reminders">
        {car.reminders.map((r) => (
          <div key={r.key} className={`gr-rem ${r.status}`}>
            <span className="gr-icon">{ICON[r.key]}</span>
            <div>
              <b>{r.label}</b>
              <small>{r.detail}</small>
            </div>
            <span className="gr-status">{r.status === "overdue" ? "Overdue" : r.status === "soon" ? "Due soon" : r.status === "ok" ? "OK" : "Set up"}</span>
          </div>
        ))}
      </div>

      <div className="gr-log-head">
        <h4>Service record {car.serviceLog.length ? <small>· {car.serviceLog.length} {car.serviceLog.length === 1 ? "entry" : "entries"} · {formatPKR(spent)} spent</small> : null}</h4>
        <button type="button" className="site-btn small" onClick={() => setLog((v) => !v)}>{log ? "Close" : "+ Log service"}</button>
      </div>
      {log ? (
        <form className="gr-entry" onSubmit={addEntry}>
          {error ? <div className="mk-error">{error}</div> : null}
          <label>What was done<select value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value })}>{SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Date<input type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} /></label>
          <label>Odometer (km)<input type="number" min={0} value={entry.km} onChange={(e) => setEntry({ ...entry, km: e.target.value })} required /></label>
          <label>Cost (Rs)<input type="number" min={0} value={entry.cost} onChange={(e) => setEntry({ ...entry, cost: e.target.value })} /></label>
          <label>Workshop<input value={entry.garage} onChange={(e) => setEntry({ ...entry, garage: e.target.value })} /></label>
          {entry.type === "Token tax paid" || entry.type === "Insurance renewed" ? (
            <label>Next due<input type="date" value={entry.nextDue} onChange={(e) => setEntry({ ...entry, nextDue: e.target.value })} /></label>
          ) : null}
          <label className="gr-wide">Notes<input value={entry.notes} onChange={(e) => setEntry({ ...entry, notes: e.target.value })} placeholder="Oil grade, parts replaced…" /></label>
          <button type="submit" className="site-btn">Save entry</button>
        </form>
      ) : null}
      {car.serviceLog.length ? (
        <ul className="gr-log">
          {car.serviceLog.slice(0, 8).map((x) => (
            <li key={x._id}>
              <span>{new Date(x.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              <b>{x.type}</b>
              <span>{x.km.toLocaleString()} km{x.garage ? ` · ${x.garage}` : ""}</span>
              <span>{x.cost ? formatPKR(x.cost) : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mk-muted small">A complete service record can add real value when you sell. It is attached automatically if you sell through this site.</p>
      )}

      {parts?.products.length ? (
        <div className="gr-parts">
          <h4>{parts.oilDue ? "Oil change due — products that fit" : `Parts & accessories for your ${car.model}`}</h4>
          <div className="mk-grid small">{parts.products.slice(0, 4).map((p) => <ProductCard key={p._id} p={p} />)}</div>
          <Link href={`/shop?fit=${car.vehicleType}&q=${encodeURIComponent(car.model)}`} className="site-link">More for {car.make} {car.model} →</Link>
        </div>
      ) : null}
    </div>
  );
}
