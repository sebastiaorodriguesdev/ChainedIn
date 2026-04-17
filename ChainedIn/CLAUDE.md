# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChainedIn is a **cyber trust social network** built with Next.js 14 (App Router). It lets software publishers register packages, track CVE vulnerabilities, earn compliance badges (ISO 27001, NIS2, SOC 2, GDPR, PCI DSS), and visualize dependency graphs. Companies receive a trust score (0–100) derived from CVE severity across their software portfolio.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint

# Database
npm run prisma:generate   # Regenerate Prisma client after schema changes
npm run prisma:migrate    # Run pending migrations
npm run prisma:seed       # Seed with test data (15 accounts, password: password123)
npm run setup             # Full setup: install + migrate + seed
```

No test suite exists in this project.

## Environment Setup

Create `.env.local` with:
```
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="dev-secret-chainedin-change-in-prod"
NEXTAUTH_URL="http://localhost:3000"
NVD_API_KEY=""           # Optional — without it, NVD requests are rate-limited to 1 req/6.2s
CVE_CACHE_TTL_HOURS=24
```

## Architecture

### Tech Stack
- **Next.js 14** App Router — server components by default
- **Prisma 5** + **SQLite** (`prisma/dev.db`)
- **NextAuth v5** (beta) — credentials provider, JWT sessions
- **Tailwind CSS** + **Radix UI** primitives
- **React Flow** (`@xyflow/react`) — dependency graph canvas
- **Recharts** — CVE severity visualization
- **Fuse.js** — fuzzy search/autocomplete

### Authentication & Authorization
- `auth.ts` — NextAuth v5 config; users have `type`: `PERSON | COMPANY | ADMIN`
- `middleware.ts` — route protection; `/admin/*` requires ADMIN type; dashboard routes require login
- `lib/auth-guard.ts` — server-side helpers: `requireSession()`, `requireAdmin()`
- Sessions include `id` and `type` via custom JWT/session callbacks

### Data Models (Prisma)
Key relationships to understand:
- `User` → `Software` → `SoftwareVersion` → `CveCache` (CVE data from NIST NVD, TTL 24h)
- `User` → `Stack` → `StackNode` (can link to `SoftwareVersion` or be freeform) → `StackEdge`
- `User` → `BadgeRequest` (PENDING → APPROVED/REJECTED by admin)

### CVE Integration
- `lib/nvd-client.ts` — NIST NVD API v2.0 client with rate limiting (700ms with API key, 6200ms without)
- `lib/cve-service.ts` — cache-aside pattern with 24h TTL; refreshes stale entries on access
- `api/software/[slug]/versions/[versionId]/cve` — triggers fetch/cache refresh

### Trust Score
- `lib/trust-score.ts` — scores companies 0–100; penalizes by worst CVE severity across latest versions; bonuses for remediation and approved badges

### Routing Conventions
- Pages live in `app/` following Next.js App Router file conventions
- API routes are in `app/api/` — all use standard Next.js route handlers
- `lib/` contains shared services (no React); `components/` for UI; `types/` for TypeScript interfaces

### Key Components
- `components/nav.tsx` — top nav with global search
- `components/sidebar.tsx` — dashboard left sidebar
- `components/cve-charts.tsx` — Recharts CVE stacked bar + scatter timeline
- `components/dev-switcher.tsx` — dev-only account switcher for testing different user types (rendered only outside production)
- `components/ui/` — Radix UI–based primitives (button, dialog, select, etc.)

### Seeded Test Accounts
All use password `password123`:
- `admin@chainedin.dev` — ADMIN
- Company accounts: `acme@chainedin.dev`, `securecorp@chainedin.dev`, `cloudnative@chainedin.dev`, etc.
- Person accounts: `alice@chainedin.dev`, `bob@chainedin.dev`, etc.
