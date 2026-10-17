/**
 * End-to-end check of the marketplace: shop, orders, stock, bikes, public ads,
 * member accounts and security rules, driven through the real HTTP API.
 *
 *   1. Start the app against an EMPTY throwaway database whose name ends in _test:
 *        MONGODB_URI=mongodb://localhost:27017/sabaq_test npm run dev
 *   2. In another terminal:  npm run test:e2e
 *      (E2E_BASE_URL defaults to http://localhost:3000)
 *
 * It creates an admin (admin@test.pk / secret123) and sample data, so never
 * point it at a real database. Restart the dev server between runs: the public
 * rate limiter keeps per-IP counters in memory.
 */
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
let pass = 0, fail = 0;
const results = [];
process.on("exit", () => { console.log(results.join("\n")); console.log(`\n${pass} passed, ${fail} failed`); });
function check(name, ok, detail = "") {
  ok ? pass++ : fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

class Client {
  /** `ip` simulates a distinct visitor for the per-IP rate limiter (sent as X-Real-IP). */
  constructor(name, ip) { this.name = name; this.cookies = {}; this.ip = ip; }
  async req(method, path, body, { form, raw } = {}) {
    const headers = { cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (this.ip) headers["x-real-ip"] = this.ip;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";"); const [k, ...v] = pair.split("=");
      if (v.join("=") === "" || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) delete this.cookies[k]; else this.cookies[k] = v.join("=");
    }
    if (raw) return res;
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}

const staff = new Client("staff");
const shopper = new Client("shopper");
const seller = new Client("seller");
const buyer = new Client("buyer");

// ---------- staff setup
let r = await staff.req("GET", "/api/auth/setup");
check("fresh install needs setup", r.data.needsSetup === true, JSON.stringify(r.data));
r = await staff.req("POST", "/api/auth/setup", { businessName: "Test Motors", name: "Admin User", email: "admin@test.pk", password: "secret123" });
check("owner setup", r.status === 201, `${r.status} ${r.data.error || ""}`);
r = await new Client("late").req("POST", "/api/auth/setup", { businessName: "Hijack", name: "Xavier", email: "x@x.pk", password: "secret123" });
check("setup cannot run twice", r.status === 409, `${r.status} ${r.data.error || ""}`);
r = await staff.req("POST", "/api/auth/login", { email: "admin@test.pk", password: "secret123" });
check("admin login", r.status === 200 && Object.keys(staff.cookies).length > 0, `${r.status} ${r.data.error || ""}`);

// ---------- shop: create inventory items + list them
const oil = await staff.req("POST", "/api/inventory", { sku: "OIL-HX7-4L", name: "Shell Helix HX7 10W-40 4L", category: "Lubricants", unit: "pcs", quantity: 3, salePrice: 6500, unitCost: 5200, branchCode: "MAIN" });
check("create inventory item (oil, qty 3)", oil.status === 201, `${oil.status} ${oil.data.error || ""}`);
const helmet = await staff.req("POST", "/api/inventory", { sku: "HLM-VEGA-M", name: "Vega Off-road Helmet M", category: "Gear", unit: "pcs", quantity: 5, salePrice: 9000, unitCost: 7000, branchCode: "MAIN" });
const oilId = oil.data.item?._id, helmetId = helmet.data.item?._id;

// image upload (staff): 1x1 PNG, then a fake "png" that is really text
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "tiny.png");
const up = await staff.req("POST", "/api/uploads/image", undefined, { form: fd });
check("staff image upload (real PNG)", up.status === 201 && /^\/uploads\/images\/.+\.png$/.test(up.data.url || ""), up.data.url || up.data.error);
fd = new FormData(); fd.append("file", new Blob([Buffer.from("<?php echo 1; ?>")], { type: "image/png" }), "evil.png");
r = await staff.req("POST", "/api/uploads/image", undefined, { form: fd });
check("upload rejects non-image disguised as .png", r.status === 400, `${r.status} ${r.data.error || ""}`);
const img = up.data.url;
r = await shopper.req("GET", img, undefined, { raw: true });
check("uploaded image is served publicly", r.status === 200, String(r.status));

