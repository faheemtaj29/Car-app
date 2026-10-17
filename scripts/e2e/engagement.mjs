/**
 * End-to-end checks for the buyer-engagement features. Run after
 * marketplace.mjs against the same *_test database (it reuses the admin and
 * the shop data that script creates):
 *
 *   E2E_BASE_URL=http://localhost:3000 node scripts/e2e/engagement.mjs
 *
 * The server must run with REVIEW_MIN_ACCOUNT_HOURS=0 so fresh test accounts
 * may post reviews.
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
  constructor(name) { this.name = name; this.cookies = {}; this.ip = `10.9.0.${ipSeq++}`; }
  async req(method, path, body, { form, raw } = {}) {
    const headers = { cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "x-real-ip": this.ip };
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";"); const [k, ...v] = pair.split("=");
      if (v.join("=") === "" || /Max-Age=0/i.test(c)) delete this.cookies[k]; else this.cookies[k] = v.join("=");
    }
    if (raw) return res;
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  /** Page HTML with React's text-node separators removed, so "80,000 km" matches. */
  async html(path) { return (await (await this.req("GET", path, undefined, { raw: true })).text()).replaceAll("<!-- -->", ""); }
}

const admin = new Client("admin");
let r = await admin.req("POST", "/api/auth/login", { email: "admin@test.pk", password: "secret123" });
check("admin login", r.status === 200, r.data.error);
const shopItems = (await admin.req("GET", "/api/shop")).data.products || [];
const img = shopItems.find((p) => p.shop?.images?.[0])?.shop.images[0];
check("have an uploaded photo to reuse", Boolean(img));

const vehicle = async (v) => {
  const res = await admin.req("POST", "/api/dealership/vehicles", { condition: "used", status: "in_stock", purchaseCost: 0, floorPrice: 0, published: true, photos: [img], features: [], city: "Lahore", ...v });
  if (res.status !== 201) console.log("vehicle create failed", res.status, res.data.error);
  return res.data.vehicle;
};
const member = async (name, phone) => {
  const c = new Client(name);
  const res = await c.req("POST", "/api/site/member/register", { name, phone, password: "goodpass123", city: "Lahore" });
  check(`register ${name}`, res.status === 201, res.data.error);
  return c;
};

