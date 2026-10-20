import Link from "next/link";
import { CarIcon, GlobeIcon, ShopIcon, TagIcon, KeyIcon, ChartIcon } from "@/components/Icons";
import { ListingCard } from "@/components/marketplace/Listing";
import { ProductCard } from "@/components/marketplace/ShopCards";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { shopService } from "@/backend/services/shop.service";
import { settingsService } from "@/backend/services/settings.service";
import { SHOP_CATEGORIES } from "@/lib/shop";
import { CITIES, MAJOR_CITIES } from "@/lib/catalog";
import { getT } from "@/lib/i18n.server";
import { RecentlyViewed } from "@/components/marketplace/Extras";

export const dynamic = "force-dynamic";

const QUICK_CARS = ["Toyota", "Honda", "Suzuki", "KIA", "Hyundai", "Changan"];
const QUICK_BIKES = ["Honda", "Yamaha", "Suzuki", "United", "Road Prince"];

export default async function HomePage() {
  const [settings, cars, bikes, shop, facets, { t }] = await Promise.all([
    settingsService.get().catch(() => null),
    marketplaceService.search({ type: "car", sort: "newest" }).catch(() => ({ listings: [], total: 0 })),
    marketplaceService.search({ type: "bike", sort: "newest" }).catch(() => ({ listings: [], total: 0 })),
    shopService.catalogue({ sort: "featured" }).catch(() => ({ products: [], total: 0, categories: [] as { value: string; count: number }[] })),
    marketplaceService.facets({ type: "car" }).catch(() => ({ makes: [] as { value: string; count: number }[], cities: [] as { value: string; count: number }[] })),
    getT(),
  ]);
  const deals = [...cars.listings, ...bikes.listings].filter((l) => l.insight?.rating === "great" || l.priceDrop).slice(0, 4);
  const costs = settings?.costs;
  const name = settings?.businessName || "Auto Marketplace";

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-inner">
          <span className="site-kicker">{name}</span>
          <h1>{t("home.title")}</h1>
          <p>{t("home.lead")}</p>
          <form className="mk-ask home-ask" action="/search" method="get">
            <span aria-hidden>✨</span>
            <input name="ask" maxLength={200} aria-label="Describe the car or bike you want" placeholder={t("home.askPlaceholder")} />
            <button type="submit" className="site-btn">{t("home.find")}</button>
          </form>
          <div className="home-ask-examples">
            {t("home.try")} {["SUV under 80 lakh first owner", "sasti automatic gari 25 lakh tak Lahore", "CG 125 2022 Karachi", "30 لاکھ تک آٹومیٹک گاڑی"].map((x) => (
              <Link key={x} href={`/search?ask=${encodeURIComponent(x)}`}>{x}</Link>
            ))}
          </div>
          <form className="home-search" action="/cars" method="get">
            <input name="q" placeholder="Make or model, e.g. Corolla, Civic, CG 125" aria-label="Search" />
            <select name="city" aria-label="City" defaultValue="">
              <option value="">All cities</option>
              {[...new Set([...facets.cities.map((c) => c.value), ...MAJOR_CITIES, ...CITIES])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select name="maxPrice" aria-label="Budget" defaultValue="">
              <option value="">Any budget</option>
              {[1_500_000, 2_500_000, 3_500_000, 5_000_000, 7_500_000, 10_000_000].map((p) => (
                <option key={p} value={p}>Up to {p / 100_000} lacs</option>
              ))}
            </select>
            <button type="submit" className="site-btn">{t("home.searchCars")}</button>
          </form>
          <div className="home-quick">
            <span>{t("home.popular")}</span>
            {QUICK_CARS.map((m) => <Link key={m} href={`/cars?make=${encodeURIComponent(m)}`}>{m}</Link>)}
            <span style={{ marginLeft: 8 }}>{t("home.bikes")}</span>
            {QUICK_BIKES.map((m) => <Link key={`b-${m}`} href={`/bikes?make=${encodeURIComponent(m)}`}>{m}</Link>)}
          </div>
        </div>
      </section>

      <section className="site-section mk-wrap home-tiles">
        <Link href="/cars" className="home-tile"><CarIcon className="ico ico-xl home-tile-ico" /><b>{t("home.tileCars")}</b><small>{cars.total} {t("home.forSale")}</small></Link>
        <Link href="/bikes" className="home-tile"><ChartIcon className="ico ico-xl home-tile-ico" /><b>{t("home.tileBikes")}</b><small>{bikes.total} {t("home.forSale")}</small></Link>
        <Link href="/new-cars" className="home-tile"><GlobeIcon className="ico ico-xl home-tile-ico" /><b>New Cars</b><small>Prices &amp; variants</small></Link>
        <Link href="/shop" className="home-tile"><ShopIcon className="ico ico-xl home-tile-ico" /><b>{t("home.tileShop")}</b><small>{shop.total} {t("home.products")}</small></Link>
        <Link href="/post-ad" className="home-tile"><TagIcon className="ico ico-xl home-tile-ico" /><b>{t("home.tileSelf")}</b><small>{t("home.postFree")}</small></Link>
        <Link href="/sell-car" className="home-tile"><KeyIcon className="ico ico-xl home-tile-ico" /><b>{t("home.tileUs")}</b><small>{t("home.instantOffer")}</small></Link>
      </section>

      <section className="site-section mk-wrap">
        <div className="home-why home-why-new">
          <h2>{t("home.why")}</h2>
          <ul>
            <li><span>🔍</span>{t("home.why1")}</li>
            <li><span>🧮</span>{t("home.why2")}</li>
            <li><span>🏦</span><Link href="/car-finance">{t("home.why3")}</Link></li>
            <li><span>📅</span>{t("home.why4")}</li>
            <li><span>🔧</span><Link href="/garage">{t("home.why5")}</Link></li>
            <li><span>🔒</span>{t("home.why6")}</li>
          </ul>
          {costs ? (
            <div className="fuel-board">
              <b>⛽ {t("home.fuelBoard")}</b>
              <span>Petrol <b>Rs {costs.petrolPerLitre}</b>/L</span>
              <span>Diesel <b>Rs {costs.dieselPerLitre}</b>/L</span>
              <span>CNG <b>Rs {costs.cngPerKg}</b>/kg</span>
            </div>
          ) : null}
        </div>
      </section>

      {deals.length ? (
        <section className="site-section mk-wrap home-block">
          <div className="home-block-head"><h2>🔥 {t("home.deals")}</h2><span className="mk-muted">{t("home.dealsLead")}</span></div>
          <div className="mk-grid">{deals.map((c) => <ListingCard key={c._id} car={c} />)}</div>
        </section>
      ) : null}

      <RecentlyViewed title={t("home.recent")} />

      {cars.listings.length ? (
        <section className="site-section mk-wrap home-block">
          <div className="home-block-head"><h2>{t("home.latestCars")}</h2><Link href="/cars" className="site-link">{t("home.seeAllCars")}</Link></div>
          <div className="mk-grid">{cars.listings.slice(0, 8).map((c) => <ListingCard key={c._id} car={c} />)}</div>
        </section>
      ) : null}

      {bikes.listings.length ? (
        <section className="site-section mk-wrap home-block">
          <div className="home-block-head"><h2>{t("home.latestBikes")}</h2><Link href="/bikes" className="site-link">{t("home.seeAllBikes")}</Link></div>
          <div className="mk-grid">{bikes.listings.slice(0, 4).map((c) => <ListingCard key={c._id} car={c} />)}</div>
        </section>
      ) : null}

      {shop.products.length ? (
        <section className="site-section mk-wrap home-block">
          <div className="home-block-head"><h2>Parts & accessories</h2><Link href="/shop" className="site-link">Visit the shop →</Link></div>
          <div className="mk-cats">
            {SHOP_CATEGORIES.filter((c) => shop.categories.some((x) => x.value === c)).map((c) => (
              <Link key={c} href={`/shop?category=${encodeURIComponent(c)}`}>{c}</Link>
            ))}
          </div>
          <div className="mk-grid">{shop.products.slice(0, 4).map((p) => <ProductCard key={p._id} p={p} />)}</div>
        </section>
      ) : null}

      <section className="site-section mk-wrap">
        <div className="home-why">
          <div><b>✓ Inspected dealer stock</b><p>Every dealer car carries an 8-point inspection score.</p></div>
          <div><b>₨ Fair-price ratings</b><p>Each listing is compared with similar cars on the market.</p></div>
          <div><b>🏦 Bank lease comparison</b><p>Every bank&apos;s instalment side by side, with eligibility.</p></div>
          <div><b>🚚 Cash on delivery</b><p>Oils, parts and gear delivered nationwide.</p></div>
        </div>
      </section>
    </>
  );
}