r = await staff.req("PUT", `/api/shop/products/${oilId}`, { published: true, title: "Shell Helix HX7 10W-40 (4L)", brand: "Shell", shopCategory: "Engine Oil & Lubricants", fit: "car", images: [img], compareAtPrice: 7200, featured: true, tags: ["10w40"], fitment: "Most petrol cars" });
check("publish oil in shop", r.status === 200 && r.data.shop?.slug, r.data.shop?.slug || r.data.error);
const oilSlug = r.data.shop?.slug;
r = await staff.req("PUT", `/api/shop/products/${helmetId}`, { published: true, brand: "Vega", shopCategory: "Helmets & Riding Gear", fit: "bike", images: [], featured: false, tags: [] });
check("publishing without photo is refused", r.status === 400, r.data.error);
r = await staff.req("PUT", `/api/shop/products/${helmetId}`, { published: true, brand: "Vega", shopCategory: "Helmets & Riding Gear", fit: "bike", images: [img], featured: false, tags: [] });
check("publish helmet", r.status === 200);

// ---------- public catalogue
r = await shopper.req("GET", "/api/site/shop/products");
check("public catalogue lists 2 products", r.data.total === 2, `total=${r.data.total}`);
check("catalogue hides unit cost", !JSON.stringify(r.data).includes("5200"), "");
r = await shopper.req("GET", "/api/site/shop/products?fit=bike");
check("filter fit=bike → helmet only", r.data.total === 1 && r.data.products[0].title.includes("Helmet"), `total=${r.data.total}`);
r = await shopper.req("GET", "/api/site/shop/products?q=10w40");
check("search by tag", r.data.total === 1, `total=${r.data.total}`);
r = await shopper.req("GET", `/api/site/shop/products/${oilSlug}`);
check("product detail by slug", r.status === 200 && r.data.product.available === 3, `available=${r.data.product?.available}`);

// ---------- checkout rules
r = await staff.req("PUT", "/api/shop", { enabled: true, classifiedsEnabled: true, fulfilmentBranch: "MAIN", deliveryFee: 250, freeDeliveryOver: 20000, codEnabled: true, bankTransferEnabled: false, moderateAds: true });
check("admin updates shop settings", r.status === 200, r.data.error);
const quote = await shopper.req("POST", "/api/site/shop/quote", { items: [{ productId: oilId, qty: 2 }] });
check("quote: 2×6500 + 250 delivery = 13250", quote.data.quote?.total === 13250, JSON.stringify(quote.data.quote));
const order = { customerName: "Ali Khan", phone: "0300-1234567", address: "House 12, Street 4, DHA Phase 5", city: "Lahore", paymentMethod: "cod" };
r = await shopper.req("POST", "/api/site/shop/checkout", { ...order, items: [{ productId: oilId, qty: 2 }], expectedTotal: 999 });
check("checkout refuses stale total", r.status === 409, r.data.error);
r = await shopper.req("POST", "/api/site/shop/checkout", { ...order, items: [{ productId: oilId, qty: 5 }], expectedTotal: 32750 });
check("checkout refuses more than stock", r.status === 409, r.data.error);
r = await shopper.req("POST", "/api/site/shop/checkout", { ...order, items: [{ productId: oilId, qty: 2 }], expectedTotal: 13250, website: "spam" });
check("honeypot blocks bots", r.status === 400, r.data.error);
const placed = await shopper.req("POST", "/api/site/shop/checkout", { ...order, items: [{ productId: oilId, qty: 2 }], expectedTotal: 13250 });
check("checkout OK → SO number", placed.status === 201 && /^SO-\d{4}-\d{5}$/.test(placed.data.number || ""), placed.data.number || placed.data.error);
r = await shopper.req("POST", "/api/site/shop/track", { number: placed.data.number, phone: "+92 300 1234567" });
check("track order with phone in other format", r.status === 200 && r.data.order?.status === "pending", r.data.error || r.data.order?.status);
r = await shopper.req("POST", "/api/site/shop/track", { number: placed.data.number, phone: "03009999999" });
check("track refuses wrong phone", r.status === 404);

// second order that will exceed stock once the first is confirmed
const placed2 = await shopper.req("POST", "/api/site/shop/checkout", { ...order, customerName: "Sara", phone: "03211111111", items: [{ productId: oilId, qty: 2 }], expectedTotal: 13250 });

