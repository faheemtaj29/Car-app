"use client";

import { makeListId, modelListId } from "@/components/CatalogLists";
import { fitmentLabel } from "@/lib/fitment";

export type FitRow = { make: string; model?: string; yearFrom?: number; yearTo?: number };

/** "Fits these vehicles": make + model (blank = all models) + year range. */
export function FitmentEditor({ value, onChange, kind = "car", className = "" }: { value: FitRow[]; onChange: (v: FitRow[]) => void; kind?: "car" | "bike" | "both"; className?: string }) {
  const listKind = kind === "bike" ? "bike" : "car";
  const set = (i: number, patch: Partial<FitRow>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v: string) => (v ? Number(v) : undefined);
  return (
    <div className={`fit-ed ${className}`}>
      {value.map((r, i) => (
        <div key={i} className="fit-row">
          <input value={r.make} onChange={(e) => set(i, { make: e.target.value })} placeholder="Make" list={makeListId(listKind)} autoComplete="off" required aria-label="Make" />
          <input value={r.model || ""} onChange={(e) => set(i, { model: e.target.value })} placeholder="Model (blank = all)" list={modelListId(listKind, r.make)} autoComplete="off" aria-label="Model" />
          <input type="number" value={r.yearFrom ?? ""} onChange={(e) => set(i, { yearFrom: num(e.target.value) })} placeholder="From year" min={1960} aria-label="From year" />
          <input type="number" value={r.yearTo ?? ""} onChange={(e) => set(i, { yearTo: num(e.target.value) })} placeholder="To year" min={1960} aria-label="To year" />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="fit-add" onClick={() => onChange([...value, { make: "" }])}>+ Add a vehicle it fits</button>
      {value.some((r) => r.make) ? <div className="fit-summary">Fits: {value.filter((r) => r.make).map(fitmentLabel).join(" · ")}</div> : null}
    </div>
  );
}
