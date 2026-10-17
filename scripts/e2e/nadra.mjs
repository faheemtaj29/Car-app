/**
 * NADRA verification flow, using the built-in mock provider. Run against a
 * server started with NADRA_PROVIDER=mock NADRA_AUTO_VERIFY=1 (never in
 * production), after marketplace.mjs has created the admin:
 *
 *   E2E_BASE_URL=http://localhost:3000 node scripts/e2e/nadra.mjs
 *
 * Mock rule (lib/nadra.ts): CNIC ending 0 → not found, 1 → name mismatch,
 * 2 → blocked, 9 → service error, anything else → match.
 */
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
let pass = 0, fail = 0;
const results = [];
process.on("exit", () => { console.log(results.join("\n")); console.log(`\n${pass} passed, ${fail} failed`); });
function check(name, ok, detail = "") {
  ok ? pass++ : fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
let ip = 20;
class Client {
  constructor() { this.cookies = {}; this.ip = `10.6.0.${ip++}`; }
  async req(method, path, body) {
    const headers = { cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "x-real-ip": this.ip };
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() || []) { const [pair] = c.split(";"); const [k, ...v] = pair.split("="); this.cookies[k] = v.join("="); }
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}
const admin = new Client();
await admin.req("POST", "/api/auth/login", { email: "admin@test.pk", password: "secret123" });
const seller = async (phone, cnic) => {
  const c = new Client();
  await c.req("POST", "/api/site/member/register", { name: "Nadra Test", phone, password: "goodpass123" });
  const r = await c.req("POST", "/api/site/partner/kyc", { legalName: "Nadra Test", cnic, address: "House 1, Street 1, G-9/1", city: "Islamabad", consent: true });
  return { c, r, id: (await c.req("GET", "/api/site/member/me")).data.member?._id };
};
let r = await admin.req("GET", "/api/shop/partners");
check("NADRA reported as switched on (mock)", r.data.nadra === true, JSON.stringify(r.data.nadra));

const ok = await seller("0317-6000001", "61101-5550001-5");
check("full NADRA match → seller verified automatically", ok.r.data.kyc?.status === "verified", JSON.stringify(ok.r.data.kyc));
const bad = await seller("0317-6000002", "61101-5550002-1");
check("name mismatch → stays pending for staff (not auto-rejected)", bad.r.data.kyc?.status === "pending");
const nf = await seller("0317-6000003", "61101-5550003-0");
r = await admin.req("GET", "/api/shop/partners?kyc=pending");
const row = (id) => r.data.members?.find((m) => m._id === id);
check("staff see the NADRA result and reference", row(bad.id)?.kyc?.nadra?.status === "name_mismatch" && /^MOCK-/.test(row(bad.id)?.kyc?.nadra?.reference || ""), JSON.stringify(row(bad.id)?.kyc?.nadra));
check("CNIC not found is flagged", row(nf.id)?.kyc?.nadra?.status === "not_found");
r = await admin.req("GET", "/api/shop/partners?kyc=verified");
check("auto-verified seller is marked as verified by NADRA", r.data.members?.find((m) => m._id === ok.id)?.kyc?.reviewedBy === "NADRA (automatic)");
const rep = new Client();
await rep.req("POST", "/api/auth/login", { email: "rep@test.pk", password: "secret123" });
r = await rep.req("POST", `/api/shop/partners/${bad.id}/nadra`);
check("only admins can run a NADRA check", r.status === 403);
r = await admin.req("POST", `/api/shop/partners/${bad.id}/nadra`);
check("admin re-runs the check", r.data.result?.status === "name_mismatch", JSON.stringify(r.data));
r = await ok.c.req("GET", "/api/site/partner");
check("seller's own view does not expose NADRA internals", !JSON.stringify(r.data).includes("MOCK-") && !JSON.stringify(r.data).includes("nadra"));
