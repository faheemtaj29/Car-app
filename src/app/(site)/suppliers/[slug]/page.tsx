import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { partnerService } from "@/backend/services/partner.service";
import { supplierService } from "@/backend/services/supplier.service";
import { BusinessHeader } from "@/components/marketplace/Directory";
import { PartCard } from "@/components/marketplace/PartCard";
import { VehiclePicker } from "@/components/marketplace/PartsUi";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const b = await partnerService.bySlug((await params).slug);
  return b ? { title: `${b.name} — parts & accessories in ${b.city}` } : { title: "Supplier not found" };
}

export default async function SupplierPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const b = await partnerService.bySlug(slug);
  if (!b || b.type !== "supplier") notFound();
  const raw = await searchParams;
  const get = (k: string) => { const v = raw[k]; return (Array.isArray(v) ? v[0] : v) || undefined; };
  const kind: "car" | "bike" | undefined = get("kind") === "bike" ? "bike" : get("kind") === "car" ? "car" : undefined;
  const pick = { kind, make: get("make"), model: get("model"), year: Number(get("year")) || undefined, universal: get("universal") === "1" };
  const data = await supplierService.search({ ...pick, supplierId: b.id });
  return (
    <section className="site-section mk-wrap">
      <BusinessHeader b={b} kind="supplier" />
      <VehiclePicker action={`/suppliers/${slug}`} kind={kind || "car"} make={pick.make} model={pick.model} year={pick.year} universal={pick.universal} keep={{}} />
      <div className="home-block-head"><h3>{data.total} products{pick.make ? ` for ${[pick.make, pick.model, pick.year].filter(Boolean).join(" ")}` : ""}</h3></div>
      {data.parts.length ? <div className="mk-grid">{data.parts.map((p) => <PartCard key={p._id} p={p} />)}</div> : <p className="mk-muted">Nothing matches.</p>}
    </section>
  );
}
