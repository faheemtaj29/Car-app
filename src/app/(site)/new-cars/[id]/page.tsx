import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { newCarService } from "@/backend/services/newcar.service";
import { formatPKR } from "@/lib/dealership";
import { NewCarQuoteForm } from "@/components/marketplace/NewCarClient";
import { carImageUrl } from "@/lib/carImages";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const car = await newCarService.get(id).catch(() => null);
  if (!car) return { title: "Car not found" };
  return {
    title: `${car.year} ${car.make} ${car.model} — New Car Price & Variants`,
    description: `${car.year} ${car.make} ${car.model} price in Pakistan starts from ${formatPKR(car.minPrice)}. ${car.variants.length} variants available. Get a free quote.`,
  };
}

export default async function NewCarDetailPage({ params }: Params) {
  const { id } = await params;
  const car = await newCarService.get(id).catch(() => null);
  if (!car) notFound();

  return (
    <section className="site-section mk-wrap">
      <div className="mk-detail">
        {/* Gallery */}
        <div className="mk-main">
          <div className="nc-gallery">
            {(car.photos.length > 0 ? car.photos : [carImageUrl(car.make, car.bodyType, 1200, 85)]).map((p, i) => (
              <div key={i} className={i === 0 ? "nc-main-photo-wrap" : "nc-thumb-wrap"}>
                <Image
                  src={p}
                  alt={`${car.make} ${car.model}`}
                  fill
                  sizes={i === 0 ? "(max-width:900px) 100vw, 660px" : "120px"}
                  className={i === 0 ? "nc-main-photo" : "nc-thumb"}
                  loading={i === 0 ? "eager" : "lazy"}
                  priority={i === 0}
                  unoptimized={car.photos.length === 0}
                />
              </div>
            ))}
          </div>

          {/* Specs headline row */}
          <div className="nc-spec-row">
            {car.engineCc && <span>🔩 {car.engineCc} cc</span>}
            {car.fuel && <span>⛽ {car.fuel}</span>}
            {car.bodyType && <span>🚗 {car.bodyType}</span>}
            {car.color && car.color.length > 0 && <span>🎨 {car.color.slice(0, 4).join(", ")}</span>}
          </div>

          {/* Variants table */}
          <div className="site-card mk-block">
            <h3>Variants & Prices</h3>
            <div className="table-scroll">
              <table className="mk-compare">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Engine</th>
                    <th>Gearbox</th>
                    <th>Fuel</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {car.variants.map((v, i) => (
                    <tr key={i}>
                      <td><b>{v.name}</b></td>
                      <td>{v.engineCc ? `${v.engineCc} cc` : "—"}</td>
                      <td>{v.transmission || "—"}</td>
                      <td>{v.fuel || car.fuel || "—"}</td>
                      <td><b>{formatPKR(v.price)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mk-muted small" style={{ marginTop: 8 }}>Prices are ex-factory / suggested retail. City taxes and registration extra.</p>
          </div>

          {/* Features */}
          {car.features && car.features.length > 0 && (
            <div className="site-card mk-block">
              <h3>Features</h3>
              <ul className="nc-features">
                {car.features.map((f, i) => <li key={i}>✓ {f}</li>)}
              </ul>
            </div>
          )}

          {/* Specs table */}
          {car.specs && Object.keys(car.specs).length > 0 && (
            <div className="site-card mk-block">
              <h3>Specifications</h3>
              <table className="mk-spec-table">
                <tbody>
                  {Object.entries(car.specs).map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k.replace(/([A-Z])/g, " $1").trim()}</th>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {car.brochureUrl && (
            <div className="site-card mk-block">
              <a href={car.brochureUrl} target="_blank" rel="noopener noreferrer" className="site-btn">📄 Download Brochure</a>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="mk-side">
          <div className="site-card nc-side-card">
            <div className="nc-side-title">{car.year} {car.make} {car.model}</div>
            <div className="nc-side-price">
              {car.minPrice === car.maxPrice
                ? formatPKR(car.minPrice)
                : `${formatPKR(car.minPrice)} – ${formatPKR(car.maxPrice)}`}
            </div>
            <div className="mk-muted small">Ex-factory price · {car.variants.length} variant{car.variants.length !== 1 ? "s" : ""}</div>
            <NewCarQuoteForm carId={car._id} variants={car.variants.map((v) => v.name)} />
          </div>

          <div className="site-card mk-block">
            <h4>Compare with used</h4>
            <Link href={`/cars?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}`} className="site-btn outline" style={{ width: "100%" }}>
              View used {car.make} {car.model}
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
