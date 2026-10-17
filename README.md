# Auto Marketplace

Car & bike dealership software with a public marketplace (PakWheels-style), an online shop for
parts, oils and accessories, private-seller classified ads, and built-in inventory and
double-entry accounting.

Built with **Next.js 16 (App Router) + React 19 + TypeScript + MongoDB (Mongoose)**.

## What's inside

| Area | Who | Where |
|------|-----|-------|
| Public website | Buyers | `/` home & search, `/cars`, `/bikes`, `/shop`, `/sell-car` |
| Seller accounts | Private sellers | `/post-ad`, `/account` (ads, buyer messages, shop orders) |
| Dashboard | Staff | `/dashboard` |
| Dealership | Staff | `/dealership` — cars & bikes stock, inspections, fair-price check, lead CRM, deal desk, financing, delivery, public-ad review |
| Online shop | Staff | `/ecommerce` — orders (confirm → dispatch → deliver), product listings, shop settings |
| Parts inventory | Staff | `/inventory` — products, purchases, sales, adjustments, branch transfers |
| Accounting | Admin | `/accounting` — vouchers, chart of accounts, ledgers, trial balance, P&L, balance sheet |
| Settings | Admin | `/settings` — business name, branches, tax, colours, staff accounts |

Everything posts to the books automatically: vehicle purchases and repairs → Vehicle Inventory;
customer deposits → Customer Deposits (liability) until delivery; delivery → Vehicle Sales,
Cost of Vehicles Sold, GST payable, trade-ins into stock; shop orders → stock vouchers and
Parts & Accessories Sales.

## Run it on your computer

1. Install **Node.js 20+** and **MongoDB** (or create a free MongoDB Atlas database).
2. Unzip / clone this project, open a terminal in the folder, then:

