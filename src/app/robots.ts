import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/dealership", "/ecommerce", "/inventory", "/accounting", "/settings", "/login", "/setup", "/account", "/shop/cart", "/shop/track"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