// ---------- staff fulfilment
let ov = await staff.req("GET", "/api/shop?status=pending");
const o1 = ov.data.orders?.find((o) => o.number === placed.data.number);
const o2 = ov.data.orders?.find((o) => o.number === placed2.data.number);
check("staff sees 2 pending orders", ov.data.counts?.pending === 2, JSON.stringify(ov.data.counts));
r = await staff.req("POST", `/api/shop/orders/${o1._id}`, { action: "dispatch", courier: "TCS", trackingNumber: "X1" });
check("cannot dispatch before confirm", r.status === 409, r.data.error);
r = await staff.req("POST", `/api/shop/orders/${o1._id}`, { action: "confirm" });
check("confirm order 1 → stock voucher posted", r.status === 200 && r.data.order?.stockVoucherNumber, r.data.order?.stockVoucherNumber || r.data.error);
const stock = async () => (await staff.req("GET", "/api/shop")).data.products?.find((p) => p._id === oilId)?.available;
check("stock went 3 → 1", (await stock()) === 1, `qty=${await stock()}`);
r = await staff.req("POST", `/api/shop/orders/${o2._id}`, { action: "confirm" });
check("confirm order 2 refused (only 1 left)", r.status === 400 || r.status === 409, r.data.error);
r = await staff.req("POST", `/api/shop/orders/${o1._id}`, { action: "dispatch", courier: "TCS", trackingNumber: "TCS-778899" });
check("dispatch", r.data.order?.status === "dispatched");
r = await staff.req("POST", `/api/shop/orders/${o1._id}`, { action: "deliver" });
check("deliver COD → paid", r.data.order?.status === "delivered" && r.data.order?.paymentStatus === "paid", `${r.data.order?.status}/${r.data.order?.paymentStatus}`);
r = await staff.req("POST", `/api/shop/orders/${o1._id}`, { action: "return", reason: "Wrong grade" });
check("return delivered order", r.data.order?.status === "returned", r.data.error || r.data.order?.status);
check("stock back to 3 after return", (await stock()) === 3, `qty=${await stock()}`);
r = await staff.req("POST", `/api/shop/orders/${o2._id}`, { action: "confirm" });
check("order 2 confirms now", r.status === 200, r.data.error);
r = await staff.req("POST", `/api/shop/orders/${o2._id}`, { action: "cancel", reason: "Customer changed mind" });
check("cancel confirmed order (admin) voids voucher", r.data.order?.status === "cancelled", r.data.error);
check("stock restored to 3 after cancel", (await stock()) === 3, `qty=${await stock()}`);

// ---------- coupons
r = await staff.req("POST", "/api/shop/coupons", { code: "eid10", description: "Eid sale", kind: "percent", value: 10, minSubtotal: 5000, maxDiscount: 1000, usageLimit: 1, perPhoneLimit: 1, active: true });
check("admin creates coupon (code upper-cased)", r.status === 201 && r.data.coupon?.code === "EID10", r.data.error);
r = await staff.req("POST", "/api/shop/coupons", { code: "BAD", kind: "percent", value: 150 });
check("coupon over 100% refused", r.status === 400, r.data.error);
const cBuyer = new Client("coupon-buyer", "10.0.0.21");
await staff.req("POST", "/api/shop/coupons", { code: "BIG50", kind: "fixed", value: 500, minSubtotal: 50000, active: true });
r = await cBuyer.req("POST", "/api/site/shop/quote", { items: [{ productId: oilId, qty: 1 }], couponCode: "big50" });
check("coupon below minimum is explained", /Add PKR 43,500 more/.test(r.data.coupon?.error || "") && r.data.quote?.discount === 0, r.data.coupon?.error);
r = await cBuyer.req("POST", "/api/site/shop/quote", { items: [{ productId: oilId, qty: 2 }], couponCode: "nope" });
check("unknown coupon rejected", /not valid/.test(r.data.coupon?.error || ""), r.data.coupon?.error);
r = await cBuyer.req("POST", "/api/site/shop/quote", { items: [{ productId: oilId, qty: 2 }], couponCode: "eid10" });
check("coupon: 10% of 13,000 capped at 1,000; 12,000 + 250 delivery", r.data.quote?.discount === 1000 && r.data.quote?.total === 12250, JSON.stringify(r.data.quote));
const couponOrder = await cBuyer.req("POST", "/api/site/shop/checkout", { ...order, phone: "03007770001", items: [{ productId: oilId, qty: 2 }], couponCode: "EID10", expectedTotal: 12250 });
check("checkout with coupon", couponOrder.status === 201 && couponOrder.data.total === 12250, couponOrder.data.error || couponOrder.data.total);
const cBuyer2 = new Client("coupon-buyer-2", "10.0.0.22");
r = await cBuyer2.req("POST", "/api/site/shop/checkout", { ...order, phone: "03007770002", items: [{ productId: oilId, qty: 1 }, { productId: helmetId, qty: 1 }], couponCode: "EID10", expectedTotal: 14750 });
check("usage limit 1: second customer refused", r.status === 400 && /fully used/.test(r.data.error || ""), r.data.error);
ov = await staff.req("GET", "/api/shop?status=pending");
const cOrder = ov.data.orders?.find((o) => o.number === couponOrder.data.number);
r = await staff.req("POST", `/api/shop/orders/${cOrder?._id}`, { action: "confirm" });
check("confirm coupon order (voucher net of discount)", r.status === 200 && r.data.order?.discount === 1000, r.data.error);
r = await staff.req("POST", `/api/shop/orders/${cOrder?._id}`, { action: "cancel", reason: "Customer cancelled" });
check("cancel coupon order", r.data.order?.status === "cancelled", r.data.error);
r = await staff.req("GET", "/api/shop/coupons");
check("cancel gives the coupon use back", r.data.coupons?.find((c) => c.code === "EID10")?.usedCount === 0, JSON.stringify(r.data.coupons?.map((c) => c.usedCount)));
check("stock restored after coupon order cancel", (await stock()) === 3, `qty=${await stock()}`);

