import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supplierService } from "@/backend/services/supplier.service";
import { ServiceError } from "@/backend/types";
import { Gallery } from "@/components/marketplace/Interactive";
import { PartEnquiry } from "@/components/marketplace/PartEnquiry";
import { formatPKR } from "@/lib/dealership";
import { fitmentLabel } from "@/lib/fitment";
import { whatsappLink } from "@/lib/shop";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

async function load(id: string, count: boolean) {
  try {
    return await supplierService.one(id, count);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load((await params).id, false);
  return p ? { title: `${p.title} — ${formatPKR(p.price)}`, description: `${p.category}${p.universal ? "" : ` for ${p.fitments.map(fitmentLabel).join(", ")}`}. Sold by ${p.supplier?.name}, ${p.city || ""}.` } : { title: "Part not found" };
}

export default async function PartPage({ params }: { params: Params }) {
  const p = await load((await params).id, true);
  if (!p || !p.supplier) notFound();
  const s = p.supplier;
  const wa = whatsappLink(s.whatsapp || s.phone, `Hi, is "${p.title}" (${formatPKR(p.price)}) available?`);
  return (
    <section className="site-section mk-wrap">
      <nav className="mk-crumbs"><Link href="/shop">Parts</Link> › <Link href={`/shop?q=${encodeURIComponent(p.category)}`}>{p.category}</Link></nav>
      <div className="mk-detail">
        <div>
          <Gallery photos={p.images} title={p.title} />
          <div className="site-card mk-block">
            <h3>Fits these vehicles</h3>
            {p.universal ? <p>Universal — fits any {p.kind === "bike" ? "bike" : p.kind === "both" ? "car or bike" : "car"}.</p> : (
              <ul className="fit-list">{p.fitments.map((f, i) => <li key={i}>✓ {fitmentLabel(f)}</li>)}</ul>
            )}
            <p className="mk-muted small">Always confirm the part number with the supplier before buying.</p>
          </div>
          {p.description ? <div className="site-card mk-block"><h3>Details</h3><p style={{ whiteSpace: "pre-line" }}>{p.description}</p></div> : null}
        </div>
        <aside className="mk-side">
          <div className="site-card">
            <h1 className="mk-title">{p.title}</h1>
            <div className="mk-muted">{p.brand ? `${p.brand} · ` : ""}{p.category} · {p.condition}{p.partNumber ? ` · Part # ${p.partNumber}` : ""}</div>
            <div className="mk-price">{formatPKR(p.price)}</div>
            {p.compareAtPrice ? <div className="mk-was">{formatPKR(p.compareAtPrice)}</div> : null}
            <p>{p.inStock ? "✓ In stock" : "Out of stock"}{p.delivery ? " · Delivers to other cities" : ` · Pickup in ${p.city}`}</p>
          </div>
          <div className="site-card">
            <h3>Sold by</h3>
            <p><Link href={`/suppliers/${s.slug}`} className="site-link"><b>{s.name}</b></Link>{s.verified ? <span className="tr-badges"> <span>✓ Verified supplier</span></span> : null}</p>
            <p className="mk-muted">{s.address}, {s.city}</p>
            <a className="site-btn" href={`tel:${s.phone}`}>📞 Call {s.phone}</a>
            {wa ? <a className="mk-wa" href={wa} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a> : null}
            <PartEnquiry id={p._id} />
            <div className="mk-safety"><b>Buying safely:</b> check the part in person or pay on delivery. Never send money to an account that is not the supplier&apos;s business account.</div>
          </div>
        </aside>
      </div>
    </section>
  );
}
