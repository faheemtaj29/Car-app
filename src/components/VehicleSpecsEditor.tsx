"use client";

import { useState } from "react";
import { SPEC_GROUPS, featureGroupsFor, groupFeatures, specsFor, type Specs, type VehicleKind } from "@/lib/vehicleSpecs";

/**
 * Detailed specs + grouped feature checklist. Self-styled (`vs-*` classes) so
 * the same editor works in the back office and on the public "Post an ad" form.
 */
export function VehicleSpecsEditor({
  kind,
  specs,
  features,
  onSpecs,
  onFeatures,
}: {
  kind: VehicleKind;
  specs: Specs;
  features: string[];
  onSpecs: (s: Specs) => void;
  onFeatures: (f: string[]) => void;
}) {
  const [extra, setExtra] = useState("");
  const fields = specsFor(kind);
  const { other } = groupFeatures(features, kind);
  const has = new Set(features.map((f) => f.toLowerCase()));

  function setSpec(key: string, value: string | number | boolean | undefined) {
    const next = { ...specs };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    onSpecs(next);
  }

  function toggle(name: string) {
    onFeatures(has.has(name.toLowerCase()) ? features.filter((f) => f.toLowerCase() !== name.toLowerCase()) : [...features, name]);
  }

  function addExtra() {
    const items = extra.split(",").map((x) => x.trim()).filter((x) => x && !has.has(x.toLowerCase()));
    if (items.length) onFeatures([...features, ...items]);
    setExtra("");
  }

  const filled = fields.filter((f) => specs[f.key] !== undefined).length;

  return (
    <div className="vs-editor">
      <div className="vs-head">
        <b>Detailed specifications</b>
        <span>{filled} of {fields.length} filled · {features.length} features ticked</span>
      </div>

      {SPEC_GROUPS.map((g, gi) => {
        const list = fields.filter((f) => f.group === g.key);
        if (!list.length) return null;
        const count = list.filter((f) => specs[f.key] !== undefined).length;
        return (
          <details key={g.key} className="vs-group" open={gi === 0}>
            <summary>{g.label}<span>{count}/{list.length}</span></summary>
            <div className="vs-grid">
              {list.map((f) => {
                const v = specs[f.key];
                if (f.type === "bool") {
                  return (
                    <label key={f.key} className="vs-field">
                      <span>{f.label}</span>
                      <select value={v === undefined ? "" : String(v)} onChange={(e) => setSpec(f.key, e.target.value === "" ? undefined : e.target.value === "true")}>
                        <option value="">—</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  );
                }
                if (f.type === "select") {
                  return (
                    <label key={f.key} className="vs-field">
                      <span>{f.label}</span>
                      <select value={v === undefined ? "" : String(v)} onChange={(e) => setSpec(f.key, e.target.value || undefined)}>
                        <option value="">—</option>
                        {f.options!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={f.key} className="vs-field">
                    <span>{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      min={f.min}
                      max={f.max}
                      step="any"
                      value={v === undefined ? "" : String(v)}
                      onChange={(e) => setSpec(f.key, f.type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)}
                      maxLength={80}
                    />
                  </label>
                );
              })}
            </div>
          </details>
        );
      })}

      {featureGroupsFor(kind).map((g) => {
        const count = g.items.filter((i) => has.has(i.toLowerCase())).length;
        return (
          <details key={g.key} className="vs-group">
            <summary>{g.label}<span>{count}/{g.items.length}</span></summary>
            <div className="vs-checks">
              {g.items.map((name) => (
                <label key={name} className={has.has(name.toLowerCase()) ? "on" : ""}>
                  <input type="checkbox" checked={has.has(name.toLowerCase())} onChange={() => toggle(name)} /> {name}
                </label>
              ))}
            </div>
          </details>
        );
      })}

      <div className="vs-extra">
        <span>Other features (not in the lists)</span>
        <div className="vs-extra-row">
          <input value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} placeholder="e.g. Dash cam, Wooden trim" />
          <button type="button" onClick={addExtra}>Add</button>
        </div>
        {other.length ? (
          <div className="vs-tags">
            {other.map((o) => (
              <button type="button" key={o} onClick={() => onFeatures(features.filter((f) => f !== o))} title="Remove">{o} ×</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
