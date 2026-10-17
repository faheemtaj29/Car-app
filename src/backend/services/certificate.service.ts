/**
 * Certificate of Registration for approved dealers and parts suppliers.
 *
 * Issued automatically when an admin approves the business (or on first
 * download for businesses approved earlier). The PDF is generated on request,
 * so it always shows the current business details, and carries a QR code to a
 * public page that confirms the certificate is genuine and still active.
 *
 * Only business details appear on it: no CNIC, no home address.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { dbConnect } from "@/backend/config/database";
import { MarketMember, type IMarketMember } from "@/backend/models/Marketplace";
import { ServiceError } from "@/backend/types";
import type { Types } from "mongoose";
import { nextSequence } from "@/backend/lib/sequence";
import { settingsService } from "@/backend/services/settings.service";
import { siteUrl } from "@/lib/site";

type Member = IMarketMember & { _id: Types.ObjectId };

/** Runs on approval; harmless to call again (keeps the original number). */
export async function issueCertificate(memberId: string) {
  const m = await MarketMember.findById(memberId).select("business accountType").lean<Member>();
  if (!m?.business?.name || m.business.status !== "approved") return null;
  if (m.business.certNo) return m.business.certNo;
  const year = new Date().getFullYear();
  const certNo = `CR-${year}-${String(await nextSequence(`CERT:${year}`)).padStart(5, "0")}`;
  // Only the first writer wins, so a double approval cannot issue two numbers.
  await MarketMember.updateOne({ _id: memberId, "business.certNo": { $exists: false } }, { $set: { "business.certNo": certNo, "business.certIssuedAt": new Date() } });
  const after = await MarketMember.findById(memberId).select("business.certNo").lean<Member>();
  return after?.business?.certNo || certNo;
}

const TYPE_LABEL = { dealer: "Motor Vehicle Dealership", supplier: "Auto Parts & Accessories Supplier" } as const;
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
/** The built-in PDF fonts cover Latin text only; anything else would print as junk. */
const latin = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "").replace(/\s+/g, " ").trim() || "Registered business";

function render(opts: { issuer: string; name: string; type: "dealer" | "supplier"; city: string; address: string; phone: string; certNo: string; issuedAt: Date; verifyUrl: string; qr: Buffer }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, info: { Title: `Certificate of Registration ${opts.certNo}`, Author: opts.issuer, Subject: "Certificate of Registration" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const green = "#0e5c44";
    const gold = "#b8860b";

    // Double border
    doc.lineWidth(3).strokeColor(green).rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(0.8).strokeColor(gold).rect(34, 34, W - 68, H - 68).stroke();

    doc.fillColor(green).font("Helvetica-Bold").fontSize(13).text(latin(opts.issuer).toUpperCase(), 0, 62, { align: "center", characterSpacing: 2 });
    doc.fillColor("#222").font("Times-Bold").fontSize(38).text("Certificate of Registration", 0, 90, { align: "center" });
    doc.strokeColor(gold).lineWidth(1.2).moveTo(W / 2 - 90, 142).lineTo(W / 2 + 90, 142).stroke();

    doc.fillColor("#555").font("Times-Roman").fontSize(14).text("This is to certify that", 0, 162, { align: "center" });
    doc.fillColor(green).font("Times-Bold").fontSize(32).text(latin(opts.name), 60, 188, { align: "center", width: W - 120 });
    const y = doc.y + 6;
    doc.fillColor("#555").font("Times-Roman").fontSize(14).text(`is registered on ${latin(opts.issuer)} as a`, 0, y, { align: "center" });
    doc.fillColor("#222").font("Times-Bold").fontSize(20).text(TYPE_LABEL[opts.type], 0, doc.y + 6, { align: "center" });
    doc.fillColor("#555").font("Times-Roman").fontSize(13).text(`${latin(opts.address)}, ${latin(opts.city)}  ·  ${opts.phone}`, 60, doc.y + 8, { align: "center", width: W - 120 });
    doc.fillColor("#555").fontSize(12).text("The owner's identity has been verified by the marketplace. This certificate remains valid while the registration is active.", 90, doc.y + 8, { align: "center", width: W - 180 });

    // Footer: number + date on the left, QR on the right
    const fy = H - 150;
    doc.fillColor("#888").font("Helvetica").fontSize(9).text("CERTIFICATE NO.", 70, fy);
    doc.fillColor("#222").font("Helvetica-Bold").fontSize(16).text(opts.certNo, 70, fy + 12);
    doc.fillColor("#888").font("Helvetica").fontSize(9).text("DATE OF ISSUE", 70, fy + 42);
    doc.fillColor("#222").font("Helvetica-Bold").fontSize(13).text(fmtDate(opts.issuedAt), 70, fy + 54);

    doc.image(opts.qr, W - 170, fy - 14, { width: 96 });
    doc.fillColor("#888").font("Helvetica").fontSize(8).text("Scan to verify", W - 170, fy + 84, { width: 96, align: "center" });
    doc.fillColor("#888").fontSize(8).text(opts.verifyUrl, 120, H - 62, { align: "center", width: W - 240 });
    doc.end();
  });
}

export const certificateService = {
  /** The member's own certificate as a PDF. Marks it as downloaded. */
  async pdfFor(memberId: string) {
    await dbConnect();
    const certNo = await issueCertificate(memberId);
    const m = await MarketMember.findById(memberId).select("business accountType status").lean<Member>();
    if (!certNo || !m?.business || m.business.status !== "approved" || m.status !== "active") {
      throw new ServiceError("FORBIDDEN", "A certificate is available once your business registration is approved", 403);
    }
    const settings = await settingsService.get();
    const verifyUrl = `${siteUrl()}/verify/${certNo}`;
    const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 300, errorCorrectionLevel: "M" });
    const fresh = await MarketMember.findById(memberId).select("business.certIssuedAt").lean<Member>();
    const body = await render({
      issuer: settings.businessName,
      name: m.business.name,
      type: m.accountType === "supplier" ? "supplier" : "dealer",
      city: m.business.city,
      address: m.business.address,
      phone: m.business.phone,
      certNo,
      issuedAt: fresh?.business?.certIssuedAt || new Date(),
      verifyUrl,
      qr,
    });
    await MarketMember.updateOne({ _id: memberId }, { $set: { "business.certDownloadedAt": new Date() } });
    return { body, filename: `Certificate-${certNo}.pdf` };
  },

  /** Public check behind the QR code: genuine, and still active? */
  async verify(certNo: string) {
    await dbConnect();
    if (!/^CR-\d{4}-\d{5}$/.test(certNo)) return null;
    const m = await MarketMember.findOne({ "business.certNo": certNo }).select("business accountType status").lean<Member>();
    if (!m?.business) return null;
    return {
      certNo,
      name: m.business.name,
      type: m.accountType === "supplier" ? ("supplier" as const) : ("dealer" as const),
      city: m.business.city,
      slug: m.business.slug,
      issuedAt: m.business.certIssuedAt ? new Date(m.business.certIssuedAt).toISOString() : undefined,
      active: m.business.status === "approved" && m.status === "active",
    };
  },
};
