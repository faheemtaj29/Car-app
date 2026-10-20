import type { MetadataRoute } from "next";
import { settingsService } from "@/backend/services/settings.service";

export const revalidate = 3600;

/** Makes the website installable on a phone's home screen. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await settingsService.get().catch(() => null);
  const name = s?.businessName || "Auto Marketplace";
  return {
    name,
    short_name: name.length > 14 ? name.slice(0, 12).trim() : name,
    description: s?.tagline || "Cars, bikes, parts & accessories",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f2",
    theme_color: "#0e5c44",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cars", url: "/cars", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Bikes", url: "/bikes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My Garage", url: "/garage", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
