import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { partnerService } from "@/backend/services/partner.service";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { reviewService } from "@/backend/services/review.service";
import { BusinessHeader } from "@/components/marketplace/Directory";
import { ListingCard } from "@/components/marketplace/Listing";
import { TrustCard } from "@/components/marketplace/TrustTools";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const b = await partnerService.bySlug((await params).slug);
  return b ? { title: `${b.name} — cars for sale in ${b.city}` } : { title: "Dealer not found" };
}

export default async function DealerPage({ params }: { params: Params }) {
  const b = await partnerService.bySlug((await params).slug);
  if (!b || b.type !== "dealer") notFound();
  const [cars, bikes, trust] = await Promise.all([
    marketplaceService.search({ type: "car", seller: "private", sellerMember: b.id }),
    marketplaceService.search({ type: "bike", seller: "private", sellerMember: b.id }),
    reviewService.trust("member", b.id),
  ]);
  const list = [...cars.listings, ...bikes.listings];
  return (
    <section className="site-section mk-wrap">
      <BusinessHeader b={b} kind="dealer" />
      <div className="mk-detail">
        <div>
          <div className="home-block-head"><h3>{cars.total + bikes.total} vehicles in stock</h3></div>
          {list.length ? <div className="mk-grid">{list.map((c) => <ListingCard key={c._id} car={c} />)}</div> : <p className="mk-muted">No vehicles listed right now.</p>}
        </div>
        <aside className="mk-side"><div className="site-card"><h3>Reviews</h3><TrustCard trust={trust} targetType="member" targetId={b.id} name={b.name} /></div></aside>
      </div>
    </section>
  );
}
