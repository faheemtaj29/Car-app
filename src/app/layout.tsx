import type { Metadata } from "next";
import localFont from "next/font/local";
import { settingsService } from "@/backend/services/settings.service";
import { themeCss } from "@/lib/theme";
import "./globals.css";

/** Fonts are bundled with the app (src/app/fonts), so nothing is fetched from Google. */
const display = localFont({
  variable: "--font-display",
  src: [
    { path: "./fonts/spectral-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/spectral-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/spectral-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});
const sans = localFont({
  variable: "--font-sans",
  src: [
    { path: "./fonts/work-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/work-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/work-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/work-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});
const mono = localFont({
  variable: "--font-mono",
  src: [
    { path: "./fonts/space-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});
const urdu = localFont({
  variable: "--font-urdu",
  src: [
    { path: "./fonts/noto-nastaliq-urdu-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-nastaliq-urdu-arabic-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
});

/** Brand and theme come from Settings; a missing database must never block rendering. */
async function brand() {
  try {
    const s = await settingsService.get();
    return { name: s.businessName, tagline: s.tagline, css: themeCss(s.theme) };
  } catch {
    return { name: "Auto Marketplace", tagline: "Cars, bikes, parts & accessories", css: themeCss(null) };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const b = await brand();
  return {
    title: { default: `${b.name} — ${b.tagline || "Cars & bikes"}`, template: `%s | ${b.name}` },
    description: "Buy and sell used & new cars and motorbikes, inspected dealer stock, and genuine parts & accessories.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const b = await brand();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${urdu.variable}`}>
      <head>
        <style id="am-theme" dangerouslySetInnerHTML={{ __html: b.css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
