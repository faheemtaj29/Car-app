import type { Metadata } from "next";
import { RegisterApp } from "@/components/marketplace/RegisterApp";

export const metadata: Metadata = { title: "Register to sell — individuals, dealers and parts suppliers" };

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function RegisterPage({ searchParams }: { searchParams: Search }) {
  const t = (await searchParams).type;
  const type = t === "dealer" || t === "supplier" || t === "individual" ? t : undefined;
  const title = type === "dealer" ? "Register your dealership" : type === "supplier" ? "Register your parts business" : type === "individual" ? "Sell your own vehicle" : "Start selling";
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Register</span>
      <h2>{title}</h2>
      <p className="site-lead">Every seller is verified once with their CNIC number for everyone&apos;s safety. It stays private: buyers never see it.</p>
      <RegisterApp type={type} />
    </section>
  );
}
