import Link from "next/link";
import type { Metadata } from "next";
import { newCarService, type PublicNewCar } from "@/backend/services/newcar.service";
import { formatPKR } from "@/lib/dealership";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "New Cars in Pakistan — Prices & Variants",
  description: "Browse new car prices, variants and features in Pakistan. Get a free quote from authorised dealers.",
};

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

function NewCarCard({ car }: { car: PublicNewCar }) {
  return (
    <Link href={`/new-cars/${car._id}`} className="nc-card">
      <div className="nc-photo">
        {car.photos[0]
          ? <img src={car.photos[0]} alt={`${car.year} ${car.make} ${car.model}`} loading="lazy" />
          : <div className="nc-no-photo">📷</div>}
        <span className="nc-badge">New</span>
      </div>
      <div className="nc-info">
        <div className="nc-title">{car.year} {car.make} {car.model}</div>
        <div className="nc-sub">{car.bodyType || ""}{car.fuel ? ` · ${car.fuel}` : ""}</div>
        <div className="nc-price">
          {car.minPrice === car.maxPrice
            ? formatPKR(car.minPrice)
            : `${formatPKR(car.minPrice)} – ${formatPKR(car.maxPrice)}`}
        </div>
        <div className="nc-variants">{car.variants.length} variant{car.variants.length !== 1 ? "s" : ""}</div>
      </div>
    </Link>
  );
}

export default async function NewCarsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const make = typeof sp.make === "string" ? sp.make : undefined;
  const type = sp.type === "bike" ? "bike" : "car";
  const cars = await newCarService.list({ type, make }).catch(() => []);

  // Unique makes for filter
  const allMakes = [...new Set(cars.map((c) => c.make))].sort();

  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Brand new</span>
      <h2>New {type === "bike" ? "Bikes" : "Cars"} in Pakistan</h2>
      <p className="site-lead">Official prices, all variants and features. Request a free quote from your city's dealer.</p>

      <div className="nc-filter-row">
        <Link href="/new-cars" className={`nc-chip${!make ? " active" : ""}`}>All</Link>
        {allMakes.map((m) => (
          <Link key={m} href={`/new-cars?make=${encodeURIComponent(m)}`} className={`nc-chip${make === m ? " active" : ""}`}>{m}</Link>
        ))}
        <Link href="/new-cars?type=bike" className={`nc-chip${type === "bike" ? " active" : ""}`}>Bikes</Link>
      </div>

      {cars.length === 0 ? (
        <div className="site-card">
          <p className="mk-muted">No new cars listed yet. Check back soon.</p>
        </div>
      ) : (
        <div className="nc-grid">
          {cars.map((car) => <NewCarCard key={car._id} car={car} />)}
        </div>
      )}
    </section>
  );
}