// ---------- CSV export
let csv = await staff.req("GET", "/api/export/orders", undefined, { raw: true });
let csvText = await csv.text();
check("orders CSV download", csv.status === 200 && /text\/csv/.test(csv.headers.get("content-type") || "") && csvText.includes("Order,Date,Status"), `${csv.status} ${csv.headers.get("content-type")}`);
check("orders CSV contains coupon order", csvText.includes(couponOrder.data.number) && csvText.includes("EID10"));
csv = await new Client("anon-csv").req("GET", "/api/export/orders", undefined, { raw: true });
check("anonymous cannot export", csv.status === 401, String(csv.status));

// ---------- members + classifieds
r = await seller.req("POST", "/api/site/member/register", { name: "Bilal Ahmed", phone: "0333-5556666", password: "short" });
check("register: password min 8", r.status === 400, r.data.error);
r = await seller.req("POST", "/api/site/member/register", { name: "Bilal Ahmed", phone: "0333-5556666", password: "goodpass123", city: "Karachi" });
check("register seller", r.status === 201 && seller.cookies.market_member, r.data.error || "");
r = await new Client("x").req("POST", "/api/site/member/register", { name: "Dup", phone: "+923335556666", password: "goodpass123" });
check("duplicate phone (different format) refused", r.status === 409, r.data.error);
r = await seller.req("POST", "/api/site/partner/kyc", { legalName: "Bilal Ahmed", cnic: "42101-1234567-1", address: "House 4, Block 2, Gulshan-e-Iqbal", city: "Karachi", consent: true });
check("seller gives identity (CNIC) before selling", r.status === 200 && r.data.kyc?.status === "pending", r.data.error);

// security: member token must not work as staff session
const forged = new Client("forged"); forged.cookies.am_session = seller.cookies.market_member;
r = await forged.req("GET", "/api/shop");
check("member token rejected on staff API", r.status === 401, String(r.status));
r = await forged.req("GET", "/api/settings");
check("member token rejected on any-role staff API", r.status === 401, String(r.status));
r = await new Client("anon").req("GET", "/api/shop");
check("anonymous cannot read shop admin", r.status === 401);

fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "car.png");
const sup = await seller.req("POST", "/api/site/member/upload", undefined, { form: fd });
check("member photo upload", sup.status === 201, sup.data.error || sup.data.url);
r = await new Client("anon").req("POST", "/api/site/member/upload", undefined, { form: fd });
check("anonymous upload refused", r.status === 401);

