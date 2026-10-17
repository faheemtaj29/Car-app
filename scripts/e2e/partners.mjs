/**
 * End-to-end checks for seller verification, dealer and supplier accounts,
 * parts-by-vehicle search, the brand/city catalogue and city-first search.
 * Run after marketplace.mjs and engagement.mjs on the same *_test database:
 *
 *   E2E_BASE_URL=http://localhost:3000 node scripts/e2e/partners.mjs
 */
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
let pass = 0, fail = 0;
const results = [];
process.on("exit", () => { console.log(results.join("\n")); console.log(`\n${pass} passed, ${fail} failed`); });
function check(name, ok, detail = "") {
  ok ? pass++ : fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

let ipSeq = 10;
class Client {
  constructor(name) { this.name = name; this.cookies = {}; this.ip = `10.8.0.${ipSeq++}`; }
  async req(method, path, body, { raw } = {}) {
    const headers = { cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "x-real-ip": this.ip };
    let payload;
    if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";"); const [k, ...v] = pair.split("=");
      if (v.join("=") === "" || /Max-Age=0/i.test(c)) delete this.cookies[k]; else this.cookies[k] = v.join("=");
    }
    if (raw) return res;
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async html(path) { return (await (await this.req("GET", path, undefined, { raw: true })).text()).replaceAll("<!-- -->", ""); }
}

const admin = new Client("admin");
let r = await admin.req("POST", "/api/auth/login", { email: "admin@test.pk", password: "secret123" });
check("admin login", r.status === 200, r.data.error);
const rep = new Client("rep");
r = await rep.req("POST", "/api/auth/login", { email: "rep@test.pk", password: "secret123" });
check("staff (non-admin) login", r.status === 200, r.data.error);
const img = (await admin.req("GET", "/api/shop")).data.products?.find((p) => p.shop?.images?.[0])?.shop.images[0];

const register = async (name, phone) => {
  const c = new Client(name);
  const res = await c.req("POST", "/api/site/member/register", { name, phone, password: "goodpass123", city: "Islamabad" });
  check(`register ${name}`, res.status === 201, res.data.error);
  return c;
};
const kyc = (c, legalName, cnic, city = "Islamabad") => c.req("POST", "/api/site/partner/kyc", { legalName, cnic, address: "House 12, Street 5, Sector F-8/3", city, consent: true });
const adBody = (extra = {}) => ({ vehicleType: "car", make: "Toyota", model: "Corolla", variant: "GLi", year: 2017, mileage: 90000, fuel: "Petrol", transmission: "Manual", condition: "used", city: "Islamabad", listPrice: 3600000, negotiable: true, photos: [img], features: [], sellerName: "Seller", sellerPhone: "0311-1111111", showPhone: true, ...extra });

/* ------------------------------------------------- catalogue */
let page = await new Client("c").html("/cars");
check("all brands offered even with no listings (Haval, Changan, BYD)", ["Haval", "Changan", "BYD"].every((m) => page.includes(`>${m}</option>`)));
check("all cities offered (Rahim Yar Khan, Gilgit)", page.includes(">Rahim Yar Khan</option>") && page.includes(">Gilgit</option>"));
check("model list for every brand ships with the page", page.includes('id="cat-models-car-toyota"') && page.includes('value="Land Cruiser Prado"'));

