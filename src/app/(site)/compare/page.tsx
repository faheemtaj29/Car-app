import Link from "next/link";
import type { Metadata } from "next";
import { marketplaceService, type PublicListing } from "@/backend/services/marketplace.service";
import { listingHref } from "@/components/marketplace/Listing";
import { formatPKR, inspectionGrade, PRICE_RATING_LABEL } from "@/lib/dealership";
import { monthlyCost, type CostConfig } from "@/lib/ownership";
import { settingsService } from "@/backend/services/settings.service";
import { SPEC_FIELDS, SPEC_GROUPS, groupFeatures, specText } from "@/lib/vehicleSpecs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare vehicles", robots: { index: false } };

type Search = Promise<{ [key: string]: string | string[] | undefined }>;
type Row = { label: string; value: (c: PublicListing) => string; best?: (cs: PublicListing[]) => string | undefined };

const minBy = (cs: PublicListing[], f: (c: PublicListing) => number | undefined) => {
  const vals = cs.map((c) => ({ id: c._id, v: f(c) })).filter((x) => typeof x.v === "number") as { id: string; v: number }[];
  if (vals.length < 2) return undefined;
  const best = Math.min(...vals.map((x) => x.v));
  return vals.filter((x) => x.v === best).length === 1 ? vals.find((x) => x.v === best)!.id : undefined;
};
const maxBy = (cs: PublicListing[], f: (c: PublicListing) => number | undefined) =>
  minBy(cs, (c) => {
    const v = f(c);
    return typeof v === "number" ? -v : undefined;
  });

const ROWS: Row[] = [
  { label: "Price", value: (c) => formatPKR(c.price), best: (cs) => minBy(cs, (c) => c.price) },
  { label: "Market rating", value: (c) => (c.insight ? `${PRICE_RATING_LABEL[c.insight.rating]} (${c.insight.deltaPct > 0 ? "+" : ""}${c.insight.deltaPct}%)` : "—"), best: (cs) => minBy(cs, (c) => c.insight?.deltaPct) },
  { label: "Model year", value: (c) => String(c.year), best: (cs) => maxBy(cs, (c) => c.year) },
  { label: "Mileage", value: (c) => `${c.mileage.toLocaleString()} km`, best: (cs) => minBy(cs, (c) => c.mileage) },
  { label: "Inspection", value: (c) => (c.inspection?.overall != null ? `${c.inspection.overall}/10 · ${inspectionGrade(c.inspection.overall)}` : "Not inspected"), best: (cs) => maxBy(cs, (c) => c.inspection?.overall ?? undefined) },
  { label: "Engine", value: (c) => (c.engineCc ? `${c.engineCc} cc` : "—") },
  { label: "Fuel", value: (c) => c.fuel || "—" },
  { label: "Transmission", value: (c) => c.transmission || "—" },
  { label: "Body", value: (c) => c.bodyType || "—" },
  { label: "Colour", value: (c) => c.color || "—" },
  { label: "Condition", value: (c) => c.condition },
  { label: "Registered in", value: (c) => c.registeredIn || "—" },
  { label: "Location", value: (c) => c.city || c.branch?.name || "—" },
  { label: "Seller", value: (c) => (c.seller.type === "dealer" ? `Dealer${c.seller.name ? ` · ${c.seller.name}` : ""}` : `Private · ${c.seller.name || ""}`) },
];

/** Higher is better for these numeric specs; lower is better for none we list. */
const HIGHER_BETTER = new Set(["fuelAverageCity", "fuelAverageHighway", "horsepower", "torque", "seats", "bootSpace", "electricRange", "tyreLife", "tokenTaxPaidUpTo", "keys", "groundClearance"]);
const OWNERSHIP_RANK: Record<string, number> = { "First owner": 1, "Second owner": 2, "Third owner": 3, "Fourth owner or more": 4 };

/** Detailed rows, only for specs at least one of the compared vehicles has. */
/** Same assumptions for every car: 40 km a day in Punjab, paid in cash. */
function costRow(costs: CostConfig): Row {
  const cost = (c: PublicListing) =>
    monthlyCost(costs, {
      kind: c.vehicleType, price: c.price, engineCc: c.engineCc, fuel: c.fuel,
      fuelAverage: typeof c.specs.fuelAverageCity === "number" ? c.specs.fuelAverageCity : undefined,
      dailyKm: 40, province: "Punjab",
    }).total;
  return { label: "Monthly running cost*", value: (c) => formatPKR(cost(c)), best: (cs) => minBy(cs, cost) };
}

