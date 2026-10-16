/** Public base URL for absolute links (sitemap, canonical, JSON-LD). Set SITE_URL in production. */
export function siteUrl() {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
