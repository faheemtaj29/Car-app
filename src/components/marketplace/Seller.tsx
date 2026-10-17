"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CITY_LIST_ID } from "@/components/CatalogLists";
import { PART_CATEGORIES } from "@/lib/catalog";

export type PartnerState = {
  accountType: "individual" | "dealer" | "supplier";
  kyc: { status: "none" | "pending" | "verified" | "rejected"; legalName?: string; cnic?: string; city?: string; submittedAt?: string; reviewNote?: string };
  business: null | { certNo?: string; certDownloadedAt?: string; name: string; slug: string; status: "pending" | "approved" | "rejected" | "suspended"; city: string; address: string; phone: string; whatsapp?: string; ntn?: string; about?: string; categories?: string[]; reviewNote?: string };
};

export function usePartner() {
  const [state, setState] = useState<PartnerState | null | "out">(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/site/partner");
    setState(res.ok ? await res.json() : "out");
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setState("out"));
  }, [load]);
  return { partner: state, reload: load };
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save");
  return data;
}

const KYC_LABEL = { none: "Not submitted", pending: "Under review", verified: "Verified ✓", rejected: "Needs changes" } as const;
const BIZ_LABEL = { pending: "Under review", approved: "Approved ✓", rejected: "Needs changes", suspended: "Suspended" } as const;

/** Identity for the record: name, CNIC number, address. No ID-card copy. */
export function KycForm({ partner, onDone }: { partner: PartnerState; onDone: () => void }) {
  const [f, setF] = useState({ legalName: partner.kyc.legalName || "", cnic: "", address: "", city: partner.kyc.city || "", consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 13);
    return d.length > 12 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/site/partner/kyc", f);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="site-form" onSubmit={submit}>
      <div className="kyc-note">
        <b>🔒 For our records only — never shown on the website.</b>
        <p>
          To keep the marketplace safe from fraud, every seller gives their name, CNIC number and address once. We keep the CNIC number encrypted,
          only our verification staff can see it, and we use it only to confirm who is selling and to answer lawful requests from the authorities.
          We do not ask for a copy of your ID card. Buyers only see the name and phone number you choose to show on your ad, plus a &quot;Verified&quot; badge once we have checked your details.
        </p>
      </div>
      <div className="site-form-grid">
        <label>Full name (as on CNIC)<input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} required minLength={3} autoComplete="name" /></label>
        <label>CNIC number<input value={f.cnic} onChange={(e) => setF({ ...f, cnic: fmt(e.target.value) })} required placeholder="35202-1234567-1" inputMode="numeric" autoComplete="off" /></label>
        <label>City<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required list={CITY_LIST_ID} autoComplete="off" /></label>
      </div>
      <label className="site-form-wide">Home address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required minLength={10} autoComplete="street-address" /></label>
      <label className="mk-check-row">
        <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} required /> I confirm these details are mine and correct, and agree that they are kept for verification and legal purposes as described above.
      </label>
      {error ? <div className="mk-error">{error}</div> : null}
      <button type="submit" className="site-btn" disabled={busy || !f.consent} style={{ marginTop: 12 }}>{busy ? "Saving…" : "Submit for verification"}</button>
    </form>
  );
}

/** Dealership or parts-supplier profile (public once approved). */
export function BusinessForm({ partner, type, onDone }: { partner: PartnerState; type: "dealer" | "supplier"; onDone: () => void }) {
  const b = partner.business;
  const [f, setF] = useState({ name: b?.name || "", address: b?.address || "", city: b?.city || partner.kyc.city || "", phone: b?.phone || "", whatsapp: b?.whatsapp || "", ntn: b?.ntn || "", about: b?.about || "", categories: b?.categories || [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/site/partner/business", { type, ...f, categories: type === "supplier" ? f.categories : undefined });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="site-form" onSubmit={submit}>
      <p className="mk-muted">This is your public profile: buyers see the business name, city, address and business phone.</p>
      <div className="site-form-grid">
        <label>{type === "dealer" ? "Showroom name" : "Shop / company name"}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={3} /></label>
        <label>City<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required list={CITY_LIST_ID} autoComplete="off" /></label>
        <label>Business phone<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required inputMode="tel" /></label>
        <label>WhatsApp (optional)<input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} inputMode="tel" /></label>
        <label>NTN (optional)<input value={f.ntn} onChange={(e) => setF({ ...f, ntn: e.target.value })} placeholder="1234567-8" /></label>
      </div>
      <label className="site-form-wide">Business address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required minLength={10} /></label>
      <label className="site-form-wide">About (optional)<textarea rows={3} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} maxLength={800} placeholder={type === "dealer" ? "Since 2005, imported and local cars, bank leasing available…" : "Genuine Toyota & Honda parts, wholesale and retail…"} /></label>
      {type === "supplier" ? (
        <div className="vs-checks" style={{ padding: 0 }}>
          {PART_CATEGORIES.map((c) => (
            <label key={c} className={f.categories.includes(c) ? "on" : ""}>
              <input type="checkbox" checked={f.categories.includes(c)} onChange={() => setF({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] })} /> {c}
            </label>
          ))}
        </div>
      ) : null}
      {error ? <div className="mk-error">{error}</div> : null}
      <button type="submit" className="site-btn" disabled={busy} style={{ marginTop: 12 }}>{busy ? "Saving…" : b ? "Save profile" : "Submit for approval"}</button>
    </form>
  );
}

