# ChainedIn v1 — Cyber Trust Network

A local prototype for a cyber trust social network where software publishers register packages, CVE vulnerability data from NIST NVD is overlaid on version releases, and users build private dependency stacks to see their security exposure.

## Quick start

```bash
npm install
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name init
DATABASE_URL="file:./prisma/dev.db" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
npm run dev
```

Open: http://localhost:3000

## Dev accounts (password: `password123`)

| Email | Type | What to test |
|---|---|---|
| `admin@chainedin.dev` | Admin | Badge approval at `/admin/badges` |
| `acme@chainedin.dev` | Company | Software with CVE data, mixed severity |
| `securecorp@chainedin.dev` | Company | Clean software, verified ISO 27001 badge |
| `alice@chainedin.dev` | Person | Pre-built stack with vulnerability exposure |
| `bob@chainedin.dev` | Person | Pending NIS2 badge request |

Use the **Dev mode** button (bottom-right) to switch between accounts instantly.

## Features

- **Profiles** — company and individual accounts with bio, logo, website
- **Software listings** — register packages (npm, pip, maven, cargo, etc.) with version releases
- **CVE integration** — pull from NIST NVD API per version, cached 24h. Click "CVE" button on any version to refresh.
- **CVE visualization** — stacked bar chart + scatter timeline on software detail pages
- **Private stack builder** — React Flow canvas to build dependency graphs. Add platform packages or freeform unknown ones. See total vulnerability exposure.
- **Compliance badges** — request ISO 27001, NIS2, SOC 2, GDPR, PCI DSS. Admin-verified before showing on public profile.
- **Admin panel** — approve/reject badge requests at `/admin/badges`

## NVD API key (optional)

Without a key: 5 requests per 30s (slow). With a key: 50 requests per 30s.

Get a free key at https://nvd.nist.gov/developers/request-an-api-key then add to `.env.local`:

```
NVD_API_KEY=your-key-here
```

## Stack

- Next.js 14 (App Router)
- Prisma + SQLite
- NextAuth v5 (credentials + JWT)
- Tailwind CSS
- React Flow (`@xyflow/react`) — stack builder canvas
- Recharts — CVE charts
- NIST NVD API v2.0 — CVE data source