/* ------------------------------------------------- 1. listing history */
const civic = await vehicle({ make: "Honda", model: "Civic", variant: "Oriel", year: 2019, mileage: 80000, listPrice: 5600000, registrationNo: "LEA-19-7788", fuel: "Petrol", transmission: "Automatic", engineCc: 1800 });
const ali = await member("Ali Raza", "0301-1112233");
r = await ali.req("POST", "/api/site/partner/kyc", { legalName: "Ali Raza", cnic: "35202-7654321-3", address: "House 9, Street 3, Model Town", city: "Lahore", consent: true });
check("Ali gives identity before selling", r.status === 200, r.data.error);
const upFd = new FormData();
upFd.append("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")], { type: "image/png" }), "c.png");
const aliPhoto = (await ali.req("POST", "/api/site/member/upload", undefined, { form: upFd })).data.url;
const adBody = { vehicleType: "car", make: "Honda", model: "Civic", variant: "Oriel", year: 2019, mileage: 52000, fuel: "Petrol", transmission: "Automatic", condition: "used", city: "Lahore", listPrice: 5400000, negotiable: true, photos: [aliPhoto], features: [], sellerName: "Ali Raza", sellerPhone: "0301-1112233", showPhone: true };
r = await ali.req("POST", "/api/site/member/ads", { ...adBody, videoUrl: "https://evil.example.com/v.mp4" });
check("ad rejects non-video-site links", r.status === 400, r.data.error);
r = await ali.req("POST", "/api/site/member/ads", { ...adBody, registrationNo: "lea 19 7788", videoUrl: "https://youtu.be/dQw4w9WgXcQ" });
check("private ad with reg no + YouTube video", r.status === 201, r.data.error);
const civicAd = r.data.ad;
r = await admin.req("POST", `/api/shop/classifieds/${civicAd?._id}`, { action: "approve" });
check("approve the ad", r.data.ad?.status === "active", r.data.error);
let page = await new Client("b").html(`/cars/${civicAd?._id}`);
check("history check flags odometer rollback (80,000 → 52,000 km)", page.includes("Mileage may be tampered") && page.includes("80,000 km"));
check("history shows the car was listed twice", page.includes("Listed 2 times on this site"));
check("YouTube video embedded privacy-friendly", page.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ"));
r = await new Client("b").req("GET", `/api/site/cars/batch?ids=${civicAd?._id}`);
check("registration number never leaves the server", !JSON.stringify(r.data).includes("7788"));
page = await new Client("b").html(`/cars/${civic?._id}`);
check("the dealer car's own page shows the same warning", page.includes("History check") && page.includes("Mileage may be tampered"));

/* ------------------------------------------------- 2. price drop */
r = await admin.req("PUT", `/api/dealership/vehicles/${civic?._id}`, { ...civic, listPrice: 5450000 });
check("reprice dealer car down", r.status === 200, r.data.error);
r = await new Client("b").req("GET", `/api/site/cars/batch?ids=${civic?._id}`);
check("listing carries price-drop badge data", r.data.listings?.[0]?.priceDrop?.from === 5600000, JSON.stringify(r.data.listings?.[0]?.priceDrop));

/* ------------------------------------------------- 3. smart search */
r = await new Client("s").req("GET", `/api/site/cars?ask=${encodeURIComponent("honda civic 2018-2020 automatic under 60 lakh")}`);
check("smart search: civic 2018-2020 automatic under 60 lakh", r.data.total === 2, `total=${r.data.total}`);
r = await new Client("s").req("GET", `/api/site/cars?ask=${encodeURIComponent("30 لاکھ تک آٹومیٹک گاڑی")}`);
check("smart search in Urdu script runs", r.status === 200 && typeof r.data.total === "number", `total=${r.data.total}`);
r = await new Client("s").req("GET", `/search?ask=${encodeURIComponent("CG 125 Karachi")}`, undefined, { raw: true });
check("home 'ask' routes bike queries to /bikes", r.status === 307 && /\/bikes\?ask=/.test(r.headers.get("location") || ""), r.headers.get("location"));
page = await new Client("s").html(`/cars?ask=${encodeURIComponent("sasti automatic gari 60 lakh tak Lahore")}`);
check("results page explains what it understood", page.includes("Under 60 lakh") && page.includes("In Lahore") && page.includes("Cheapest first"));

/* ------------------------------------------------- 4. costs & banks */
const st = (await admin.req("GET", "/api/settings")).data.settings;
r = await admin.req("PUT", "/api/settings", { ...st, costs: { ...st.costs, petrolPerLitre: 299 }, banks: [{ name: "Test Islamic Bank", markupPct: 12, minDownPct: 20, maxYears: 5, processingFee: 5000, insurancePct: 1.5, maxCarAge: 10, islamic: true }] });
check("admin saves fuel price and bank rates", r.status === 200, r.data.error);
page = await new Client("h").html("/");
check("home fuel board shows the admin's petrol price", page.includes("Rs 299"));
page = await new Client("h").html("/car-finance");
check("finance page lists the admin's bank", page.includes("Test Islamic Bank"));
page = await new Client("h").html(`/cars/${civic?._id}`);
check("car page has true monthly cost + bank comparison", page.includes("True monthly cost") && page.includes("Compare bank leasing"));
r = await admin.req("PUT", "/api/settings", { ...st, banks: [{ name: "X", markupPct: 500, minDownPct: 0, maxYears: 5, processingFee: 0, insurancePct: 0, maxCarAge: 5 }] });
check("absurd bank rate rejected", r.status === 400, r.data.error);

/* ------------------------------------------------- 5. My Garage */
const sara = await member("Sara Khan", "0302-2223344");
r = await sara.req("POST", "/api/site/garage", { vehicleType: "car", make: "Honda", model: "Civic", year: 2019, km: 60000, dailyKm: 40, oilIntervalKm: 5000, lastOilKm: 55500, serviceIntervalKm: 10000, province: "Punjab", tokenTaxDue: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10) });
const gcar = r.data.car;
check("add car to garage", r.status === 201 && gcar?._id, r.data.error);
check("oil change due soon (500 km window)", gcar?.reminders?.find((x) => x.key === "oil")?.status === "soon", JSON.stringify(gcar?.reminders?.[0]));
check("token tax due in 10 days → soon", gcar?.reminders?.find((x) => x.key === "token")?.status === "soon");
r = await sara.req("POST", `/api/site/garage/${gcar?._id}/service`, { type: "Oil change", km: 60100, cost: 9500, garage: "Shell Select", date: new Date().toISOString().slice(0, 10) });
check("log oil change → reminder resets", r.data.car?.reminders?.find((x) => x.key === "oil")?.status === "ok" && r.data.car.lastOilKm === 60100, r.data.error);
r = await sara.req("POST", `/api/site/garage/${gcar?._id}/service`, { type: "Oil change", km: 1, date: "2999-01-01" });
check("future service date refused", r.status === 400, r.data.error);
r = await sara.req("GET", `/api/site/garage/${gcar?._id}/parts`);
check("garage suggests shop products", Array.isArray(r.data.products), r.data.error);
const ics = await sara.req("GET", `/api/site/garage/${gcar?._id}/calendar`, undefined, { raw: true });
const icsText = await ics.text();
check("calendar export is a valid .ics with reminders", /text\/calendar/.test(ics.headers.get("content-type") || "") && icsText.includes("BEGIN:VCALENDAR") && icsText.includes("Token tax"));
r = await ali.req("GET", `/api/site/garage/${gcar?._id}`);
check("another member cannot open my garage car", r.status === 404, String(r.status));
r = await new Client("anon").req("GET", "/api/site/garage");
check("garage needs login", r.status === 401);
r = await sara.req("GET", `/api/site/garage/${gcar?._id}/sell`);
check("'sell this car' carries the service record", r.data.description?.includes("Oil change at 60,100 km"), r.data.description);

