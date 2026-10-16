import { groupFeatures, specRows, specText, specsFor, type Specs, type VehicleKind } from "@/lib/vehicleSpecs";

type Basic = {
  vehicleType: VehicleKind;
  year: number;
  mileage: number;
  fuel?: string;
  transmission?: string;
  engineCc?: number;
  bodyType?: string;
  color?: string;
  specs?: Specs;
};

/** Big at-a-glance strip under the gallery (PakWheels-style). */
export function SpecGlance({ v }: { v: Basic }) {
  const isBike = v.vehicleType === "bike";
  const items: [string, string, string | undefined][] = [
    ["📅", "Model year", String(v.year)],
    ["🛣️", "Mileage", `${v.mileage.toLocaleString()} km`],
    ["⛽", "Fuel", v.fuel],
    ["⚙️", "Transmission", isBike ? undefined : v.transmission],
    ["🔧", "Engine", v.engineCc ? `${v.engineCc.toLocaleString()} cc` : undefined],
    ["🚘", "Body", v.bodyType],
  ];
  for (const f of specsFor(v.vehicleType).filter((x) => x.highlight)) {
    items.push(["•", f.label, specText(f, v.specs?.[f.key])]);
  }
  const shown = items.filter(([, , val]) => val);
  if (!shown.length) return null;
  return (
    <div className="vs-glance">
      {shown.map(([icon, label, val]) => (
        <div key={label}>
          <span className="vs-glance-icon" aria-hidden>{icon === "•" ? "✔" : icon}</span>
          <b>{val}</b>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

/** Detailed spec groups as two-column tables. */
export function SpecTables({ specs, kind }: { specs?: Specs; kind: VehicleKind }) {
  const groups = specRows(specs, kind);
  if (!groups.length) return null;
  return (
    <div className="vs-tables">
      {groups.map((g) => (
        <div key={g.key} className="vs-table">
          <h4>{g.label}</h4>
          <dl>
            {g.rows.map((r) => (
              <div key={r.field.key}>
                <dt>{r.field.label}</dt>
                <dd className={r.field.type === "bool" ? (r.text === "Yes" ? "vs-yes" : "vs-no") : undefined}>
                  {r.field.type === "bool" ? (r.text === "Yes" ? "✓ Yes" : "✗ No") : r.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Grouped features: included ones first, the rest greyed in a fold. */
export function FeatureChecklist({ features, kind }: { features: string[]; kind: VehicleKind }) {
  const { groups, other } = groupFeatures(features, kind);
  const total = features.length;
  if (!total) return null;
  return (
    <div className="vs-features">
      <div className="vs-features-count">{total} feature{total === 1 ? "" : "s"} listed</div>
      {groups.map((g) => {
        const yes = g.items.filter((i) => i.has);
        if (!yes.length) return null;
        const no = g.items.filter((i) => !i.has);
        return (
          <div key={g.key} className="vs-fgroup">
            <h4>{g.label} <span>{yes.length}/{g.items.length}</span></h4>
            <ul>{yes.map((i) => <li key={i.name}>✓ {i.name}</li>)}</ul>
            {no.length ? (
              <details>
                <summary>Not included ({no.length})</summary>
                <ul className="vs-missing">{no.map((i) => <li key={i.name}>✗ {i.name}</li>)}</ul>
              </details>
            ) : null}
          </div>
        );
      })}
      {other.length ? (
        <div className="vs-fgroup">
          <h4>Other</h4>
          <ul>{other.map((o) => <li key={o}>✓ {o}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
