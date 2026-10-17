import Link from "next/link";
import type { PublicPart } from "@/backend/services/supplier.service";
import { formatPKR } from "@/lib/dealership";
import { fitmentLabel } from "@/lib/fitment";

/** A supplier's product in search results. */
export function PartCard({ p }: { p: PublicPart }) {
  const fit = p.universal ? "Universal" : p.fitments.slice(0, 2).map(fitmentLabel).join(" · ") + (p.fitments.length > 2 ? ` +${p.fitments.length - 2}` : "");
  return (
    <Link href={`/parts/${p._id}`} className="mk-card mk-product">
      <div className="mk-card-photo" style={p.images[0] ? { backgroundImage: `url("${p.images[0]}")` } : undefined}>
        {!p.images[0] ? <span>{p.category}</span> : null}
        {!p.inStock ? <span className="mk-reserved">Out of stock</span> : null}
        {p.condition !== "new" ? <span className="mk-ribbon">{p.condition}</span> : null}
      </div>
      <div className="mk-card-body">
        <div className="mk-muted">{p.brand ? `${p.brand} · ` : ""}{p.category}</div>
        <div className="mk-card-title">{p.title}</div>
        <div className="mk-card-price">{formatPKR(p.price)}{p.compareAtPrice ? <span className="mk-was"> {formatPKR(p.compareAtPrice)}</span> : null}</div>
        <div className="mk-muted small">Fits: {fit}</div>
        <div className="mk-card-foot">
          <span>{p.supplier?.name}{p.city ? ` · ${p.city}` : ""}</span>
          <span className="mk-badges">{p.supplier?.verified ? <span className="mk-seller-badge dealer">✓ Verified</span> : null}{p.delivery ? <span className="mk-seller-badge private">Delivers</span> : null}</span>
        </div>
      </div>
    </Link>
  );
}
