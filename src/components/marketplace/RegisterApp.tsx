"use client";

import Link from "next/link";
import { AuthPanel, useMe } from "./Member";
import { SellerSetup } from "./Seller";

const TYPES = [
  { key: "individual", icon: "🙋", title: "Individual", text: "Sell your own car or bike. Up to 5 live ads.", next: "/post-ad" },
  { key: "dealer", icon: "🏢", title: "Car / bike dealer", text: "List your whole showroom stock (up to 200 cars), get a dealer page and badge.", next: "" },
  { key: "supplier", icon: "🛠️", title: "Parts & accessories supplier", text: "List parts with the exact makes, models and years they fit. Buyers contact you directly.", next: "" },
] as const;

export function RegisterApp({ type }: { type?: "individual" | "dealer" | "supplier" }) {
  const { state, reload } = useMe();
  if (!type) {
    return (
      <div className="reg-types">
        {TYPES.map((t) => (
          <Link key={t.key} href={`/register?type=${t.key}`} className="site-card reg-type">
            <span>{t.icon}</span>
            <b>{t.title}</b>
            <p>{t.text}</p>
            <em>Register →</em>
          </Link>
        ))}
      </div>
    );
  }
  if (state === "loading") return <p className="mk-muted">Loading…</p>;
  if (state === "out") return <AuthPanel onDone={reload} intro="Step 1: create your account (or log in). Then we take your identity details for our records." />;
  return (
    <>
      <SellerSetup want={type} />
      {type === "individual" ? <p><Link href="/post-ad" className="site-btn">Post an ad →</Link></p> : <p className="mk-muted">After approval, list from <Link href="/account">My account</Link>{type === "dealer" ? " or Post an ad" : ""}.</p>}
    </>
  );
}
