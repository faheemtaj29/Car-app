# Auto Marketplace Constitution

## Core Principles

### I. TypeScript Strict Correctness (NON-NEGOTIABLE)
TypeScript strict mode always on. No implicit `any`. New code must pass `tsc --noEmit` clean. Never use `@ts-ignore` or `as any` to suppress errors — fix the root cause.

### II. Service-Layer Architecture
All database calls go through services (`src/backend/services/`). Route handlers call services only — no Mongoose queries in route files. Services return plain serialized view objects, never Mongoose documents. Errors use `ServiceError`; routes use `fromServiceError()`.

### III. Security & Privacy (NON-NEGOTIABLE)
- CNIC / ID card numbers: AES-256-GCM encrypted. Admin-only reveal. Audit-logged. Never in public pages or APIs.
- `requireAuth(roles?)` at the top of every protected API route.
- No credentials or tokens committed to source code.
- User-uploaded files served through authenticated routes only.

### IV. Separation of Concerns — Car Dealer App Only
This is a **car and bike dealer marketplace** (`faheemtaj29/Car-app`). It has nothing to do with the School-System. No school, student, teacher, or academic code belongs here. Public website (`(site)/`) and owner dashboard (`(app)/`) are fully separate concerns — do not mix their styles or data.

### V. Minimal, Purposeful Code
No features beyond what is requested. No speculative abstractions. No backwards-compatibility shims. Comments only where the WHY is non-obvious.

### VI. Next.js 16 App Router Conventions
- `params` / `searchParams` are Promises — always `await` them.
- `next/font/local` with bundled `.woff2` files only.
- `next/image` with `fill` requires `position: relative; overflow: hidden` on the parent container.
- `images.unsplash.com` and `**.cloudinary.com` are the only allowed remote image hosts.

## Technology Stack

- **Framework**: Next.js 16, React 19, TypeScript 5 (strict)
- **Database**: MongoDB via Mongoose 9
- **Styling**: Global CSS utility classes in `src/app/globals.css` — design tokens on `:root`, no Tailwind
- **Images**: Unsplash CDN via `carImageUrl()` from `@/lib/carImages`; i18n via `getT()` / `getMyCity()`
- **Fonts**: Spectral (display), Work Sans (sans), Space Mono (mono), Noto Nastaliq Urdu — all bundled

## Development Workflow

- Branch: `main` for all work on this repo
- Commit with `Co-Authored-By` and `Claude-Session` footer lines
- Never create a pull request unless explicitly asked
- Run `tsc --noEmit` before every commit

## Governance

This constitution supersedes all other practices. SpecKit workflow: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.

**Version**: 1.0.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
