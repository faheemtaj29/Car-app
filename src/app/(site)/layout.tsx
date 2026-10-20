import Link from "next/link";
import { CatalogLists } from "@/components/CatalogLists";
import { ReactNode } from "react";
import { settingsService } from "@/backend/services/settings.service";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { CartBadge } from "@/components/marketplace/ShopClient";
import { CompareTray } from "@/components/marketplace/SavedClient";
import { HeaderBadges } from "@/components/marketplace/Alerts";
import { LangSwitch } from "@/components/marketplace/LangSwitch";
import { getMyCity, getT } from "@/lib/i18n.server";
import { AppInstall } from "@/components/marketplace/AppInstall";
import { CityPicker } from "@/components/marketplace/CityPicker";
import { MobileNav } from "@/components/marketplace/MobileNav";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, flags, { lang, t }, myCity] = await Promise.all([
    settingsService.get().catch(() => null),
    marketplaceService.navFlags().catch(() => ({ cars: true, bikes: true, shop: true, classifieds: true })),
    getT(),
    getMyCity(),
  ]);
  const name = settings?.businessName || "Auto Marketplace";
  const tagline = settings?.tagline || "Cars, bikes, parts & accessories";
  const nav = [
    { href: "/cars", label: t("nav.cars") },
    { href: "/bikes", label: t("nav.bikes") },
    { href: "/new-cars", label: "New Cars" },
    ...(flags.shop ? [{ href: "/shop", label: t("nav.shop") }] : []),
    { href: "/sell-car", label: t("nav.sell") },
    { href: "/car-finance", label: t("nav.finance") },
  ];
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className={`site${lang === "ur" ? " ur" : ""}`} dir={lang === "ur" ? "rtl" : "ltr"} lang={lang}>
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
          <CityPicker city={myCity} />
          <LangSwitch lang={lang} label={t("lang.switch")} />
          <HeaderBadges garageLabel={t("nav.garage")} />
          <Link href="/saved" className="mk-saved-link mob-hide" aria-label="Saved vehicles">{t("nav.saved")}</Link>
          {flags.shop ? <CartBadge /> : null}
          <Link href="/account" className="site-btn ghost mob-hide">{t("nav.account")}</Link>
          {flags.classifieds ? <Link href="/post-ad" className="site-btn mob-hide">{t("nav.postAd")}</Link> : null}
        </div>
        <MobileNav nav={nav} name={name} />
      </header>

      <main>{children}</main>
      <CatalogLists />
      <CompareTray />

      <footer className="site-footer">
        <div className="site-foot-grid">
          <div>
            <h4>{name}</h4>
            <p>{tagline}</p>
            {settings?.address ? <p>{settings.address}</p> : null}
          </div>
          <div>
            <h4>{t("foot.showrooms")}</h4>
            {(settings?.branches || []).map((b) => (
              <p key={b.code}>{b.name}{b.address ? ` — ${b.address}` : ""}{b.phone ? ` · ${b.phone}` : ""}</p>
            ))}
          </div>
          <div>
            <h4>{t("foot.contact")}</h4>
            {settings?.phone ? <p><span className="foot-label">Phone:</span> {settings.phone}</p> : null}
            {settings?.whatsapp ? <p><a href={`https://wa.me/92${settings.whatsapp.replace(/\D/g, "").replace(/^0/, "")}`} target="_blank" rel="noreferrer">WhatsApp {settings.whatsapp}</a></p> : null}
            {settings?.email ? <p>{settings.email}</p> : null}
            {settings?.facebook ? <p><a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a></p> : null}
            {settings?.instagram ? <p><a href={settings.instagram} target="_blank" rel="noreferrer">Instagram</a></p> : null}
            <p><Link href="/shop/track">{t("foot.track")}</Link> · <Link href="/login">{t("foot.staff")}</Link></p>
          </div>
          <div>
            <h4>{t("foot.tools")}</h4>
            <p><Link href="/garage">My Garage</Link></p>
            <p><Link href="/car-finance">{t("nav.finance")}</Link></p>
            <p><Link href="/alerts">Alerts</Link> · <Link href="/compare">Compare</Link></p>
            <p><Link href="/dealers">Dealers</Link> · <Link href="/suppliers">Parts suppliers</Link></p>
            <p><Link href="/register">Register to sell (individual, dealer, supplier)</Link></p>
          </div>
        </div>
        <div className="site-copy">© {new Date().getFullYear()} {name}</div>
      </footer>
      <AppInstall />
    </div>
  );
}