const ad = { vehicleType: "bike", make: "Honda", model: "CG 125", variant: "Self Start", year: 2022, mileage: 18000, engineCc: 125, fuel: "Petrol", bodyType: "Standard", condition: "used", city: "Karachi", listPrice: 285000, negotiable: true, description: "Genuine condition", photos: [sup.data.url], features: ["Self start", "Front disc brake"], specs: { startType: "Self start", stroke: "4-stroke", ownership: "First owner", seats: 5, hack: "x" }, sellerName: "Bilal", sellerPhone: "0333-5556666", showPhone: true };
r = await seller.req("POST", "/api/site/member/ads", { ...ad, photos: [] });
check("ad needs a photo", r.status === 400, r.data.error);
r = await seller.req("POST", "/api/site/member/ads", { ...ad, photos: ["javascript:alert(1)"] });
check("ad rejects unsafe photo URL", r.status === 400, r.data.error);
const adRes = await seller.req("POST", "/api/site/member/ads", ad);
check("post bike ad → pending review", adRes.status === 201 && adRes.data.ad?.status === "pending", adRes.data.error || adRes.data.ad?.status);
const adId = adRes.data.ad?._id;
r = await buyer.req("GET", "/api/site/cars?type=bike&seller=private");
check("pending ad not public", r.data.total === 0, `total=${r.data.total}`);
r = await staff.req("GET", "/api/shop/classifieds?status=pending");
check("staff review queue has the ad", r.data.ads?.some((a) => a._id === adId));
r = await staff.req("POST", `/api/shop/classifieds/${adId}`, { action: "approve" });
check("approve ad", r.data.ad?.status === "active", r.data.error);
r = await buyer.req("GET", "/api/site/cars?type=bike&seller=private");
const pubAd = r.data.listings?.[0];
check("bike ad specs saved; car-only & unknown keys dropped", pubAd?.specs?.startType === "Self start" && pubAd?.specs?.ownership === "First owner" && pubAd?.specs?.seats === undefined && pubAd?.specs?.hack === undefined, JSON.stringify(pubAd?.specs));

// dealer bike + car in stock to test the merged search
r = await staff.req("POST", "/api/dealership/vehicles", { vehicleType: "bike", make: "Yamaha", model: "YBR 125", year: 2023, mileage: 5000, condition: "used", status: "in_stock", purchaseCost: 300000, listPrice: 360000, floorPrice: 0, published: true, photos: [img], features: [], city: "Lahore" });
check("dealer bike published", r.status === 201, r.data.error);
r = await staff.req("POST", "/api/dealership/vehicles", { make: "Toyota", model: "Corolla", year: 2020, mileage: 60000, condition: "used", status: "in_stock", purchaseCost: 4500000, listPrice: 5200000, floorPrice: 0, published: true, photos: [img], features: [], city: "Lahore" });
check("dealer car (no vehicleType given → car)", r.status === 201 && r.data.vehicle?.vehicleType === "car", r.data.error || r.data.vehicle?.vehicleType);
const corollaId = r.data.vehicle?._id;

r = await buyer.req("GET", "/api/site/cars?type=bike");
check("bike search merges dealer + private (2)", r.data.total === 2, `total=${r.data.total} err=${r.data.error || ""}`);
const sellers = (r.data.listings || []).map((l) => l.seller.type).sort().join(",");
check("…one dealer, one private", sellers === "dealer,private", sellers);
check("bike search excludes cars", !(r.data.listings || []).some((l) => l.make === "Toyota"));
check("public listing hides dealer cost", !JSON.stringify(r.data).includes("300000"));
r = await buyer.req("GET", "/api/site/cars?type=bike&seller=private");
check("seller=private filter", r.data.total === 1 && r.data.listings?.[0]?.seller.type === "private", `total=${r.data.total}`);
r = await buyer.req("GET", "/api/site/cars?type=bike&inspected=1");
check("inspected filter drops private ads", (r.data.listings || []).every((l) => l.seller.type === "dealer"), `total=${r.data.total}`);
r = await buyer.req("GET", "/api/site/cars?type=bike&sort=price_asc");
check("price sort across both sources", r.data.listings?.[0]?.price === 285000, r.data.listings?.map((l) => l.price).join(","));
r = await buyer.req("GET", "/api/site/cars?type=car");
check("car search shows the Corolla only", r.data.total === 1 && r.data.listings?.[0]?.make === "Toyota", `total=${r.data.total}`);
r = await buyer.req("GET", "/api/site/cars?type=bike");
const makes = (r.data.facets?.makes || []).map((m) => m.value).sort().join(",");
check("bike facets list Honda,Yamaha", makes === "Honda,Yamaha", makes);