function detailSections(cars: PublicListing[]): { title: string; rows: Row[] }[] {
  const specSections = SPEC_GROUPS.map((g) => ({
    title: g.label,
    rows: SPEC_FIELDS.filter((f) => f.group === g.key && cars.some((c) => c.specs[f.key] !== undefined)).map<Row>((f) => ({
      label: f.label,
      value: (c) => specText(f, c.specs[f.key]) || "—",
      best:
        f.type === "number" && HIGHER_BETTER.has(f.key)
          ? (cs) => maxBy(cs, (c) => (typeof c.specs[f.key] === "number" ? (c.specs[f.key] as number) : undefined))
          : f.key === "ownership"
            ? (cs) => minBy(cs, (c) => OWNERSHIP_RANK[String(c.specs.ownership)])
            : undefined,
    })),
  }));
  const kind = cars[0].vehicleType;
  const featureRows: Row[] = groupFeatures([], kind).groups.map((g) => ({
    label: g.label,
    value: (c) => {
      const got = groupFeatures(c.features, c.vehicleType).groups.find((x) => x.key === g.key);
      const n = got ? got.items.filter((i) => i.has).length : 0;
      return `${n} of ${g.items.length}`;
    },
    best: (cs) => maxBy(cs, (c) => groupFeatures(c.features, c.vehicleType).groups.find((x) => x.key === g.key)?.items.filter((i) => i.has).length),
  }));
  const allFeatures = [...new Set(cars.flatMap((c) => c.features))];
  const matrix: Row[] = allFeatures.map((name) => ({
    label: name,
    value: (c) => (c.features.some((x) => x.toLowerCase() === name.toLowerCase()) ? "✓" : "✗"),
  }));
  return [
    ...specSections,
    { title: "Feature count", rows: featureRows },
    { title: "Feature by feature", rows: matrix },
  ].filter((s) => s.rows.length);
}

export default async function ComparePage({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw[0] : raw || "").split(",").filter(Boolean).slice(0, 3);
  const [cars, { costs }] = await Promise.all([marketplaceService.listingsByIds(ids), settingsService.finance()]);

  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Side by side</span>
      <h2>Compare</h2>
      {cars.length < 2 ? (
        <div className="site-card">
          <h3>Pick at least two vehicles</h3>
          <p>Tap ⇄ on up to three cars or bikes, then press <b>Compare now</b>. <Link href="/cars" className="site-link">Browse cars →</Link></p>
        </div>
      ) : (
        <div className="table-scroll mk-compare-wrap">
          <table className="mk-compare">
            <thead>
              <tr>
                <th />
                {cars.map((c) => (
                  <th key={c._id}>
                    <Link href={listingHref(c)} className="mk-compare-head">
                      <span className="mk-compare-photo" style={c.photos[0] ? { backgroundImage: `url("${c.photos[0]}")` } : undefined} />
                      <b>{c.title}</b>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[{ title: "Overview", rows: [...ROWS, costRow(costs)] }, ...detailSections(cars)].flatMap((sec) => [
                <tr key={`h-${sec.title}`} className="mk-compare-section">
                  <th colSpan={cars.length + 1}>{sec.title}</th>
                </tr>,
                ...sec.rows.map((r) => {
                  const best = r.best?.(cars);
                  const v = cars.map((c) => r.value(c));
                  return (
                    <tr key={`${sec.title}-${r.label}`}>
                      <th scope="row">{r.label}</th>
                      {cars.map((c, i) => (
                        <td key={c._id} className={best === c._id ? "best" : v[i] === "✓" ? "yes" : v[i] === "✗" ? "no" : undefined}>
                          {v[i]}
                          {best === c._id ? <span className="mk-best"> ✓ best</span> : null}
                        </td>
                      ))}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
          <p className="mk-muted small" style={{ padding: "8px 12px" }}>* Fuel, maintenance, token tax and insurance at 40 km a day in Punjab, paid in cash. Open a car to change these.</p>
        </div>
      )}
    </section>
  );
}
