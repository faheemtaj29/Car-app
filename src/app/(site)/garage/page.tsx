import type { Metadata } from "next";
import { GarageApp } from "@/components/marketplace/Garage";

export const metadata: Metadata = {
  title: "My Garage — service record & reminders",
  description: "Keep your car's service record, get oil-change, token-tax and insurance reminders, and find parts that fit.",
  robots: { index: false },
};

export default function GaragePage() {
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">My Garage</span>
      <h2>Your car, looked after</h2>
      <p className="site-lead">Reminders for oil, service, token tax and insurance; a service record that raises your resale value; parts that fit.</p>
      <GarageApp />
    </section>
  );
}
