import type { Metadata } from "next";
import { partnerService } from "@/backend/services/partner.service";
import { Directory } from "@/components/marketplace/Directory";
import { getMyCity } from "@/lib/i18n.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parts & accessories suppliers" };
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).city;
  const city = (Array.isArray(raw) ? raw[0] : raw) ?? (await getMyCity()) ?? "";
  const list = await partnerService.directory("supplier", city || null);
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Directory</span>
      <h2>Parts & accessories suppliers{city ? ` in ${city}` : ""}</h2>
      <Directory type="supplier" list={list} city={city || undefined} />
    </section>
  );
}
