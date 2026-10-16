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
