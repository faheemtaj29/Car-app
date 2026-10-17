/**
 * NADRA identity verification — built, but OFF until NADRA grants access.
 *
 * How to switch it on later (no code changes needed):
 *   1. Get a NADRA Verisys (or e-Sahulat / partner) agreement. NADRA gives you
 *      the API URL, client credentials, organisation code and the exact
 *      request/response format.
 *   2. Check `verisysProvider.verify` below against their spec (fields marked
 *      "NADRA SPEC" are the ones to confirm).
 *   3. Set in the environment:
 *        NADRA_PROVIDER=verisys
 *        NADRA_API_URL=https://...           (from NADRA)
 *        NADRA_CLIENT_ID=...                 (from NADRA)
 *        NADRA_CLIENT_SECRET=...             (from NADRA)
 *        NADRA_ORG_CODE=...                  (from NADRA)
 *        NADRA_AUTO_VERIFY=1                 (optional: a full match marks the
 *                                             seller verified without staff)
 *
 * Providers:
 *   off      (default) nothing is sent anywhere; staff verify by hand.
 *   mock     for development and tests only; never use in production.
 *   verisys  the real NADRA call.
 *
 * Only the CNIC number and the name the seller typed are sent. NADRA's reply
 * is stored as a short result (match / mismatch / not found) — never NADRA's
 * own copy of the citizen's data.
 */

export type NadraRequest = { cnic: string; name: string };
export type NadraResult = {
  status: "match" | "name_mismatch" | "not_found" | "blocked" | "error";
  /** NADRA's transaction id, for disputes and audits. */
  reference?: string;
  /** Short reason for staff when not a clean match. */
  message?: string;
};

interface NadraProvider {
  readonly name: "off" | "mock" | "verisys";
  verify(req: NadraRequest): Promise<NadraResult>;
}

/** Default: integration switched off. */
const offProvider: NadraProvider = {
  name: "off",
  async verify() {
    return { status: "error", message: "NADRA verification is not enabled" };
  },
};

/**
 * Development/test double. Deterministic by the CNIC's last digit:
 *   0 → not found, 1 → name mismatch, 2 → blocked, 9 → error, else → match.
 */
const mockProvider: NadraProvider = {
  name: "mock",
  async verify({ cnic }) {
    const last = cnic.slice(-1);
    const reference = `MOCK-${Date.now().toString(36).toUpperCase()}`;
    if (last === "0") return { status: "not_found", reference, message: "CNIC not found (mock)" };
    if (last === "1") return { status: "name_mismatch", reference, message: "Name does not match NADRA record (mock)" };
    if (last === "2") return { status: "blocked", reference, message: "CNIC blocked or expired (mock)" };
    if (last === "9") return { status: "error", message: "NADRA service unavailable (mock)" };
    return { status: "match", reference };
  },
};

/** Real NADRA call. Fields marked "NADRA SPEC" must be checked against the agreement. */
const verisysProvider: NadraProvider = {
  name: "verisys",
  async verify({ cnic, name }) {
    const url = process.env.NADRA_API_URL;
    const clientId = process.env.NADRA_CLIENT_ID;
    const secret = process.env.NADRA_CLIENT_SECRET;
    const org = process.env.NADRA_ORG_CODE;
    if (!url || !clientId || !secret || !org) return { status: "error", message: "NADRA credentials are not configured" };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // NADRA SPEC: authentication scheme (Basic / OAuth token / signed header).
          Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        },
        // NADRA SPEC: request field names.
        body: JSON.stringify({ organizationCode: org, citizenNumber: cnic, name }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { status: "error", message: `NADRA responded ${res.status}` };
      const data = (await res.json()) as Record<string, unknown>;
      // NADRA SPEC: response field names and status codes.
      const code = String(data.responseCode ?? data.status ?? "");
      const reference = data.transactionId ? String(data.transactionId) : undefined;
      if (code === "100" || code.toLowerCase() === "match") return { status: "match", reference };
      if (code === "101" || code.toLowerCase() === "name_mismatch") return { status: "name_mismatch", reference, message: "Name does not match the NADRA record" };
      if (code === "102" || code.toLowerCase() === "not_found") return { status: "not_found", reference, message: "CNIC not found" };
      if (code === "103" || code.toLowerCase() === "blocked") return { status: "blocked", reference, message: "CNIC blocked, expired or cancelled" };
      return { status: "error", reference, message: `Unrecognised NADRA response ${code}` };
    } catch (e) {
      return { status: "error", message: `NADRA request failed: ${(e as Error).message}` };
    }
  },
};

export function nadraProvider(): NadraProvider {
  const p = (process.env.NADRA_PROVIDER || "off").toLowerCase();
  if (p === "verisys") return verisysProvider;
  // The mock must never run in production, even if mis-set.
  if (p === "mock" && process.env.NODE_ENV !== "production") return mockProvider;
  return offProvider;
}

export const nadraEnabled = () => nadraProvider().name !== "off";
export const nadraAutoVerify = () => process.env.NADRA_AUTO_VERIFY === "1";
