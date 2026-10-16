import type { Metadata } from "next";
import { Spectral, Work_Sans, Space_Mono } from "next/font/google";
import { settingsService } from "@/backend/services/settings.service";
import { themeCss } from "@/lib/theme";
import "./globals.css";

const display = Spectral({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const sans = Work_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = Space_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "700"] });

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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <style id="am-theme" dangerouslySetInnerHTML={{ __html: b.css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