/* ------------------------------------------------- individual seller + KYC */
const usman = await register("Usman Tariq", "0312-1000001");
r = await usman.req("POST", "/api/site/member/ads", adBody());
check("no ad before identity is given", r.status === 403 && /CNIC/.test(r.data.error || ""), r.data.error);
r = await kyc(usman, "Usman Tariq", "12345");
check("short CNIC refused", r.status === 400, r.data.error);
r = await usman.req("POST", "/api/site/partner/kyc", { legalName: "Usman Tariq", cnic: "61101-1234567-9", address: "House 12, Street 5, F-8", city: "Islamabad" });
check("consent is required", r.status === 400, r.data.error);
r = await kyc(usman, "Usman Tariq", "61101-1234567-9");
check("identity submitted → pending, CNIC masked", r.status === 200 && r.data.kyc?.status === "pending" && r.data.kyc.cnic && !r.data.kyc.cnic.includes("1234567"), JSON.stringify(r.data.kyc));
r = await usman.req("GET", "/api/site/partner");
check("member's own view never returns the full CNIC or address", !JSON.stringify(r.data).includes("1234567") && !JSON.stringify(r.data).includes("Sector F-8"));
const twin = await register("Fake Usman", "0312-1000002");
r = await kyc(twin, "Usman Tariq", "6110112345679");
check("same CNIC on a second account refused", r.status === 409, r.data.error);
r = await new Client("x").req("POST", "/api/site/partner/kyc/upload");
check("no CNIC photo upload exists (number only)", r.status === 404 || r.status === 405, String(r.status));
r = await usman.req("POST", "/api/site/member/ads", adBody({ registeredIn: "Islamabad", sellerName: "Usman", sellerPhone: "0312-1000001" }));
check("after identity, individual can post", r.status === 201, r.data.error);
const usmanAd = r.data.ad;
await admin.req("POST", `/api/shop/classifieds/${usmanAd?._id}`, { action: "approve" });
page = await new Client("p").html(`/cars/${usmanAd?._id}`);
check("public page never shows CNIC, legal address or last digits", !page.includes("1234567") && !page.includes("Sector F-8") && !page.includes("61101"));
r = await new Client("p").req("GET", "/api/site/cars?type=car&seller=private");
check("public API never carries identity data", !JSON.stringify(r.data).includes("1234567") && !JSON.stringify(r.data).includes("kyc"));
r = await usman.req("POST", "/api/site/supplier/products", { title: "Brake pads", category: "Brakes", price: 1000, images: [img], universal: true });
check("individual cannot list parts", r.status === 403, r.data.error);

/* ------------------------------------------------- staff identity review */
const usmanId = (await usman.req("GET", "/api/site/member/me")).data.member?._id;
r = await rep.req("GET", `/api/shop/partners/${usmanId}/identity`);
check("non-admin staff cannot open a CNIC", r.status === 403);
r = await admin.req("GET", `/api/shop/partners/${usmanId}/identity`);
check("admin can open the full CNIC (logged)", r.data.cnic === "61101-1234567-9" && r.data.address?.includes("F-8"), JSON.stringify(r.data));
r = await new Client("anon").req("GET", `/api/shop/partners/${usmanId}/identity`);
check("anonymous cannot", r.status === 401);
r = await admin.req("GET", "/api/shop/partners?kyc=pending&business=pending");
check("review queue lists pending identities with masked CNIC", r.data.members?.some((m) => m._id === usmanId && !m.kyc.cnic.includes("1234567")) && r.data.counts?.kycPending >= 1);
r = await admin.req("GET", "/api/shop/partners");
check("NADRA verification is off by default", r.data.nadra === false && !r.data.members?.some((m) => m.kyc?.nadra));
r = await admin.req("POST", `/api/shop/partners/${usmanId}/nadra`);
check("NADRA check refused while switched off", r.status === 403, r.data.error);
r = await admin.req("POST", `/api/shop/partners/${usmanId}`, { target: "kyc", decision: "verified" });
check("admin verifies identity", r.status === 200, r.data.error);
r = await kyc(usman, "Someone Else", "61101-7654321-1");
check("verified identity cannot be swapped by the member", r.status === 409);