/* ------------------------------------------------- 6. bookings */
const visitor = new Client("visitor");
r = await visitor.req("GET", `/api/site/bookings/slots?type=test_drive&listing=${civic?._id}`);
const day = r.data.days?.find((d) => d.slots.some((s) => s.free));
const slot = day?.slots.find((s) => s.free)?.slot;
check("free slots offered", Boolean(day && slot), JSON.stringify(r.data).slice(0, 120));
const bookingBody = { type: "test_drive", listingId: civic?._id, name: "Usman", phone: "0303-3334455", date: day?.date, slot };
const [b1, b2] = await Promise.all([new Client("u1").req("POST", "/api/site/bookings", bookingBody), new Client("u2").req("POST", "/api/site/bookings", { ...bookingBody, name: "Hamza", phone: "0304-1112222" })]);
const won = [b1, b2].filter((x) => x.status === 201);
check("two people, same slot, same moment → exactly one booking", won.length === 1 && [b1, b2].some((x) => x.status === 409), `${b1.status}/${b2.status}`);
r = await visitor.req("GET", `/api/site/bookings/slots?type=test_drive&listing=${civic?._id}`);
check("booked slot now shows as taken", r.data.days?.find((d) => d.date === day?.date)?.slots.find((s) => s.slot === slot)?.free === false);
r = await visitor.req("POST", "/api/site/bookings", { ...bookingBody, listingId: civicAd?._id });
check("no showroom test drive on a private ad", r.status === 400, r.data.error);
r = await visitor.req("POST", "/api/site/bookings", { ...bookingBody, slot: "03:00" });
check("invalid slot refused", r.status === 400, r.data.error);
r = await admin.req("GET", "/api/dealership/bookings?status=requested");
const booking = r.data.bookings?.find((b) => b._id === won[0]?.data.booking?._id);
check("staff see the booking", Boolean(booking));
r = await admin.req("POST", `/api/dealership/bookings/${booking?._id}`, { status: "cancelled", staffNote: "Customer called" });
check("staff cancel", r.data.booking?.status === "cancelled", r.data.error);
r = await visitor.req("POST", "/api/site/bookings", bookingBody);
check("cancelled slot can be booked again", r.status === 201, r.data.error);
r = await admin.req("POST", `/api/dealership/bookings/${booking?._id}`, { status: "done" });
check("cancelled booking cannot be marked done", r.status === 409);
r = await sara.req("POST", "/api/site/bookings", { type: "video_call", listingId: civicAd?._id, name: "Sara", phone: "0302-2223344", date: day?.date, slot });
check("buyer books a video viewing of a private ad", r.status === 201, r.data.error);
r = await ali.req("GET", "/api/site/bookings/mine");
const forAli = r.data.forMyAds?.[0];
check("seller sees the viewing request on their ad", forAli?.type === "video_call");
r = await ali.req("POST", `/api/site/bookings/${forAli?._id}`, { status: "confirmed" });
check("seller confirms it", r.data.booking?.status === "confirmed", r.data.error);
r = await sara.req("POST", `/api/site/bookings/${forAli?._id}`, { status: "cancelled" });
check("buyer cannot act as the seller", r.status === 404);

