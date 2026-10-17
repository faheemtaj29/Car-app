/**
 * Field encryption for identity data (CNIC numbers). AES-256-GCM with a key
 * derived from KYC_SECRET (falls back to JWT_SECRET), plus a keyed hash so we
 * can spot the same CNIC on two accounts without storing it in the clear.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { env } from "@/backend/config/env";

function key() {
  return createHash("sha256").update(`${process.env.KYC_SECRET || env.jwtSecret}::kyc-field::v1`).digest();
}

export function encryptField(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function decryptField(stored: string) {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable encrypted field");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

export function lookupHash(value: string) {
  return createHmac("sha256", key()).update(value).digest("hex");
}

/** "35202-1234567-1" (or 3520212345671) → "3520212345671"; null when not 13 digits. */
export function normaliseCnic(input: string) {
  const digits = input.replace(/\D/g, "");
  return digits.length === 13 ? digits : null;
}

export const formatCnic = (d: string) => `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
export const maskCnic = (last4: string) => `•••••-•••${last4.slice(0, 3)}-${last4.slice(3)}`;