r = await buyer.req("GET", `/api/site/cars/${adId}`);
check("private ad detail", r.status === 200 && r.data.listing?.seller?.phone === "03335556666", r.data.error || r.data.listing?.seller?.phone);
check("ad detail never leaks buyer messages", !JSON.stringify(r.data).includes("messages"), "");
r = await buyer.req("POST", `/api/site/cars/${adId}`, { name: "Usman", phone: "03451234567", intent: "offer", offerPrice: 270000, message: "Cash ready" });
check("buyer messages private seller", r.status === 201 && r.data.private, r.data.error);
r = await seller.req("GET", "/api/site/member/ads");
const mine = r.data.ads?.find((a) => a._id === adId);
check("seller inbox has the offer", mine?.messages?.[0]?.offerPrice === 270000, JSON.stringify(mine?.messages?.[0] || {}));
r = await new Client("other").req("POST", "/api/site/member/register", { name: "Other", phone: "03001112222", password: "goodpass123" });
const intruder = new Client("intruder");
await intruder.req("POST", "/api/site/member/login", { phone: "03001112222", password: "goodpass123" });
r = await intruder.req("POST", `/api/site/member/ads/${adId}`, { action: "remove" });
check("another member cannot touch the ad", r.status === 404, String(r.status));
r = await seller.req("POST", `/api/site/member/ads/${adId}`, { action: "mark_sold" });
check("seller marks sold", r.data.ad?.status === "sold");
r = await buyer.req("GET", "/api/site/cars?type=bike&seller=private");
check("sold ad leaves public search", r.data.total === 0, `total=${r.data.total}`);

// ---------- batch lookup (saved / compare)
r = await buyer.req("GET", `/api/site/cars/batch?ids=${corollaId},${adId},000000000000000000000000,not-an-id`);
check("batch lookup returns the live Corolla only (sold ad + junk skipped)", r.data.listings?.length === 1 && r.data.listings[0]._id === corollaId, JSON.stringify(r.data.listings?.map((l) => l.title)));
const st = (await staff.req("GET", "/api/settings")).data.settings;
r = await staff.req("PUT", "/api/settings", { ...st, whatsapp: "0300-5551234" });
check("admin sets business WhatsApp", r.status === 200, r.data.error);
const html = await (await buyer.req("GET", `/cars/${corollaId}`, undefined, { raw: true })).text();
check("detail page has WhatsApp link to the business", html.includes("https://wa.me/923005551234?text="));
check("detail page has schema.org Car data", html.includes('"@type":"Car"') && html.includes('"priceCurrency":"PKR"'));

// ---------- race: two deals grab the same car at the same instant
r = await staff.req("POST", "/api/dealership/vehicles", { make: "Honda", model: "Civic", year: 2021, mileage: 30000, condition: "used", status: "in_stock", purchaseCost: 6000000, listPrice: 6900000, floorPrice: 0, published: false, photos: [], features: [] });
const civicId = r.data.vehicle?._id;
const raceCust = await staff.req("POST", "/api/dealership/customers", { name: "Race Buyer", phone: "03110000001", source: "walk_in", stage: "new" });
const raceCust2 = await staff.req("POST", "/api/dealership/customers", { name: "Race Buyer Two", phone: "03110000002", source: "walk_in", stage: "new" });
const race = await Promise.all([raceCust, raceCust2].map((c) =>
  staff.req("POST", "/api/dealership/deals", { customerId: c.data.customer?._id, vehicleId: civicId, salePrice: 6900000, reserve: true })
));
const winners = race.filter((x) => x.status === 201).length;
check("two simultaneous reservations: exactly one wins", winners === 1, race.map((x) => `${x.status} ${x.data.error || ""}`).join(" | "));

