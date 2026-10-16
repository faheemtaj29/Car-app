"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPKR } from "@/lib/dealership";
import { PROVINCES, compareLeases, monthlyCost, type BankOffer, type CostConfig } from "@/lib/ownership";

const PREF_KEY = "am_cost_prefs_v1";
type Prefs = { dailyKm: number; province: string; financed: boolean; downPct: number; years: number; salary: string };
const DEFAULT_PREFS: Prefs = { dailyKm: 40, province: "Punjab", financed: false, downPct: 30, years: 5, salary: "" };

/** Remembers the buyer's daily km, province and loan choice across cars. */
function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...saved });
    } catch {
      /* storage blocked */
    }
  }, []);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });
  return [prefs, update] as const;
}

/** True monthly cost of owning this car: fuel, maintenance, tax, insurance, instalment. */
export function OwnershipCost({
  costs,
  banks,
  kind,
  price,
  engineCc,
  fuel,
  fuelAverage,
}: {
  costs: CostConfig;
  banks: BankOffer[];
  kind: "car" | "bike";
  price: number;
  engineCc?: number;
  fuel?: string;
  fuelAverage?: number;
}) {
  const [p, set] = usePrefs();
  const bestRate = banks.length ? Math.min(...banks.map((b) => b.markupPct)) : 15;
  const result = useMemo(
    () =>
      monthlyCost(costs, {
        kind,
        price,
        engineCc,
        fuel,
        fuelAverage,
        dailyKm: p.dailyKm,
        province: p.province,
        finance: p.financed ? { downPct: p.downPct, ratePct: bestRate, years: p.years } : null,
      }),
    [costs, kind, price, engineCc, fuel, fuelAverage, p, bestRate]
  );
  const max = Math.max(...result.lines.map((l) => l.monthly), 1);

  return (
    <div className="mt">
      <div className="mt-controls">
        <label>
          Daily driving <b>{p.dailyKm} km</b>
          <input type="range" min={5} max={200} step={5} value={p.dailyKm} onChange={(e) => set({ dailyKm: Number(e.target.value) })} />
        </label>
        <label>
          Province
          <select value={p.province} onChange={(e) => set({ province: e.target.value })}>
            {PROVINCES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="mt-check">
          <input type="checkbox" checked={p.financed} onChange={(e) => set({ financed: e.target.checked })} /> Buying on bank lease ({p.downPct}% down, {p.years} yrs)
        </label>
      </div>
      <div className="mt-total">
        <span>About</span>
        <b>{formatPKR(result.total)}</b>
        <span>a month</span>
      </div>
      <ul className="mt-lines">
        {result.lines.map((l) => (
          <li key={l.key}>
            <span>{l.label}{l.note ? <small> · {l.note}</small> : null}</span>
            <span className="mt-bar"><i style={{ width: `${(l.monthly / max) * 100}%` }} /></span>
            <b>{formatPKR(l.monthly)}</b>
          </li>
        ))}
      </ul>
      <p className="mk-muted small">
        Running cost ≈ <b>Rs {result.perKm}/km</b> over {result.kmMonth.toLocaleString()} km a month. Not included: value lost
        each month (≈ {formatPKR(result.depreciation)} at {costs.depreciationPct}% a year), parking and tolls.
        {costs.updatedNote ? ` ${costs.updatedNote}` : ""}
      </p>
    </div>
  );
}

/** Every bank's lease side by side, cheapest eligible first. */
export function BankLease({ banks, price, carYear, editablePrice = false }: { banks: BankOffer[]; price: number; carYear: number; editablePrice?: boolean }) {
  const [p, set] = usePrefs();
  const [amount, setAmount] = useState(price);
  const [year, setYear] = useState(carYear);
  const rows = useMemo(
    () => compareLeases(banks, { price: amount, downPct: p.downPct, years: p.years, salary: Number(p.salary) || undefined, carYear: year }),
    [banks, amount, p.downPct, p.years, p.salary, year]
  );
  const thisYear = new Date().getFullYear();

  return (
    <div className="mt">
      <div className="mt-controls">
        {editablePrice ? (
          <>
            <label>Car price (PKR)<input type="number" min={100000} step={50000} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} /></label>
            <label>Model year
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {Array.from({ length: 15 }, (_, i) => thisYear + 1 - i).map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </>
        ) : null}
        <label>
          Down payment <b>{p.downPct}% · {formatPKR(Math.round((amount * p.downPct) / 100))}</b>
          <input type="range" min={10} max={80} step={5} value={p.downPct} onChange={(e) => set({ downPct: Number(e.target.value) })} />
        </label>
        <label>
          Tenure
          <div className="mt-chips">
            {[1, 2, 3, 4, 5].map((y) => (
              <button key={y} type="button" className={p.years === y ? "on" : ""} onClick={() => set({ years: y })}>{y} yr</button>
            ))}
          </div>
        </label>
        <label>
          Monthly salary (optional, for eligibility)
          <input type="number" min={0} step={5000} value={p.salary} onChange={(e) => set({ salary: e.target.value })} placeholder="e.g. 250000" />
        </label>
      </div>
      <div className="table-scroll">
        <table className="mt-banks">
          <thead>
            <tr><th>Bank</th><th>Rate</th><th>Monthly</th><th>Upfront</th><th>Total markup</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className={r.eligible ? (i === 0 ? "best" : undefined) : "no"}>
                <td><b>{r.name}</b>{r.islamic ? <small className="mt-tag">Islamic</small> : null}</td>
                <td>{r.markupPct}%</td>
                <td><b>{formatPKR(r.monthly)}</b><small>+ {formatPKR(r.insuranceMonthly)} insurance</small></td>
                <td>{formatPKR(r.upfront)}</td>
                <td>{formatPKR(r.totalMarkup)}</td>
                <td>{r.eligible ? (i === 0 ? <span className="mt-ok">Best value</span> : <span className="mt-ok">Eligible</span>) : <span className="mt-bad">{r.reasons.join(", ")}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mk-muted small">Indicative only. Final rate, insurance and eligibility are decided by the bank.</p>
    </div>
  );
}
