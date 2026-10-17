import Link from "next/link";
import type { Metadata } from "next";
import { certificateService } from "@/backend/services/certificate.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify a certificate of registration", robots: { index: false } };
type Params = Promise<{ no: string }>;

/** What the QR code on a certificate opens: is it genuine, and still active? */
export default async function VerifyPage({ params }: { params: Params }) {
  const no = decodeURIComponent((await params).no).toUpperCase();
  const c = await certificateService.verify(no);
  return (
    <section className="site-section mk-wrap">
      <span className="site-kicker">Certificate check</span>
      <h2>Certificate of Registration</h2>
      {!c ? (
        <div className="site-card verify bad">
          <h3>✗ Not found</h3>
          <p>No certificate numbered <b>{no}</b> was issued by this marketplace. If you were handed this paper, be careful: it may be fake.</p>
        </div>
      ) : (
        <div className={`site-card verify ${c.active ? "ok" : "bad"}`}>
          <h3>{c.active ? "✓ Genuine and active" : "⚠ Genuine, but no longer active"}</h3>
          <p><b>{c.name}</b> · {c.type === "dealer" ? "Registered dealership" : "Registered parts supplier"} · {c.city}</p>
          <p className="mk-muted">Certificate {c.certNo}{c.issuedAt ? ` · issued ${new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
          {c.active ? <p><Link className="site-link" href={`/${c.type === "dealer" ? "dealers" : "suppliers"}/${c.slug}`}>See their page →</Link></p> : <p>This business is currently suspended or has been removed from the marketplace. Do not make payments on the strength of this certificate.</p>}
        </div>
      )}
    </section>
  );
}
