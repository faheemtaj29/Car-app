import Link from "next/link";
import { ReactNode } from "react";
import { settingsService } from "@/backend/services/settings.service";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { CartBadge } from "@/components/marketplace/ShopClient";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, flags] = await Promise.all([
    settingsService.get().catch(() => null),
    marketplaceService.navFlags().catch(() => ({ cars: true, bikes: true, shop: true, classifieds: true })),
  ]);
  const name = settings?.businessName || "Auto Marketplace";
  const tagline = settings?.tagline || "Cars, bikes, parts & accessories";
  const nav = [
    { href: "/cars", label: "Used Cars" },
    { href: "/bikes", label: "Bikes" },
    ...(flags.shop ? [{ href: "/shop", label: "Parts & Accessories" }] : []),
    { href: "/sell-car", label: "Sell to Us" },
  ];
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="site">
      <header className="site-nav">
        <Link href="/" className="site-brand">
          <span className="site-badge">{initials || "A"}</span>
          <span>
            {name}
            <small>{tagline}</small>
          </span>
        </Link>
        <nav className="site-links">
          {nav.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <div className="site-nav-actions">
          {flags.shop ? <CartBadge /> : null}
          <Link href="/account" className="site-btn ghost">My Account</Link>
          {flags.classifieds ? <Link href="/post-ad" className="site-btn">Post an Ad</Link> : null}
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-foot-grid">
          <div>
            <h4>{name}</h4>
            <p>{tagline}</p>
            {settings?.address ? <p>{settings.address}</p> : null}
          </div>
          <div>
            <h4>Showrooms</h4>
            {(settings?.branches || []).map((b) => (
              <p key={b.code}>{b.name}{b.address ? ` — ${b.address}` : ""}{b.phone ? ` · ${b.phone}` : ""}</p>
            ))}
          </div>
          <div>
            <h4>Contact</h4>
            {settings?.phone ? <p>📞 {settings.phone}</p> : null}
            {settings?.whatsapp ? <p><a href={`https://wa.me/92${settings.whatsapp.replace(/\D/g, "").replace(/^0/, "")}`} target="_blank" rel="noreferrer">WhatsApp {settings.whatsapp}</a></p> : null}
            {settings?.email ? <p>{settings.email}</p> : null}
            {settings?.facebook ? <p><a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a></p> : null}
            {settings?.instagram ? <p><a href={settings.instagram} target="_blank" rel="noreferrer">Instagram</a></p> : null}
            <p><Link href="/shop/track">Track a shop order</Link> · <Link href="/login">Staff login</Link></p>
          </div>
        </div>
        <div className="site-copy">© {new Date().getFullYear()} {name}</div>
      </footer>
    </div>
  );
}