/* ------------------------------------------------- 7. reviews & trust */
r = await sara.req("POST", "/api/site/reviews", { targetType: "dealer", targetId: "MAIN", rating: 5, comment: "Honest people" });
check("review the showroom", r.status === 200, r.data.error);
r = await sara.req("POST", "/api/site/reviews", { targetType: "dealer", targetId: "MAIN", rating: 4 });
r = await new Client("t").req("GET", "/api/site/reviews?targetType=dealer&targetId=MAIN");
check("one review per person (edit, not duplicate)", r.data.reviews === 1 && r.data.rating === 4, JSON.stringify({ n: r.data.reviews, avg: r.data.rating }));
r = await ali.req("POST", "/api/site/reviews", { targetType: "member", targetId: (await ali.req("GET", "/api/site/member/me")).data.member?._id, rating: 5 });
check("cannot review yourself", r.status === 400, r.data.error);
r = await new Client("anon").req("POST", "/api/site/reviews", { targetType: "dealer", targetId: "MAIN", rating: 1 });
check("anonymous review refused", r.status === 401);
r = await sara.req("POST", "/api/site/reviews", { targetType: "dealer", targetId: "NOPE", rating: 1 });
check("unknown showroom refused", r.status === 404);
const revs = (await admin.req("GET", "/api/shop/reviews")).data.reviews || [];
r = await admin.req("POST", `/api/shop/reviews/${revs[0]?._id}`, { status: "hidden" });
r = await new Client("t").req("GET", "/api/site/reviews?targetType=dealer&targetId=MAIN");
check("staff can hide an abusive review", r.data.reviews === 0);
const aliId = (await ali.req("GET", "/api/site/member/me")).data.member?._id;
r = await admin.req("POST", `/api/shop/members/${aliId}`, { verified: true });
r = await new Client("t").req("GET", `/api/site/reviews?targetType=member&targetId=${aliId}`);
check("ID-verified badge on the seller", r.data.badges?.includes("ID verified by showroom") && r.data.adsPosted === 1, JSON.stringify(r.data.badges));

/* ------------------------------------------------- 8. instant offer */
for (const [y, km, p] of [[2020, 40000, 4200000], [2021, 30000, 4500000], [2019, 70000, 3800000], [2020, 55000, 4100000]]) {
  await vehicle({ make: "Honda", model: "City", year: y, mileage: km, listPrice: p });
}
r = await new Client("o").req("POST", "/api/site/instant-offer", { make: "Honda", model: "City", year: 2020, mileage: 50000, condition: "good" });
const off = r.data.offer;
check("instant offer from comparable cars", off?.ok && off.low < off.high && off.high < off.market && off.comps >= 3, JSON.stringify(off));
r = await new Client("o").req("POST", "/api/site/instant-offer", { make: "Honda", model: "City", year: 2020, mileage: 50000, condition: "needs_work", accident: true });
check("worse condition → lower offer", r.data.offer?.high < off?.high);
r = await new Client("o").req("POST", "/api/site/instant-offer", { make: "Tesla", model: "Model S", year: 2020, mileage: 1000 });
check("unknown model → honest 'book an inspection'", r.data.offer?.ok === false);
r = await new Client("o").req("POST", "/api/site/sell-car", { name: "Kamran", phone: "0305-4445566", city: "Lahore", make: "Honda", model: "City", year: 2020, mileage: 50000, condition: "Good" });
check("sell request accepted", r.status === 200 || r.status === 201, r.data.error);
r = await admin.req("GET", "/api/dealership/customers?q=0305");
const lead = r.data.customers?.[0];
const leadDetail = lead ? (await admin.req("GET", `/api/dealership/customers/${lead._id}`)).data : null;
check("CRM lead records the instant offer shown", JSON.stringify(leadDetail || {}).includes("instant offer shown"), lead ? "" : "lead not found");