/* ------------------------------------------------- dealer */
const dealer = await register("Kamran Motors Owner", "0313-2000001");
await kyc(dealer, "Kamran Ali", "37405-1112223-5", "Rawalpindi");
r = await dealer.req("POST", "/api/site/partner/business", { type: "dealer", name: "Kamran Motors", address: "Plot 4, Murree Road, Committee Chowk", city: "Narnia", phone: "051-5551234" });
check("unknown city refused", r.status === 400, r.data.error);
r = await dealer.req("POST", "/api/site/partner/business", { type: "dealer", name: "Kamran Motors", address: "Plot 4, Murree Road, Committee Chowk", city: "Rawalpindi", phone: "051-5551234", whatsapp: "0313-2000001", ntn: "1234567-8" });
check("dealership registered → pending", r.data.business?.status === "pending" && r.data.accountType === "dealer", r.data.error);
r = await dealer.req("POST", "/api/site/member/ads", adBody({ city: "Rawalpindi" }));
check("dealer cannot list until approved", r.status === 403 && /review/.test(r.data.error || ""), r.data.error);
const dealerId = (await dealer.req("GET", "/api/site/member/me")).data.member?._id;
r = await dealer.req("GET", "/api/site/partner/certificate");
check("no certificate before approval", r.status === 403, r.data.error);
r = await admin.req("POST", `/api/shop/partners/${dealerId}`, { target: "business", decision: "approved" });
check("business cannot be approved before identity is verified", r.status === 400, r.data.error);
await admin.req("POST", `/api/shop/partners/${dealerId}`, { target: "kyc", decision: "verified" });
r = await rep.req("POST", `/api/shop/partners/${dealerId}`, { target: "business", decision: "approved" });
check("only admins approve businesses", r.status === 403);
r = await admin.req("POST", `/api/shop/partners/${dealerId}`, { target: "business", decision: "approved" });
check("admin approves dealership", r.status === 200, r.data.error);
r = await dealer.req("GET", "/api/site/partner");
const certNo = r.data.business?.certNo;
check("approval issues a certificate number automatically", /^CR-\d{4}-\d{5}$/.test(certNo || ""), certNo);
check("certificate not yet downloaded (the account page will download it by itself)", !r.data.business?.certDownloadedAt);
const certRes = await dealer.req("GET", "/api/site/partner/certificate", undefined, { raw: true });
const certBytes = Buffer.from(await certRes.arrayBuffer());
check("dealer downloads the certificate as a PDF file", certRes.status === 200 && /application\/pdf/.test(certRes.headers.get("content-type") || "") && /attachment; filename="Certificate-CR-/.test(certRes.headers.get("content-disposition") || "") && certBytes.subarray(0, 5).toString() === "%PDF-" && certBytes.length > 3000, `${certRes.status} ${certBytes.length} bytes`);
const certText = certBytes.toString("latin1");
check("certificate PDF carries no CNIC or home address", !certText.includes("37405") && !certText.includes("1112223") && !certText.includes("Kamran Ali"));
r = await dealer.req("GET", "/api/site/partner");
check("download is recorded", Boolean(r.data.business?.certDownloadedAt));
r = await dealer.req("GET", "/api/site/partner");
page = await new Client("v").html(`/verify/${certNo}`);
check("QR page: genuine and active, shows the business", page.includes("Genuine and active") && page.includes("Kamran Motors") && page.includes("Rawalpindi"));
check("QR page never shows the owner's identity", !page.includes("37405") && !page.includes("Kamran Ali"));
page = await new Client("v").html("/verify/CR-2026-99999");
check("fake certificate number → not found warning", page.includes("Not found") && page.includes("may be fake"));
page = await new Client("v").html("/verify/not-a-number");
check("malformed number is handled", page.includes("Not found"));
r = await new Client("anon").req("GET", "/api/site/partner/certificate");
check("anonymous cannot download", r.status === 401);
r = await usman.req("GET", "/api/site/partner/certificate");
check("an individual seller has no business certificate", r.status === 403, r.data.error);
const second = await dealer.req("POST", `/api/shop/partners/${dealerId}`, { target: "business", decision: "approved" });
r = await dealer.req("GET", "/api/site/partner");
check("approving again keeps the same certificate number", r.data.business?.certNo === certNo, r.data.business?.certNo);
const dealerAds = [];
for (let i = 0; i < 6; i++) {
  r = await dealer.req("POST", "/api/site/member/ads", adBody({ make: "Honda", model: "Civic", year: 2016 + i, listPrice: 4000000 + i * 250000, city: "Rawalpindi", registeredIn: i % 2 ? "Islamabad" : "Lahore", sellerName: "Kamran Motors", sellerPhone: "051-5551234" }));
  dealerAds.push(r);
}
check("dealer lists more cars than an individual's limit (6 > 5)", dealerAds.every((x) => x.status === 201), dealerAds.map((x) => x.status).join(","));
check("approved, verified dealer's stock goes live at once", dealerAds.every((x) => x.data.ad?.status === "active"), dealerAds.map((x) => x.data.ad?.status).join(","));
r = await new Client("p").req("GET", `/api/site/cars/batch?ids=${dealerAds[0].data.ad?._id}`);
check("dealer listings carry the dealership card", r.data.listings?.[0]?.seller?.business?.name === "Kamran Motors" && r.data.listings[0].seller.business.verified === true, JSON.stringify(r.data.listings?.[0]?.seller));
const slug = r.data.listings?.[0]?.seller?.business?.slug;
page = await new Client("p").html(`/dealers/${slug}`);
check("dealer page shows their stock and contact", page.includes("Kamran Motors") && page.includes("6 vehicles in stock") && page.includes("051-5551234"));
check("dealer page shows no owner identity", !page.includes("37405") && !page.includes("Kamran Ali"));
page = await new Client("p").html("/dealers?city=Rawalpindi");
check("dealer directory by city", page.includes("Kamran Motors"));
r = await dealer.req("POST", "/api/site/supplier/products", { title: "Brake pads", category: "Brakes", price: 1000, images: [img], universal: true });
check("dealer cannot list parts", r.status === 403);

/* ------------------------------------------------- supplier + parts by vehicle */
const sup = await register("Spare Parts Owner", "0314-3000001");
await kyc(sup, "Imran Shah", "35201-9998887-1", "Lahore");
r = await sup.req("POST", "/api/site/partner/business", { type: "supplier", name: "Imran Auto Parts", address: "Shop 12, McLeod Road, Lahore", city: "Lahore", phone: "042-37001122", categories: ["Brakes", "Engine Oil", "Filters"] });
check("supplier registered → pending", r.data.business?.status === "pending" && r.data.accountType === "supplier", r.data.error);
r = await sup.req("POST", "/api/site/supplier/products", { title: "Brake pads front", category: "Brakes", price: 4500, images: [img], fitments: [{ make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2020 }] });
check("supplier cannot list until approved", r.status === 403, r.data.error);
const supId = (await sup.req("GET", "/api/site/member/me")).data.member?._id;
await admin.req("POST", `/api/shop/partners/${supId}`, { target: "kyc", decision: "verified" });
await admin.req("POST", `/api/shop/partners/${supId}`, { target: "business", decision: "approved" });
r = await sup.req("POST", "/api/site/supplier/products", { title: "Brake pads front", category: "Brakes", price: 4500, images: [img], fitments: [] });
check("a part must say what it fits (or be universal)", r.status === 400, r.data.error);
r = await sup.req("POST", "/api/site/supplier/products", { title: "Brake pads front", category: "Brakes", price: 4500, images: [img], fitments: [{ make: "Toyota", model: "Corolla", yearFrom: 2020, yearTo: 2014 }] });
check("back-to-front year range refused", r.status === 400, r.data.error);
const pads = (await sup.req("POST", "/api/site/supplier/products", { title: "Brake pads front — Corolla", category: "Brakes", price: 4500, images: [img], partNumber: "04465-02220", fitments: [{ make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2020 }] })).data.product;
const civicFilter = (await sup.req("POST", "/api/site/supplier/products", { title: "Oil filter — Civic", category: "Filters", price: 1200, images: [img], fitments: [{ make: "Honda", model: "Civic", yearFrom: 2016 }] })).data.product;
const toyotaAll = (await sup.req("POST", "/api/site/supplier/products", { title: "Wiper blades — any Toyota", category: "Exterior Accessories", price: 2200, images: [img], fitments: [{ make: "Toyota" }] })).data.product;
const oil = (await sup.req("POST", "/api/site/supplier/products", { title: "Engine oil 5W-30 4L", category: "Engine Oil", price: 7800, images: [img], universal: true })).data.product;
check("supplier lists 4 products", [pads, civicFilter, toyotaAll, oil].every((p) => p?._id));
const ids = (res) => (res.data.parts || []).map((p) => p._id).sort().join(",");
r = await new Client("b").req("GET", "/api/site/parts?kind=car&make=Toyota&model=Corolla&year=2018");
check("Corolla 2018: only parts that fit (pads + any-Toyota wipers), no oil, no Civic part", ids(r) === [pads._id, toyotaAll._id].sort().join(","), (r.data.parts || []).map((p) => p.title).join(" | "));
r = await new Client("b").req("GET", "/api/site/parts?kind=car&make=Toyota&model=Corolla&year=2022");
check("Corolla 2022: pads (2014–2020) excluded", ids(r) === toyotaAll._id, (r.data.parts || []).map((p) => p.title).join(" | "));
r = await new Client("b").req("GET", "/api/site/parts?kind=car&make=toyota&model=corolla&year=2018&universal=1");
check("asking for universal items adds the oil (case-insensitive make/model)", ids(r) === [pads._id, toyotaAll._id, oil._id].sort().join(","), (r.data.parts || []).map((p) => p.title).join(" | "));
r = await new Client("b").req("GET", "/api/site/parts?kind=car&make=Honda&model=Civic&year=2015");
check("Civic 2015: filter is for 2016+ → nothing", r.data.parts?.length === 0, (r.data.parts || []).map((p) => p.title).join(" | "));
r = await new Client("b").req("GET", "/api/site/parts");
check("no vehicle chosen → everything", r.data.total === 4, `total=${r.data.total}`);
page = await new Client("b").html("/shop?kind=car&make=Toyota&model=Corolla&year=2018");
check("shop page: 'parts that fit Toyota Corolla 2018' with supplier section", page.includes("Showing only parts that fit") && page.includes("Brake pads front — Corolla") && !page.includes("Oil filter — Civic"));
r = await new Client("b").req("POST", `/api/site/parts/${pads._id}`, { name: "Hassan", phone: "0315-4000001", message: "Corolla 2018 GLi, need 2 sets" });
check("buyer messages the supplier", r.status === 200, r.data.error);
r = await sup.req("GET", "/api/site/supplier/products");
check("supplier sees the message", r.data.products?.find((p) => p._id === pads._id)?.messages?.[0]?.name === "Hassan");
page = await new Client("b").html(`/parts/${pads._id}`);
check("part page shows fitment, supplier, no owner identity", page.includes("Toyota Corolla 2014–2020") && page.includes("Imran Auto Parts") && !page.includes("Imran Shah") && !page.includes("35201"));
r = await admin.req("POST", `/api/shop/supplier-products/${civicFilter._id}`, { status: "hidden", note: "Wrong photo" });
r = await new Client("b").req("GET", "/api/site/parts");
check("staff can hide a product", r.data.total === 3, `total=${r.data.total}`);
const supCert = (await sup.req("GET", "/api/site/partner")).data.business?.certNo;
check("suppliers get a certificate too", /^CR-/.test(supCert || ""), supCert);
await admin.req("POST", `/api/shop/partners/${supId}`, { target: "business", decision: "suspended", note: "Complaints" });
page = await new Client("v").html(`/verify/${supCert}`);
check("suspended business: certificate shows as no longer active", page.includes("no longer active") && !page.includes("Genuine and active"));
r = await sup.req("GET", "/api/site/partner/certificate");
check("suspended business cannot download", r.status === 403, r.data.error);
r = await new Client("b").req("GET", "/api/site/parts");
check("suspending a supplier hides all their products", r.data.total === 0, `total=${r.data.total}`);
await admin.req("POST", `/api/shop/partners/${supId}`, { target: "business", decision: "approved" });
r = await sup.req("POST", "/api/site/member/ads", adBody());
check("supplier account cannot post a vehicle ad", r.status === 403);

// The store's own products filter by vehicle too.
const shopProducts = (await admin.req("GET", "/api/shop")).data.products || [];
const helmet = shopProducts.find((p) => /Helmet/.test(p.name));
const oilItem = shopProducts.find((p) => /Shell/.test(p.name));
r = await admin.req("PUT", `/api/shop/products/${oilItem?._id}`, { ...oilItem.shop, fitments: [{ make: "Honda", model: "City", yearFrom: 2009 }] });
check("store product gets a fitment", r.status === 200, r.data.error);
r = await new Client("b").req("GET", "/api/site/shop/products?make=Honda&model=City&year=2020");
check("store search for Honda City shows the fitted product only", r.data.products?.length === 1 && r.data.products[0]._id === oilItem._id, (r.data.products || []).map((p) => p.title).join(" | "));
r = await new Client("b").req("GET", "/api/site/shop/products?make=Toyota&model=Corolla&year=2020");
check("…and not for a Corolla", !(r.data.products || []).some((p) => p._id === oilItem._id), (r.data.products || []).map((p) => p.title).join(" | "));
r = await new Client("b").req("GET", "/api/site/shop/products?make=Toyota&model=Corolla&universal=1");
check("universal store items appear only when asked", (r.data.products || []).some((p) => p._id === helmet?._id) || !helmet, (r.data.products || []).map((p) => p.title).join(" | "));

/* ------------------------------------------------- city-first search */
const isl = new Client("isl");
isl.cookies.am_city = "Islamabad";
page = await isl.html("/cars?make=Toyota&model=Corolla");
check("buyer in Islamabad sees Islamabad cars first", page.includes("📍 Islamabad") && page.includes("(your city)") && page.includes("All Pakistan"));
page = await isl.html("/cars?make=Honda&model=Civic");
check("no Civic in Islamabad → all Pakistan shown, with per-city counts", page.includes("None in Islamabad yet") && /Rawalpindi <b>6<\/b>/.test(page) && /[1-9]\d* cars found/.test(page));
r = await new Client("api").req("GET", "/api/site/cars?type=car&make=Honda&model=Civic&city=Rawalpindi");
check("Rawalpindi count matches the dealer's 6 Civics", r.data.total === 6, `total=${r.data.total}`);
page = await isl.html("/cars?make=Honda&model=Civic&city=all");
check("'All Pakistan' overrides the remembered city", page.includes("📍 All Pakistan"));
r = await new Client("api").req("GET", "/api/site/cars?type=car&make=Honda&model=Civic&regCity=Islamabad");
check("search by number-plate city (registered in Islamabad)", r.data.total === 3, `total=${r.data.total}`);
page = await isl.html("/cars?make=Honda&model=Civic&city=all");
check("registration-city counts shown", /Registered in:/.test(page) && /Lahore <b>3<\/b>/.test(page));
r = await new Client("api").req("GET", `/api/site/cars?ask=${encodeURIComponent("civic in rawalpindi")}`);
check("plain-word search picks up any catalogue city", r.data.total === 6, `total=${r.data.total}`);

/* ------------------------------------------------- pages */
for (const p of ["/register", "/register?type=dealer", "/register?type=supplier", "/dealers", "/suppliers", `/suppliers/${(await sup.req("GET", "/api/site/partner")).data.business?.slug}`, "/shop?kind=bike&make=Honda&model=CD%2070"]) {
  const res = await new Client("pg").req("GET", p, undefined, { raw: true });
  check(`page ${p} renders`, res.status === 200, String(res.status));
}
for (const p of ["/dealership?tab=partners", "/ecommerce?tab=suppliers"]) {
  const res = await admin.req("GET", p, undefined, { raw: true });
  check(`staff page ${p} renders`, res.status === 200, String(res.status));
}