// ---------- full vehicle sale → accounting must balance
const cust = await staff.req("POST", "/api/dealership/customers", { name: "Kamran Ali", phone: "03219876543", source: "walk_in", stage: "new", wantsFinancing: true });
check("create dealership customer", cust.status === 201, cust.data.error);
const deal = await staff.req("POST", "/api/dealership/deals", { customerId: cust.data.customer?._id, vehicleId: corollaId, salePrice: 5200000, discount: 100000, registrationFee: 20000, commissionRate: 10, reserve: true });
check("deal created & car reserved", deal.status === 201 && deal.data.deal?.status === "reserved", deal.data.error || deal.data.deal?.status);
const dealId = deal.data.deal?._id;
r = await staff.req("POST", `/api/dealership/deals/${dealId}`, { action: "payment", payment: { amount: 1120000, method: "bank", reference: "DEP-1" } });
check("deposit received", r.status === 200 && r.data.deal?.paid === 1120000, r.data.error);
r = await staff.req("POST", `/api/dealership/deals/${dealId}`, { action: "deliver" });
check("cannot deliver before checklist & finance", r.status === 400, r.data.error);
r = await staff.req("POST", `/api/dealership/deals/${dealId}`, { action: "financing", financing: { status: "approved", lender: "Meezan Bank", amount: 4000000, downPayment: 1120000, annualRate: 18, tenureMonths: 36 } });
check("bank financing approved", r.data.deal?.financing?.status === "approved", r.data.error);
for (const step of ["eligibility", "documents", "signed"]) await staff.req("POST", `/api/dealership/deals/${dealId}`, { action: "step", step, done: true });
r = await staff.req("POST", `/api/dealership/deals/${dealId}`, { action: "deliver" });
check("deliver vehicle", r.data.deal?.status === "delivered", r.data.error);
check("gross profit 5,100,000 − 4,500,000 = 600,000", r.data.deal?.grossProfit === 600000, String(r.data.deal?.grossProfit));
check("commission 10% of gross = 60,000", r.data.deal?.commission === 60000, String(r.data.deal?.commission));
const tb = await staff.req("GET", "/api/accounting?view=trial-balance");
const row = (code) => (tb.data.rows || []).find((x) => x.code === code) || { debit: 0, credit: 0 };
check("trial balance balances", tb.status === 200 && tb.data.totalDebit === tb.data.totalCredit && tb.data.totalDebit > 0, `${tb.status} Dr ${tb.data.totalDebit} / Cr ${tb.data.totalCredit} ${tb.data.error || ""}`);
check("Vehicle Sales = 5,120,000", row("41010101").credit === 5120000, JSON.stringify(row("41010101")));
check("Cost of Vehicles Sold = 4,500,000", row("52010102").debit === 4500000, JSON.stringify(row("52010102")));
check("Customer Deposits cleared to 0", !row("21040101").debit && !row("21040101").credit, JSON.stringify(row("21040101")));
check("Vehicle Inventory = 6,300,000 (unsold bike + Civic)", row("11040101").debit === 6300000, JSON.stringify(row("11040101")));

// ---------- detailed specs & features
const pradoSpecs = { assembly: "Imported", importYear: 2021, importedFrom: "Japan", ownership: "First owner", accidentHistory: "No accident", paint: "Total genuine",
  driveType: "4WD", seats: 7, doors: 5, horsepower: 201, fuelAverageCity: 8, originalBook: true, tokenTaxPaidUpTo: 2026, keys: 2,
  seats_bad: 1, startType: "Kick start", tyreLife: 150, frontBrakes: "Rocket" };
r = await staff.req("POST", "/api/dealership/vehicles", { make: "Toyota", model: "Land Cruiser Prado", variant: "TX 2.7", year: 2018, mileage: 52000, condition: "used", status: "in_stock",
  purchaseCost: 0, listPrice: 18500000, floorPrice: 0, published: true, photos: [img], city: "Islamabad", fuel: "Petrol", transmission: "Automatic", engineCc: 2700, bodyType: "SUV",
  specs: pradoSpecs, features: ["Sunroof", "Push start", "ABS", "Rear camera", "Cruise control", "Driver airbag", "Fridge in console"] });
