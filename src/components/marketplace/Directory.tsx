import Link from "next/link";
import type { PublicBusiness } from "@/backend/services/partner.service";
import { CITIES } from "@/lib/catalog";

/** List of registered dealerships or parts suppliers, filterable by city. */
export function Directory({ type, list, city }: { type: "dealer" | "supplier"; list: PublicBusiness[]; city?: string }) {
  const base = type === "dealer" ? "/dealers" : "/suppliers";
  return (
    <>
      <form className="mk-ask" method="get" action={base}>
        <span aria-hidden>📍</span>
        <select name="city" defaultValue={city || ""} aria-label="City" style={{ flex: 1, border: 0, font: "inherit", background: "transparent" }}>
          <option value="">All cities</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="site-btn">Show</button>
      </form>
      {list.length ? (
        <div className="dir-grid">
          {list.map((b) => (
            <Link key={b.slug} href={`${base}/${b.slug}`} className="site-card dir-card">
              <span className="dir-badge">{b.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
              <div>
                <b>{b.name}</b>{b.verified ? <span className="tr-badges"> <span>✓ Verified</span></span> : null}
                <p>{b.city} · {b.address}</p>
                {b.categories.length ? <small>{b.categories.slice(0, 4).join(" · ")}</small> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="site-card"><h3>None {city ? `in ${city} ` : ""}yet</h3><p>Are you one? <Link href={`/register?type=${type}`} className="site-link">Register your business →</Link></p></div>
      )}
    </>
  );
}

export function BusinessHeader({ b, kind }: { b: PublicBusiness; kind: "dealer" | "supplier" }) {
  const wa = (b.whatsapp || b.phone).replace(/\D/g, "").replace(/^0/, "92");
  return (
    <div className="site-card biz-head">
      <span className="dir-badge big">{b.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
      <div>
        <span className="site-kicker">{kind === "dealer" ? "Registered dealership" : "Registered parts supplier"}</span>
        <h2>{b.name}</h2>
        <p>{b.address}, {b.city}</p>
        <div className="tr-badges">
          {b.verified ? <span>✓ Owner ID verified</span> : null}
          <span>On the site since {new Date(b.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
        </div>
        {b.about ? <p style={{ whiteSpace: "pre-line" }}>{b.about}</p> : null}
        <div className="biz-actions">
          <a className="site-btn" href={`tel:${b.phone}`}>📞 {b.phone}</a>
          <a className="mk-wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