```bash
cp .env.local.example .env.local      # then edit MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

3. Open http://localhost:3000/setup — enter your business name and create the owner account.
4. You land on the dashboard. The public website is at http://localhost:3000.

There are no database migrations: MongoDB creates the collections on first use, and the chart of
accounts is created automatically the first time Accounting is used.

## Production

```bash
npm run build
npm start
```

Uploaded photos are saved under `public/uploads/`. On hosting without a persistent disk
(e.g. serverless), switch `src/backend/lib/imageUpload.ts` to object storage (S3 / Cloudflare R2).

## Checks

```bash
npm run typecheck
npm run lint
# end-to-end test (101 checks) against a throwaway database whose name ends in _test:
MONGODB_URI=mongodb://localhost:27017/auto_test npm run test:e2e:reset
MONGODB_URI=mongodb://localhost:27017/auto_test JWT_SECRET=dev-secret-0123456789abcdef npm run dev
npm run test:e2e        # in a second terminal (E2E_BASE_URL defaults to http://localhost:3000)
```

## Buyer features that set this site apart

| Feature | Where | Notes |
|---|---|---|
| **History check** | Every car page | Matches listings by registration/chassis number; flags odometer rollback, shows past prices and how many sellers. Reg/chassis numbers are never shown publicly. |
| **Plain-language search** | Home page, `/cars`, `/bikes` | "family car under 30 lakh automatic", Roman Urdu ("sasti gari 25 lakh tak Lahore") and Urdu script. Shows what it understood as chips. |
| **True monthly cost** | Every car page, compare | Fuel, maintenance, token tax (by province), insurance, optional instalment. Rates editable in Settings → Running costs. |
| **Bank lease comparison** | Car pages, `/car-finance` | All banks side by side with salary-based eligibility. Rates editable in Settings → Bank lease rates (ships with sample banks). |
| **My Garage** | `/garage` | Oil/service/token tax/insurance reminders, service log, calendar (.ics) export, parts that fit, one-tap "sell this car" with the service record attached. |
| **Bookings** | Car pages; staff: Dealership → Bookings | Test drives, home inspections, WhatsApp video viewings. Slots cannot be double-booked. Private sellers confirm viewings in their account. |
| **Reviews & trust** | Car pages; staff: Dealership → Reviews | One review per member per seller, staff can hide abuse, admins can mark a seller "ID verified". New accounts wait `REVIEW_MIN_ACCOUNT_HOURS` (default 24). |
| **Instant offer** | `/sell-car` | Offer range from comparable cars; recorded on the CRM lead. |
| **Alerts** | `/alerts`, 🔔 in the header | Saved searches (new matches) and price-drop watches. |
| **Safe token** | Showroom car pages; staff: Dealership → Safe Tokens | Off by default. Buyer pays the showroom's own account; an admin verifies, which opens a deal with the token as its first payment (car reserved, receipt booked). Refund cancels the deal and reverses the receipt. |
| **Urdu** | اردو button in the header | Right-to-left layout with Nastaliq font for the main pages. |
| Extras | | Price-drop badges, video walkarounds, recently viewed, share button, "great deals" and fuel-price board on the home page. |

Run the feature tests after the main suite (same `*_test` database, server started with `REVIEW_MIN_ACCOUNT_HOURS=0`):

```bash
npm run test:e2e && npm run test:e2e:engagement
```

## Sellers, dealers and parts suppliers

- **Registration** (`/register`): individual, dealer or parts supplier. Every seller gives their legal name, CNIC number and address once, with consent. **No ID-card copy is collected.**
- **Privacy:** the CNIC is encrypted (AES-256-GCM; set `KYC_SECRET` once, or it derives from `JWT_SECRET`), shown masked, and only an admin can view it in full (Dealership → Sellers & Partners). Every view is written to the audit log. Identity data never appears on public pages or APIs.
- **Dealers** (after admin approval): up to 200 live cars, a public page at `/dealers/<name>`, a dealer badge on their ads, and "Copy as new ad" for similar cars.
- **Suppliers** (after admin approval): list parts with the exact makes, models and years they fit. Buyers find them via "Parts for my vehicle" on the shop and contact the supplier directly.
- **City-first search:** the 📍 city picker in the header shows local cars first, with counts for every other city. You can also filter by the registration (number-plate) city.

```bash
npm run test:e2e && npm run test:e2e:engagement && npm run test:e2e:partners
```

## NADRA verification (built, switched off)

`src/backend/lib/nadra.ts` holds a ready NADRA Verisys integration that is **off** by default (`NADRA_PROVIDER=off`). Until it is on, staff verify identities by hand.

To switch it on after getting a NADRA agreement:
1. Confirm the fields marked `NADRA SPEC` against NADRA's API document.
2. Set `NADRA_PROVIDER=verisys` and the `NADRA_*` credentials (see `.env.local.example`).
3. Optionally set `NADRA_AUTO_VERIFY=1` so a full match verifies the seller automatically.

When on, each new identity is checked as it is submitted, and admins get a "Check with NADRA" button. A mismatch is flagged for staff and never rejected automatically. Only the CNIC number and the name the seller typed are sent.

Test the flow with the mock provider (development only; ignored in production):
`NADRA_PROVIDER=mock NADRA_AUTO_VERIFY=1 npm run dev` and then `npm run test:e2e:nadra`.

## Certificate of registration

When an admin approves a dealer or parts supplier, a certificate number (`CR-YYYY-NNNNN`) is issued automatically. The owner's **My account** page downloads the PDF by itself the first time they open it after approval, and always shows a "Download certificate" button.

- The PDF has business details only (no CNIC, no home address) and a QR code to `/verify/<number>`, which confirms it is genuine and still active. A suspended business shows as "no longer active" and can no longer download.
- **Set `SITE_URL` in production**: it is the address inside the QR code.
- The PDF is generated on request, so it always reflects the current business details. Business names in Urdu script are left out of the PDF (the built-in PDF fonts are Latin only); embed an Urdu font in `certificate.service.ts` if you need that.
