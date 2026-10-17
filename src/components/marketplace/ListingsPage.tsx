import { analyticsService } from "@/backend/services/analytics.service";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingCard } from "@/components/marketplace/Listing";
import { SaveSearchButton } from "@/components/marketplace/Alerts";
import { getMyCity, getT } from "@/lib/i18n.server";
import { marketplaceService, parseListingFilters } from "@/backend/services/marketplace.service";
import { formatPKRShort } from "@/lib/dealership";
import { CITIES, makesFor } from "@/lib/catalog";
import { modelListId } from "@/components/CatalogLists";
import { BODY_TYPES } from "@/lib/shop";

export type Search = Promise<{ [key: string]: string | string[] | undefined }>;

const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric", "CNG"];
const SORTS = [
  ["newest", "Newest first"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["year_desc", "Model year: newest"],
  ["km_asc", "Mileage: lowest"],
] as const;
const CAR_MUST_HAVE = ["Push start", "Sunroof", "Navigation", "Climate control", "Rear camera", "Cruise control", "Alloy rims", "ABS", "Apple CarPlay", "LED headlights"];
const BIKE_MUST_HAVE = ["Self start", "Front disc brake", "Alloy wheels", "Tubeless tyres", "Digital meter", "ABS"];
const PRICE_STEPS = {
  car: [1_500_000, 2_500_000, 3_500_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 25_000_000],
  bike: [50_000, 100_000, 150_000, 250_000, 400_000, 700_000, 1_000_000, 2_000_000],
};

/** Shared search page for /cars and /bikes: dealer stock + approved private ads. */
export async function ListingsPage({ type, searchParams }: { type: "car" | "bike"; searchParams: Search }) {
  const raw = await searchParams;
  // Checkbox groups (feat) arrive as repeated params; the rest are single values.
  const get = (k: string) => {
    const v = raw[k];
    return Array.isArray(v) ? (k === "feat" ? v.join(",") : v[0]) : v;
  };
  const parsed = parseListingFilters(get);
  // "bike under 2 lakh" typed on /cars belongs on /bikes.
  if (parsed.ask && parsed.type && parsed.type !== type) {
    redirect(`/${parsed.type === "bike" ? "bikes" : "cars"}?ask=${encodeURIComponent(parsed.ask)}`);
  }
  // City-first: a buyer who picked "Islamabad" sees Islamabad cars unless
  // they choose another city or "All Pakistan" (city=all).
  const myCity = await getMyCity();
  const cityParam = get("city");
  const allPakistan = cityParam === "all";
  const cityDefaulted = !allPakistan && !parsed.city && Boolean(myCity);
  const filters = { ...parsed, type, city: allPakistan ? undefined : parsed.city || myCity };
  const base = type === "bike" ? "/bikes" : "/cars";
  const noun = type === "bike" ? "bike" : "car";
  const [firstPage, facets, flags, { t }, counts] = await Promise.all([
    marketplaceService.search(filters),
    marketplaceService.facets(filters),
    marketplaceService.navFlags(),
    getT(),
    marketplaceService.cityCounts(filters),
  ]);
  let { listings, total, page, pages } = firstPage;
  // Nothing in the buyer's own city: show all of Pakistan rather than an empty page.
  let fellBack = false;
  if (cityDefaulted && total === 0 && counts.allCities > 0) {
    ({ listings, total, page, pages } = await marketplaceService.search({ ...filters, city: undefined }));
    fellBack = true;
  }
  if ((filters.make || filters.model) && !parsed.page) analyticsService.log({ kind: type, make: filters.make, model: filters.model, city: filters.city, results: fellBack ? 0 : total });
  /** Same search, different city / registration city. */
  const withParam = (patch: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(raw).forEach(([k, v]) => {
      if (k === "page" || k in patch) return;
      (Array.isArray(v) ? v : [v]).forEach((val) => val && qs.append(k, val));
    });
    Object.entries(patch).forEach(([k, v]) => v && qs.set(k, v));
    return `${base}?${qs.toString()}`;
  };
  const otherCities = counts.cities.filter((c) => c.city.toLowerCase() !== (filters.city || "").toLowerCase());
  const years = Array.from({ length: facets.maxYear - facets.minYear + 1 }, (_, i) => facets.maxYear - i);

  const searchQs = new URLSearchParams();
  Object.entries(raw).forEach(([k, v]) => {
    if (k !== "page") (Array.isArray(v) ? v : [v]).forEach((val) => val && searchQs.append(k, val));
  });
  const savedQuery = `${base}${searchQs.toString() ? `?${searchQs}` : ""}`;
  const savedLabel =
    filters.understood?.length ? filters.understood.join(" · ")
      : [filters.make, filters.model, filters.city, filters.maxPrice ? `under ${formatPKRShort(filters.maxPrice)}` : "", filters.minYear ? `${filters.minYear}+` : ""].filter(Boolean).join(" · ") || `All ${noun}s`;

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    Object.entries(raw).forEach(([k, v]) => {
      if (k === "page") return;
      (Array.isArray(v) ? v : [v]).forEach((val) => val && qs.append(k, val));
    });
    qs.set("page", String(p));
    return `${base}?${qs.toString()}`;
  };

  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Marketplace</span>
      <h2>{type === "bike" ? t("list.bikes") : t("list.cars")}</h2>
      <p className="site-lead">
        {t("list.lead")}{" "}
        {flags.classifieds ? <Link href={`/post-ad?type=${type}`} className="site-link">Post your {noun} ad free →</Link> : null}
      </p>
      <form className="mk-ask" method="get" action={base}>
        <span aria-hidden>✨</span>
        <input
          name="ask"
          defaultValue={filters.ask}
          maxLength={200}
          aria-label="Describe what you are looking for"
          placeholder={type === "bike" ? "e.g. self start bike under 2 lakh in Lahore" : "e.g. family car under 30 lakh, automatic, good mileage"}
        />
        <button type="submit" className="site-btn">{t("home.find")}</button>
      </form>
      {filters.ask ? (
        <div className="mk-understood">
          <span>{t("list.searched")}</span>
          {filters.understood?.length ? filters.understood.map((u) => <b key={u}>{u}</b>) : <em>keywords only</em>}
          <Link href={base} className="site-link">{t("list.clear")}</Link>
        </div>
      ) : null}
      <div className="mk-type-tabs">
        <Link href="/cars" className={type === "car" ? "active" : ""}>🚗 Cars</Link>
        <Link href="/bikes" className={type === "bike" ? "active" : ""}>🏍️ Bikes</Link>
        <Link href="/shop">🛒 Accessories & parts</Link>
      </div>

      <div className="mk-layout">
        <form className="mk-filters" id="filters" method="get" action={base}>
          {filters.ask ? <input type="hidden" name="ask" value={filters.ask} /> : null}
          <label>Seller
            <select name="seller" defaultValue={filters.seller || ""}>
              <option value="">Dealers & private sellers</option>
              <option value="dealer">Dealer only (inspected stock)</option>
              <option value="private">Private sellers only</option>
            </select>
          </label>
          <input name="q" defaultValue={filters.q} placeholder="Search make, model, colour…" />
          <label>Make
            <select name="make" defaultValue={filters.make || ""}>
              <option value="">Any make</option>
              {makesFor(type, facets.makes.map((m) => m.value)).map((m) => {
                const n = facets.makes.find((x) => x.value.toLowerCase() === m.toLowerCase())?.count;
                return <option key={m} value={m}>{m}{n ? ` (${n})` : ""}</option>;
              })}
            </select>
          </label>
          <label>Model<input name="model" defaultValue={filters.model} placeholder={filters.make ? `Any ${filters.make} model` : "Any model"} list={filters.make ? modelListId(type, filters.make) : undefined} autoComplete="off" /></label>
          <label>City
            <select name="city" defaultValue={filters.city || "all"}>
              <option value="all">All Pakistan</option>
              {(() => {
                const counted = new Map(facets.cities.map((c) => [c.value.toLowerCase(), c]));
                const withCars = facets.cities.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>);
                const others = CITIES.filter((c) => !counted.has(c.toLowerCase())).map((c) => <option key={c} value={c}>{c}</option>);
                return (
                  <>
                    {withCars.length ? <optgroup label="Cities with listings">{withCars}</optgroup> : null}
                    <optgroup label="All cities">{others}</optgroup>
                  </>
                );
              })()}
            </select>
          </label>
          <label>Registered in (number plate city)
            <select name="regCity" defaultValue={filters.regCity || ""}>
              <option value="">Any</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="mk-pair">
            <label>Price from
              <select name="minPrice" defaultValue={filters.minPrice ? String(filters.minPrice) : ""}>
                <option value="">Min</option>
                {PRICE_STEPS[type].map((p) => <option key={p} value={p}>{formatPKRShort(p)}</option>)}
              </select>
            </label>
            <label>to
              <select name="maxPrice" defaultValue={filters.maxPrice ? String(filters.maxPrice) : ""}>
                <option value="">Max</option>
                {PRICE_STEPS[type].map((p) => <option key={p} value={p}>{formatPKRShort(p)}</option>)}
              </select>
            </label>
          </div>
          <div className="mk-pair">
            <label>Year from
              <select name="minYear" defaultValue={filters.minYear ? String(filters.minYear) : ""}>
                <option value="">Any</option>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label>to
              <select name="maxYear" defaultValue={filters.maxYear ? String(filters.maxYear) : ""}>
                <option value="">Any</option>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <label>Max mileage
            <select name="maxKm" defaultValue={filters.maxKm ? String(filters.maxKm) : ""}>
              <option value="">Any</option>
              {[20_000, 50_000, 80_000, 120_000, 200_000].map((k) => <option key={k} value={k}>Up to {k.toLocaleString()} km</option>)}
            </select>
          </label>
          <label>Body type
            <select name="body" defaultValue={filters.body || ""}>
              <option value="">Any</option>
              {BODY_TYPES[type].map((b) => {
                const n = facets.bodies.find((x) => x.value === b)?.count;
                return <option key={b} value={b}>{b}{n ? ` (${n})` : ""}</option>;
              })}
            </select>
          </label>
          <div className="mk-pair">
            <label>Fuel
              <select name="fuel" defaultValue={filters.fuel || ""}>
                <option value="">Any</option>
                {FUELS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label>Gearbox
              <select name="transmission" defaultValue={filters.transmission || ""}>
                <option value="">Any</option>
                <option>Automatic</option>
                <option>Manual</option>
              </select>
            </label>
          </div>
          <label className="mk-check"><input type="checkbox" name="inspected" value="1" defaultChecked={filters.inspected} /> Inspected cars only</label>
          <label>Assembly
            <select name="assembly" defaultValue={filters.assembly || ""}>
              <option value="">Any</option>
              <option>Local</option>
              <option>Imported</option>
            </select>
          </label>
          <label className="mk-check"><input type="checkbox" name="firstOwner" value="1" defaultChecked={filters.firstOwner} /> First owner</label>
          <label className="mk-check"><input type="checkbox" name="accidentFree" value="1" defaultChecked={filters.accidentFree} /> Accident-free</label>
          <label className="mk-check"><input type="checkbox" name="genuinePaint" value="1" defaultChecked={filters.genuinePaint} /> Total genuine paint</label>
          <details className="mk-feat-filter" open={Boolean(filters.features?.length)}>
            <summary>Must-have features{filters.features?.length ? ` (${filters.features.length})` : ""}</summary>
            {(type === "bike" ? BIKE_MUST_HAVE : CAR_MUST_HAVE).map((x) => (
              <label key={x} className="mk-check"><input type="checkbox" name="feat" value={x} defaultChecked={filters.features?.includes(x)} /> {x}</label>
            ))}
          </details>
          <label>Sort by
            <select name="sort" defaultValue={filters.sort || "newest"}>
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <button type="submit" className="site-btn">Show cars</button>
          <Link href={base} className="site-link">Clear filters</Link>
        </form>

        <div>
          <div className="cc">
            <div className="cc-row">
              {fellBack ? (
                <span className="cc-now">📍 None in {filters.city} yet — showing all Pakistan: <b>{total}</b></span>
              ) : filters.city ? (
                <span className="cc-now">📍 {filters.city}{cityDefaulted ? <small> (your city)</small> : null}: <b>{total}</b></span>
              ) : (
                <span className="cc-now">📍 All Pakistan: <b>{counts.allCities}</b></span>
              )}
              {otherCities.slice(0, 12).map((c) => (
                <Link key={c.city} href={withParam({ city: c.city })} className="cc-chip">{c.city} <b>{c.count}</b></Link>
              ))}
              {otherCities.length > 12 ? <details className="cc-more"><summary>+{otherCities.length - 12} more cities</summary>{otherCities.slice(12).map((c) => <Link key={c.city} href={withParam({ city: c.city })} className="cc-chip">{c.city} <b>{c.count}</b></Link>)}</details> : null}
              {filters.city ? <Link href={withParam({ city: "all" })} className="cc-chip all">All Pakistan <b>{counts.allCities}</b></Link> : null}
            </div>
            {counts.regCities.length ? (
              <div className="cc-row reg">
                <span className="cc-now">🔢 Registered in:</span>
                {counts.regCities.slice(0, 12).map((c) => (
                  <Link key={c.city} href={withParam({ regCity: c.city })} className={`cc-chip${filters.regCity?.toLowerCase() === c.city.toLowerCase() ? " on" : ""}`}>{c.city} <b>{c.count}</b></Link>
                ))}
                {filters.regCity ? <Link href={withParam({ regCity: undefined })} className="cc-chip all">Any registration</Link> : null}
              </div>
            ) : null}
          </div>
          <div className="mk-results-head">
            <b>{total.toLocaleString()} {total === 1 ? noun : `${noun}s`} found</b>
            <SaveSearchButton query={savedQuery} label={savedLabel} />
            <a href="#filters" className="mk-filter-jump">Filter & sort ↓</a>
          </div>
          {listings.length ? (
            <div className="mk-grid">
              {listings.map((car) => <ListingCard key={car._id} car={car} />)}
            </div>
          ) : (
            <div className="site-card">
              <h3>No {noun}s match these filters</h3>
              <p>Try widening the price or year range, or <Link href={base} className="site-link">see all {noun}s</Link>.</p>
            </div>
          )}
          {pages > 1 ? (
            <nav className="mk-pages" aria-label="Pages">
              {page > 1 ? <Link href={pageHref(page - 1)}>‹ Prev</Link> : null}
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
                .map((p, i, arr) => (
                  <span key={p}>
                    {i > 0 && p - arr[i - 1] > 1 ? <span className="mk-gap">…</span> : null}
                    <Link href={pageHref(p)} className={p === page ? "active" : ""}>{p}</Link>
                  </span>
                ))}
              {page < pages ? <Link href={pageHref(page + 1)}>Next ›</Link> : null}
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
}
