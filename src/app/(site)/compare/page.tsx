import Link from "next/link";
import type { Metadata } from "next";
import { marketplaceService, type PublicListing } from "@/backend/services/marketplace.service";
import { listingHref } from "@/components/marketplace/Listing";
import { formatPKR, inspectionGrade, PRICE_RATING_LABEL } from "@/lib/dealership";

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
  { label: "Features", value: (c) => (c.features.length ? c.features.join(", ") : "—") },
];

export default async function ComparePage({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw[0] : raw || "").split(",").filter(Boolean).slice(0, 3);
  const cars = await marketplaceService.listingsByIds(ids);

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
              {ROWS.map((r) => {
                const best = r.best?.(cars);
                return (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {cars.map((c) => (
                      <td key={c._id} className={best === c._id ? "best" : undefined}>
                        {r.value(c)}
                        {best === c._id ? <span className="mk-best"> ✓ best</span> : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
