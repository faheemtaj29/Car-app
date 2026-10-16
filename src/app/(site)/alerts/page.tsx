import type { Metadata } from "next";
import { AlertsApp } from "@/components/marketplace/Alerts";

export const metadata: Metadata = { title: "My alerts", robots: { index: false } };

export default function AlertsPage() {
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Alerts</span>
      <h2>Saved searches & price watches</h2>
      <p className="site-lead">New cars that match your searches and price drops on cars you are watching, waiting for you here.</p>
      <AlertsApp />
    </section>
  );
}
