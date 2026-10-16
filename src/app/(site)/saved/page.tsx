import type { Metadata } from "next";
import { SavedPage } from "@/components/marketplace/SavedClient";

export const metadata: Metadata = { title: "Saved vehicles", robots: { index: false } };

export default function Saved() {
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Your list</span>
      <h2>Saved cars & bikes</h2>
      <p className="site-lead">Saved on this device. Prices and availability are live.</p>
      <SavedPage />
    </section>
  );
}
