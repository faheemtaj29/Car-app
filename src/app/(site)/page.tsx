import Link from "next/link";
import { ListingCard } from "@/components/marketplace/Listing";
import { ProductCard } from "@/components/marketplace/ShopCards";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { shopService } from "@/backend/services/shop.service";
import { settingsService } from "@/backend/services/settings.service";
import { SHOP_CATEGORIES } from "@/lib/shop";

export const dynamic = "force-dynamic";

const QUICK_CARS = ["Toyota", "Honda", "Suzuki", "KIA", "Hyundai", "Changan"];
const QUICK_BIKES = ["Honda", "Yamaha", "Suzuki", "United", "Road Prince"];

export default async function HomePage() {
  const [settings, cars, bikes, shop, facets] = await Promise.all([
    settingsService.get().catch(() => null),
    marketplaceService.search({ type: "car", sort: "newest" }).catch(() => ({ listings: [], total: 0 })),
    marketplaceService.search({ type: "bike", sort: "newest" }).catch(() => ({ listings: [], total: 0 })),
    shopService.catalogue({ sort: "featured" }).catch(() => ({ products: [], total: 0, categories: [] as { value: string; count: number }[] })),
    marketplaceService.facets({ type: "car" }).catch(() => ({ makes: [] as { value: string; count: number }[], cities: [] as { value: string; count: number }[] })),
  ]);
  const name = settings?.businessName || "Auto Marketplace";

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-inner">
          <span className="site-kicker">{name}</span>
          <h1>Find your next car or bike</h1>
          <p>Inspected dealer stock with fair-price ratings, private sellers, and genuine parts delivered to your door.</p>
          <form className="home-search" action="/cars" method="get">
            <input name="q" placeholder="Make or model, e.g. Corolla, Civic, CG 125" aria-label="Search" />
            <select name="city" aria-label="City" defaultValue="">
              <option value="">All cities</option>
              {facets.cities.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
            <select name="maxPrice" aria-label="Budget" defaultValue="">
              <option value="">Any budget</option>
              {[1_500_000, 2_500_000, 3_500_000, 5_000_000, 7_500_000, 10_000_000].map((p) => (
                <option key={p} value={p}>Up to {p / 100_000} lacs</option>
              ))}
            </select>
            <button type="submit" className="site-btn">Search cars</button>
          </form>
          <div className="home-quick">
            <span>Popular:</span>
            {QUICK_CARS.map((m) => <Link key={m} href={`/cars?make=${encodeURIComponent(m)}`}>{m}</Link>)}
            <span style={{ marginLeft: 8 }}>Bikes:</span>
            {QUICK_BIKES.map((m) => <Link key={`b-${m}`} href={`/bikes?make=${encodeURIComponent(m)}`}>{m}</Link>)}
          </div>
        </div>
      </section>

      <section className="site-section mk-wrap home-tiles">
        <Link href="/cars" className="home-tile"><span>🚗</span><b>Used cars</b><small>{cars.total} for sale</small></Link>
        <Link href="/bikes" className="home-tile"><span>🏍️</span><b>Motorbikes</b><small>{bikes.total} for sale</small></Link>
        <Link href="/shop" className="home-tile"><span>🛢️</span><b>Parts & accessories</b><small>{shop.total} products</small></Link>
        <Link href="/post-ad" className="home-tile"><span>📸</span><b>Sell it yourself</b><small>Post a free ad</small></Link>
        <Link href="/sell-car" className="home-tile"><span>🤝</span><b>Sell to us</b><small>Free inspection & offer</small></Link>
      </section>

      {cars.listings.length ? (
        <section className="site-section mk-wrap home-block">
          <div className="home-block-head"><h2>Latest cars</h2><Link href="/cars" className="site-link">See all cars →</Link></div>
          <div className="mk-grid">{cars.listings.slice(0, 8).map((c) => <ListingCard key={c._id} car={c} />)}</div>
        </section>
      ) : null}

      {bikes.listings.length ? (
        <section className="site-section mk-wrap home-block">
          <div className="home-block-head"><h2>Latest bikes</h2><Link href="/bikes" className="site-link">See all bikes →</Link></div>
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
          <div><b>🏦 Finance calculator</b><p>See the monthly instalment before you call.</p></div>
          <div><b>🚚 Cash on delivery</b><p>Oils, parts and gear delivered nationwide.</p></div>
        </div>
      </section>
    </>
  );
}
