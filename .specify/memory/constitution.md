# Auto Marketplace Constitution

## Core Principles

### I. TypeScript Strict Correctness (NON-NEGOTIABLE)
TypeScript strict mode MUST always be on. Implicit `any` is forbidden — every function
parameter and return value MUST be explicitly typed. New code MUST pass `tsc --noEmit`
with zero new errors. Pre-existing errors in unrelated files MAY be left as-is, but new
code introduced in the same PR/commit MUST be clean. `@ts-ignore` and `as any` MUST NOT
be used to silence errors; fix the root cause instead.

### II. Service-Layer Architecture (NON-NEGOTIABLE)
All database access MUST go through the service layer (`src/backend/services/`). API route
handlers MUST call services only — Mongoose queries MUST NOT appear in route files. Services
MUST return plain, serialised view objects (never raw Mongoose documents). Errors MUST use
the `ServiceError` class; route handlers MUST call `fromServiceError()` to respond. The
`requireAuth(roles?)` helper MUST be called at the top of every protected route handler.

### III. Security & Privacy (NON-NEGOTIABLE)
- CNIC / ID card numbers MUST be stored AES-256-GCM encrypted at rest.
- CNIC reveal MUST be admin-only and MUST be audit-logged on every access.
- CNIC numbers MUST NOT appear in public-facing pages, API responses, or logs.
- Secrets, tokens, and credentials MUST NOT be committed to source code or repository files.
- User-uploaded files MUST be served through authenticated routes only.
- `requireAuth(roles?)` MUST guard every non-public API route.

### IV. Car Dealer Marketplace Scope (NON-NEGOTIABLE)
This project is a **car and bike dealer marketplace** (PakWheels-style). It MUST contain
only marketplace, dealership, parts, shop, and finance features. School, student, teacher,
or academic code MUST NOT be introduced. The public website (`(site)/`) and the owner
dashboard (`(app)/`) are separate rendering surfaces — their styles and data MUST NOT be
mixed. Breaking this scope boundary requires explicit written approval.

### V. Minimal, Purposeful Code
Features MUST NOT be added beyond what is explicitly requested (YAGNI). Speculative
abstractions are forbidden. Backwards-compatibility shims for removed code MUST NOT be
added. Three similar lines of code is preferable to a premature abstraction. Comments MUST
only explain WHY something is done when it is non-obvious — explaining WHAT the code does
is forbidden (well-named identifiers do that).

### VI. Next.js 16 App Router Conventions
- `params` and `searchParams` MUST be `await`-ed (they are Promises in Next.js 16).
- Fonts MUST use `next/font/local` with bundled `.woff2` files — `next/font/google` is
  forbidden (network unavailable in cloud containers).
- `next/image` with `fill` MUST have a parent with `position: relative; overflow: hidden`
  and an explicit height or aspect-ratio.
- Remote images MUST only come from `images.unsplash.com` or `**.cloudinary.com`
  (declared in `next.config.ts` `remotePatterns`).
- Server components MUST be used for data fetching; `"use client"` MUST only be added
  where interactivity requires it.

## Technology Stack

- **Framework**: Next.js 16.3.1, React 19, TypeScript 5 (strict)
- **Database**: MongoDB via Mongoose 9 — `populate().lean()` pattern; documents MUST be
  serialised via `toView()` or equivalent before leaving the service layer
- **Auth**: Session-based via `requireAuth()` from `@/backend/lib/http`
- **Styling**: Global CSS utility classes in `src/app/globals.css`; design tokens on `:root`;
  no Tailwind, no CSS-in-JS, no CSS Modules unless pre-existing
- **Images**: Unsplash CDN via `carImageUrl()` from `@/lib/carImages`
- **i18n**: `getT()` / `getMyCity()` server helpers; English or pure Urdu (Nastaliq) only —
  Hindi words written in Urdu script are forbidden
- **Fonts**: Spectral (display), Work Sans (sans), Space Mono (mono),
  Noto Nastaliq Urdu — all bundled as local `.woff2` files

## Development Workflow

- **Branch**: `main` for all work on this repository
- **Commit messages**: descriptive, present tense; MUST end with `Co-Authored-By` and
  `Claude-Session` attribution footer lines
- **Pull requests**: MUST NOT be created unless explicitly requested by the user
- **Pre-commit gate**: `tsc --noEmit` MUST pass (zero new errors) before every commit
- **SpecKit workflow**: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`; `/speckit-clarify` and `/speckit-analyze` are available before
  planning to de-risk ambiguity

## Governance

This constitution supersedes all other practices and guidelines. Any deviation from a
NON-NEGOTIABLE principle requires explicit written approval from the project owner before
implementation. Amendments MUST follow semantic versioning (MAJOR for removals/redefinitions,
MINOR for additions, PATCH for clarifications). All spec-kit commands read this file at
runtime — keep it accurate and up to date. Complexity MUST be justified against an explicit
requirement; if no requirement exists, the code MUST NOT exist.

**Version**: 1.1.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
