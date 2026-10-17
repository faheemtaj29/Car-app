"use client";

import { useState } from "react";
import { makesFor, modelsFor, yearOptions } from "@/lib/catalog";

/** "Shop for your vehicle": make → model → year, then only parts that fit are shown. */
export function VehiclePicker({ action, kind, make, model, year, universal, keep }: {
  action: string; kind: "car" | "bike"; make?: string; model?: string; year?: number; universal?: boolean; keep: Record<string, string | undefined>;
}) {
  const [k, setK] = useState(kind);
  const [mk, setMk] = useState(make || "");
  const [md, setMd] = useState(model || "");
  const models = mk ? modelsFor(k, mk) : [];
  return (
    <form className="vp" method="get" action={action}>
      {Object.entries(keep).map(([n, v]) => (v ? <input key={n} type="hidden" name={n} value={v} /> : null))}
      <b className="vp-title">🔧 Parts for my vehicle</b>
      <select name="kind" value={k} onChange={(e) => { setK(e.target.value as "car" | "bike"); setMk(""); setMd(""); }} aria-label="Vehicle type">
        <option value="car">Car</option>
        <option value="bike">Bike</option>
      </select>
      <select name="make" value={mk} onChange={(e) => { setMk(e.target.value); setMd(""); }} aria-label="Make">
        <option value="">All makes</option>
        {makesFor(k, make ? [make] : []).map((m) => <option key={m}>{m}</option>)}
      </select>
      <select name="model" value={md} onChange={(e) => setMd(e.target.value)} aria-label="Model" disabled={!mk}>
        <option value="">{mk ? `All ${mk} models` : "Model"}</option>
        {[...new Set([...models, ...(model && !models.includes(model) ? [model] : [])])].map((m) => <option key={m}>{m}</option>)}
      </select>
      <select name="year" defaultValue={year ? String(year) : ""} aria-label="Year" disabled={!mk}>
        <option value="">Any year</option>
        {yearOptions(1990).map((y) => <option key={y}>{y}</option>)}
      </select>
      <label className="vp-uni"><input type="checkbox" name="universal" value="1" defaultChecked={universal} /> Also show universal items</label>
      <button type="submit" className="site-btn">Show parts</button>
    </form>
  );
}
