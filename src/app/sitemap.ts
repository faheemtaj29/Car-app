import type { MetadataRoute } from "next";
import { marketplaceService } from "@/backend/services/marketplace.service";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed: MetadataRoute.Sitemap = ["", "/cars", "/bikes", "/shop", "/sell-car", "/post-ad"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.8,
  }));
  try {
    const { listings, products } = await marketplaceService.sitemapEntries();
    return [
      ...fixed,
      ...listings.map((l) => ({ url: `${base}${l.path}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...products.map((p) => ({ url: `${base}${p.path}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ];
  } catch {
    return fixed; // database down: still serve the static pages
  }
}
