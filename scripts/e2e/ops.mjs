/**
 * Launch-readiness checks: health endpoint, security headers, photo upload and
 * serving (including path-traversal attempts). Run after marketplace.mjs
 * (needs its admin account):
 *
 *   E2E_BASE_URL=http://localhost:3000 node scripts/e2e/ops.mjs
 */
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
let pass = 0, fail = 0;
const results = [];
process.on("exit", () => { console.log(results.join("\n")); console.log(`\n${pass} passed, ${fail} failed`); });
function check(name, ok, detail = "") {
  ok ? pass++ : fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let res = await fetch(`${BASE}/api/health`);
const body = await res.json().catch(() => ({}));
check("health endpoint answers without logging in", res.status === 200 && body.ok === true, `${res.status} ${JSON.stringify(body)}`);

res = await fetch(`${BASE}/`);
const h = (k) => res.headers.get(k) || "";
check("pages forbid being framed (clickjacking)", h("x-frame-options") === "DENY" && /frame-ancestors 'none'/.test(h("content-security-policy")));
check("browsers must not guess file types", h("x-content-type-options") === "nosniff");
check("referrer and permissions policies set", /strict-origin/.test(h("referrer-policy")) && /camera=\(\)/.test(h("permissions-policy")));
check("forms may only post back to this site", /form-action 'self'/.test(h("content-security-policy")) && /object-src 'none'/.test(h("content-security-policy")));
check("framework version is not advertised", h("x-powered-by") === "");
res = await fetch(`${BASE}/api/site/badges`);
check("API responses are never cached", /no-store/.test(h("cache-control")), h("cache-control"));

// Staff upload → serve → traversal.
const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.3.3.3" }, body: JSON.stringify({ email: "admin@test.pk", password: "secret123" }) });
const cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
check("admin login", login.status === 200);
const fd = () => { const f = new FormData(); f.append("file", new Blob([png], { type: "image/png" }), "x.png"); return f; };
let up = await fetch(`${BASE}/api/uploads/image`, { method: "POST", headers: { cookie }, body: fd() });
const upData = await up.json().catch(() => ({}));
check("photo upload returns a URL", up.status === 201 && /\.png$/.test(upData.url || ""), upData.url || upData.error);
const url = upData.url || "";
const abs = url.startsWith("http") ? url : `${BASE}${url}`;
res = await fetch(abs);
const got = Buffer.from(await res.arrayBuffer());
check("uploaded photo is served back unchanged", res.status === 200 && got.equals(png), `${res.status}`);
check("photos are cached for a year (they never change)", /immutable/.test(res.headers.get("cache-control") || "") || url.startsWith("http"), res.headers.get("cache-control"));
if (url.startsWith("/uploads/")) {
  for (const p of ["/uploads/..%2f..%2fetc%2fpasswd", "/uploads/images/../../package.json", "/uploads/.env", "/uploads/images/readme.txt", "/uploads/images/2026/..%5c..%5cpackage.json"]) {
    const r = await fetch(`${BASE}${p}`);
    check(`path trick refused: ${p}`, r.status === 404, String(r.status));
  }
}
up = await fetch(`${BASE}/api/uploads/image`, { method: "POST", body: fd() });
check("anonymous cannot upload through the staff route", up.status === 401, String(up.status));
const bad = new FormData(); bad.append("file", new Blob([Buffer.from("<?php echo 1;")], { type: "image/png" }), "evil.png");
up = await fetch(`${BASE}/api/uploads/image`, { method: "POST", headers: { cookie }, body: bad });
check("a disguised non-image is refused", up.status === 400, String(up.status));