/** Account page card: verification status and business registration. */
/** Triggers the browser's download of the certificate PDF. */
function downloadCertificate() {
  const a = document.createElement("a");
  a.href = "/api/site/partner/certificate";
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Shown once a business is approved. The first time the owner opens their
 * account after approval, the certificate downloads by itself; after that
 * there is always a button to get it again.
 */
function CertificateCard({ business, onDownloaded }: { business: NonNullable<PartnerState["business"]>; onDownloaded: () => void }) {
  const first = !business.certDownloadedAt;
  useEffect(() => {
    if (!first) return;
    downloadCertificate();
    const t = setTimeout(onDownloaded, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);
  return (
    <div className="cert-card">
      <div>
        <b>🎉 {first ? "Your registration is approved" : "Certificate of registration"}</b>
        <p>{first ? "Your certificate is downloading now. " : ""}Certificate no. <b>{business.certNo || "being issued"}</b>. Show it to customers: the QR code on it proves it is genuine.</p>
      </div>
      <button type="button" className="site-btn" onClick={() => { downloadCertificate(); setTimeout(onDownloaded, 1500); }}>⬇ Download certificate (PDF)</button>
    </div>
  );
}

export function SellerSetup({ want }: { want?: "dealer" | "supplier" | "individual" }) {
  const { partner, reload } = usePartner();
  const [editing, setEditing] = useState<"kyc" | "business" | null>(null);
  if (!partner || partner === "out") return null;
  const type = partner.accountType !== "individual" ? partner.accountType : want === "dealer" || want === "supplier" ? want : null;
  const kycOk = partner.kyc.status === "pending" || partner.kyc.status === "verified";
  // Coming from "Register as dealer/supplier", open the next form straight away.
  const showKyc = editing === "kyc" || (partner.kyc.status === "none" && Boolean(want));
  const showBusiness = Boolean(type) && (editing === "business" || (kycOk && !partner.business && Boolean(want) && editing === null));

  return (
    <div className="site-card seller-setup" id="verify">
      <h3>Seller verification</h3>
      <div className="ss-steps">
        <div className={`ss-step ${partner.kyc.status}`}>
          <b>1. Identity</b>
          <span>{KYC_LABEL[partner.kyc.status]}{partner.kyc.cnic ? ` · CNIC ${partner.kyc.cnic}` : ""}</span>
          {partner.kyc.reviewNote ? <small className="mk-error">{partner.kyc.reviewNote}</small> : null}
          {partner.kyc.status !== "verified" && editing !== "kyc" ? <button type="button" className="mk-link" onClick={() => setEditing("kyc")}>{partner.kyc.status === "none" ? "Start" : "Update"}</button> : null}
        </div>
        {type ? (
          <div className={`ss-step ${partner.business?.status || "none"}`}>
            <b>2. {type === "dealer" ? "Dealership" : "Parts supplier"} profile</b>
            <span>{partner.business ? BIZ_LABEL[partner.business.status] : "Not submitted"}</span>
            {partner.business?.reviewNote ? <small className="mk-error">{partner.business.reviewNote}</small> : null}
            {kycOk && editing !== "business" ? <button type="button" className="mk-link" onClick={() => setEditing("business")}>{partner.business ? "Edit profile" : "Register business"}</button> : null}
            {partner.business?.status === "approved" ? <Link className="mk-link" href={`/${type === "dealer" ? "dealers" : "suppliers"}/${partner.business.slug}`}>View public page ↗</Link> : null}
          </div>
        ) : (
          <div className="ss-step none">
            <b>Selling as a business?</b>
            <span>Register a <Link href="/register?type=dealer">dealership</Link> or a <Link href="/register?type=supplier">parts shop</Link>.</span>
          </div>
        )}
      </div>
      {partner.business?.status === "approved" ? <CertificateCard business={partner.business} onDownloaded={reload} /> : null}
      {showKyc ? <KycForm partner={partner} onDone={() => { setEditing(null); reload(); }} /> : null}
      {showBusiness && type ? <BusinessForm partner={partner} type={type} onDone={() => { setEditing(null); reload(); }} /> : null}
    </div>
  );
}