const prado = r.data.vehicle;
check("vehicle with detailed specs saved", r.status === 201 && prado?.specs?.assembly === "Imported" && prado?.specs?.seats === 7 && prado?.specs?.originalBook === true, `${r.status} ${r.data.error || JSON.stringify(prado?.specs)}`);
check("specs cleaned: bike-only, unknown, out-of-range and bad options dropped", prado && !("startType" in prado.specs) && !("seats_bad" in prado.specs) && !("tyreLife" in prado.specs) && !("frontBrakes" in prado.specs), JSON.stringify(prado?.specs));
const pradoPage = await (await buyer.req("GET", `/cars/${prado?._id}`, undefined, { raw: true })).text();
check("detail page shows grouped specs", ["Ownership &amp; history", "Documents &amp; registration", "Engine &amp; performance", "First owner", "4WD", "201 hp"].every((x) => pradoPage.includes(x)));
check("detail page shows grouped features + extras", pradoPage.includes("Comfort &amp; convenience") && pradoPage.includes("Fridge in console") && pradoPage.includes("Not included"));
check("detail page JSON-LD has seats & drive", pradoPage.includes('"seatingCapacity":7') && pradoPage.includes('"driveWheelConfiguration":"4WD"'));
r = await buyer.req("GET", "/api/site/cars?type=car&assembly=Imported&firstOwner=1&accidentFree=1&genuinePaint=1");
check("filter: imported, first owner, accident-free, genuine paint", r.data.total === 1 && r.data.listings[0]._id === prado?._id, `total=${r.data.total}`);
r = await buyer.req("GET", "/api/site/cars?type=car&feat=sunroof,Push%20start");
check("filter: must-have features (case-insensitive)", r.data.total === 1, `total=${r.data.total}`);
r = await buyer.req("GET", "/api/site/cars?type=car&feat=Sunroof,Navigation");
check("filter: missing feature excludes", r.data.total === 0, `total=${r.data.total}`);
r = await staff.req("POST", "/api/dealership/vehicles", { make: "Suzuki", model: "Alto", year: 2023, mileage: 9000, condition: "used", status: "in_stock", purchaseCost: 0, listPrice: 2900000, floorPrice: 0, published: true, photos: [img], city: "Lahore", specs: { assembly: "Local", ownership: "Second owner", seats: 4 }, features: ["Power steering", "Navigation"] });
const altoId = r.data.vehicle?._id;
const cmp = await (await buyer.req("GET", `/compare?ids=${prado?._id},${altoId}`, undefined, { raw: true })).text();
check("compare shows spec sections & feature matrix", cmp.includes("Ownership &amp; history") && cmp.includes("Feature by feature") && cmp.includes("Fridge in console"));
r = await staff.req("PUT", `/api/dealership/vehicles/${prado?._id}`, { ...prado, specs: { ...prado.specs, seats: 8 }, features: [...prado.features, "Navigation"] });
check("edit keeps & updates specs", r.status === 200 && r.data.vehicle?.specs?.seats === 8 && r.data.vehicle?.specs?.driveType === "4WD", `${r.status} ${r.data.error || ""}`);

// login lockout
const lock = new Client("lock");
for (let i = 0; i < 5; i++) await lock.req("POST", "/api/site/member/login", { phone: "0333-5556666", password: "wrongpass" });
r = await lock.req("POST", "/api/site/member/login", { phone: "0333-5556666", password: "goodpass123" });
check("account locks after 5 wrong passwords", r.status === 403, r.data.error);

// pages render (server components hit the DB)
const STAFF_PAGES = ["/ecommerce", "/ecommerce?tab=coupons", "/dashboard", "/dealership?tab=classifieds", "/accounting", "/inventory", "/settings"];
for (const path of ["/", "/cars", "/bikes", "/shop", `/shop/${oilSlug}`, "/shop/cart", "/shop/track", "/post-ad", "/account", "/sell-car", "/login", "/saved", `/compare?ids=${corollaId},${civicId}`, ...STAFF_PAGES]) {
  const c = STAFF_PAGES.includes(path) ? staff : buyer;
  const res = await c.req("GET", path, undefined, { raw: true });
  check(`page ${path} renders`, res.status === 200, String(res.status));
}
const sm = await buyer.req("GET", "/sitemap.xml", undefined, { raw: true });
const smText = await sm.text();
check("sitemap lists products & live vehicles, not sold ones", sm.status === 200 && smText.includes(`/shop/${oilSlug}`) && smText.includes("/bikes/") && !smText.includes(`/cars/${corollaId}`), String(sm.status));
const rb = await (await buyer.req("GET", "/robots.txt", undefined, { raw: true })).text();
check("robots.txt hides the back office", /Disallow: \/dashboard/.test(rb) && /Sitemap:/.test(rb));
const pd = await (await buyer.req("GET", `/shop/${oilSlug}`, undefined, { raw: true })).text();
check("product page has schema.org Product data", pd.includes('"@type":"Product"'));
const staffPublic = await staff.req("GET", "/cars", undefined, { raw: true });
check("signed-in staff can view /cars", staffPublic.status === 200, String(staffPublic.status));
const anonAdmin = await buyer.req("GET", "/accounting", undefined, { raw: true });
check("anonymous visitor bounced from back office", anonAdmin.status === 307 && /\/login/.test(anonAdmin.headers.get("location") || ""), `${anonAdmin.status} ${anonAdmin.headers.get("location")}`);