/* ------------------------------------------------- 9. alerts */
r = await sara.req("POST", "/api/site/alerts", { kind: "search", query: "/cars?ask=honda%20city", label: "Honda City" });
const searchAlert = r.data.alert;
check("save a search", r.status === 201 && searchAlert?._id, r.data.error);
r = await sara.req("POST", "/api/site/alerts", { kind: "search", query: "https://evil.example.com", label: "x" });
check("only site searches can be saved", r.status === 400);
await new Promise((res) => setTimeout(res, 1100));
await vehicle({ make: "Honda", model: "City", year: 2022, mileage: 15000, listPrice: 4900000 });
r = await sara.req("GET", "/api/site/alerts");
check("new matching car shows up in the alert", r.data.alerts?.find((a) => a._id === searchAlert?._id)?.newCount === 1, JSON.stringify(r.data.alerts?.map((a) => a.newCount)));
r = await sara.req("POST", "/api/site/alerts", { kind: "price", listingId: civicAd?._id });
const priceAlert = r.data.alert;
check("watch a price", r.status === 201 && priceAlert?.basePrice === 5400000, r.data.error);
r = await ali.req("PUT", `/api/site/member/ads/${civicAd?._id}`, { ...adBody, listPrice: 5250000, registrationNo: "lea 19 7788" });
await admin.req("POST", `/api/shop/classifieds/${civicAd?._id}`, { action: "approve" });
r = await sara.req("GET", "/api/site/alerts");
const pa = r.data.alerts?.find((a) => a._id === priceAlert?._id);
check("price watch reports the drop", pa?.price?.now === 5250000 && pa.newCount === 1, JSON.stringify(pa?.price));
r = await sara.req("GET", "/api/site/badges");
check("header badge counts unseen alerts", r.data.loggedIn && r.data.alerts >= 2, JSON.stringify(r.data));
await sara.req("POST", `/api/site/alerts/${searchAlert?._id}`);
r = await sara.req("GET", "/api/site/alerts");
check("mark seen resets the count", r.data.alerts?.find((a) => a._id === searchAlert?._id)?.newCount === 0);
r = await ali.req("DELETE", `/api/site/alerts/${searchAlert?._id}`);
r = await sara.req("GET", "/api/site/alerts");
check("another member cannot delete my alert", r.data.alerts?.some((a) => a._id === searchAlert?._id));

/* ------------------------------------------------- 10. safe token */
const tokenCar = await vehicle({ make: "Toyota", model: "Yaris", year: 2022, mileage: 20000, listPrice: 4700000 });
const tokenBody = { vehicleId: tokenCar?._id, name: "Bilal Saeed", phone: "0306-7778899", amount: 100000, method: "bank_transfer", reference: "FT2410ABC123" };
r = await new Client("tk").req("POST", "/api/site/tokens", tokenBody);
check("token refused while the feature is off", r.status === 403);
const st2 = (await admin.req("GET", "/api/settings")).data.settings;
r = await admin.req("PUT", "/api/settings", { ...st2, tokenEnabled: true, tokenInstructions: "Bank: Test Bank\nTitle: Test Motors\nIBAN: PK00TEST0000000000000000", tokenHoldDays: 5 });
check("admin enables safe token", r.status === 200, r.data.error);
page = await new Client("tk").html(`/cars/${tokenCar?._id}`);
check("car page offers the safe token", page.includes("Hold with a token"));
r = await new Client("tk").req("POST", "/api/site/tokens", tokenBody);
const tok = r.data.token;
check("buyer submits token", r.status === 201 && /^TK-/.test(tok?.number || ""), r.data.error);
r = await new Client("tk2").req("POST", "/api/site/tokens", { ...tokenBody, reference: "ft2410abc123" });
check("same transaction reference cannot be reused", r.status === 409, r.data.error);
const staffUser = { name: "Sales Rep", email: "rep@test.pk", phone: "0300-0000001", role: "staff", password: "secret123", isActive: true };
await admin.req("POST", "/api/users", staffUser);
const rep = new Client("rep");
await rep.req("POST", "/api/auth/login", { email: staffUser.email, password: staffUser.password });
const tokList = (await admin.req("GET", "/api/dealership/tokens?status=requested")).data.tokens || [];
const tokRow = tokList.find((t) => t.number === tok?.number);
r = await rep.req("POST", `/api/dealership/tokens/${tokRow?._id}`, { action: "verify" });
check("only an admin can verify money", r.status === 403);
const [v1, v2] = await Promise.all([
  admin.req("POST", `/api/dealership/tokens/${tokRow?._id}`, { action: "verify", holdDays: 5 }),
  admin.req("POST", `/api/dealership/tokens/${tokRow?._id}`, { action: "verify", holdDays: 5 }),
]);
check("double-click verify opens exactly one deal", [v1, v2].filter((x) => x.status === 200).length === 1, `${v1.status}/${v2.status} ${v1.data.error || v2.data.error || ""}`);
const verified = (v1.status === 200 ? v1 : v2).data.token;
check("verified token holds the car and opens a deal", verified?.status === "verified" && /\w/.test(verified?.dealNumber || ""), JSON.stringify(verified));
r = await new Client("tk").req("GET", `/api/site/cars/batch?ids=${tokenCar?._id}`);
check("car shows as reserved", r.data.listings?.[0]?.status === "reserved", r.data.listings?.[0]?.status);
const deal = (await admin.req("GET", "/api/dealership/deals")).data.deals?.find((d) => d.number === verified?.dealNumber);
check("deal has the token as a paid deposit", deal && deal.payments?.[0]?.amount === 100000, JSON.stringify(deal?.payments));
r = await new Client("tk3").req("POST", "/api/site/tokens", { ...tokenBody, phone: "0307-1234567", reference: "OTHERREF999" });
check("second buyer cannot token a held car", r.status === 409, r.data.error);
r = await admin.req("POST", `/api/dealership/tokens/${tokRow?._id}`, { action: "refund", staffNote: "Buyer changed mind" });
check("refund", r.data.token?.status === "refunded", r.data.error);
r = await new Client("tk").req("GET", `/api/site/cars/batch?ids=${tokenCar?._id}`);
check("refund releases the car", r.data.listings?.[0]?.status === "in_stock", r.data.listings?.[0]?.status);
const dealAfter = (await admin.req("GET", "/api/dealership/deals")).data.deals?.find((d) => d.number === verified?.dealNumber);
check("refund cancels the deal (receipt reversed)", dealAfter?.status === "cancelled", dealAfter?.status);

/* ------------------------------------------------- 11. Urdu & pages */
const urdu = new Client("ur");
urdu.cookies.am_lang = "ur";
page = await urdu.html("/");
check("Urdu: right-to-left with Urdu headings", page.includes('dir="rtl"') && page.includes("اپنی اگلی گاڑی"));
page = await new Client("en").html("/");
check("English is the default", page.includes('dir="ltr"') && page.includes("Find your next car or bike"));
urdu.cookies.am_lang = "xx";
page = await urdu.html("/");
check("unknown language falls back to English", page.includes('dir="ltr"'));
for (const p of ["/garage", "/alerts", "/car-finance", "/sell-car", `/post-ad?garage=${gcar?._id}`, "/account"]) {
  const res = await new Client("pg").req("GET", p, undefined, { raw: true });
  check(`page ${p} renders`, res.status === 200, String(res.status));
}
for (const p of ["/dealership?tab=bookings", "/dealership?tab=tokens", "/dealership?tab=reviews", "/settings"]) {
  const res = await admin.req("GET", p, undefined, { raw: true });
  check(`staff page ${p} renders`, res.status === 200, String(res.status));
}
r = await new Client("anon").req("GET", "/api/dealership/tokens");
check("token list is staff-only", r.status === 401);
