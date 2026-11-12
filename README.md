# CivicCircle

CivicCircle is a Next.js (App Router, TypeScript, Tailwind) application for city communities, public posts, and topic-based chat. Supabase provides authentication, profiles, posts, comments, votes, chat messages, reports, blocks, and image storage. Without Supabase configuration, the app shows setup guidance instead of fabricated community content.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Backend:** Supabase (auth, database, realtime, storage)
- **Validation:** Zod
- **Icons:** Lucide React
- **Testing:** Vitest + Playwright (placeholders)

## Folder Structure

```
civiccircle/
├── public/
│   ├── brand/
│   │   └── logo.png
│   ├── icons/
│   │   ├── apple-touch-icon.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── manifest.webmanifest
│   ├── offline.html
│   └── sw.js
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (marketing)/
│   │   │   └── page.tsx
│   │   ├── (legal)/
│   │   │   ├── layout.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── error.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── not-found.tsx
│   │   │   ├── home/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── chat/page.tsx
│   │   │   ├── chat/[roomId]/page.tsx
│   │   │   ├── discovery/page.tsx
│   │   │   ├── onboarding/page.tsx
│   │   │   ├── user/[username]/page.tsx
│   │   │   └── c/[citySlug]/page.tsx
│   │   └── api/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── bottom-nav.tsx
│   │   │   ├── desktop-sidebar.tsx
│   │   │   ├── legal-shell.tsx
│   │   │   └── site-brand.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── skeleton.tsx
│   │       ├── empty-state.tsx
│   │       └── error-state.tsx
│   ├── config/
│   │   ├── site.ts
│   │   └── cities.ts
│   ├── features/
│   │   ├── cities/
│   │   │   ├── cities.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── posts/
│   │   │   ├── actions.ts
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── types.ts
│   │   ├── chat/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   └── auth/
│   │       ├── actions.ts
│   │       ├── index.ts
│   │       ├── schema.ts
│   │       └── types.ts
│   ├── lib/
│   │   ├── client-image.ts
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── rate-limit/
│   │   │   ├── index.ts
│   │   │   ├── memory.ts
│   │   │   └── redis.ts
│   │   ├── server/
│   │   │   └── json-body.ts
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── server.ts
│   ├── types/
│   │   └── index.ts
│   └── globals.css
├── supabase/
│   ├── migrations/
│   │   └── .gitkeep
│   └── seed.sql
├── tests/
│   ├── unit/.gitkeep
│   └── e2e/.gitkeep
├── .github/workflows/ci.yml
├── .vscode/
├── docs/
├── _old-root/
├── .env.example
├── .env.local (not committed)
├── .gitignore
├── .prettierrc
├── .editorconfig
├── package.json
├── tsconfig.json
└── next.config.ts
```

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (Project Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (Project Settings > API) |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL (default: https://civiccircle.in) |
| `NEXT_PUBLIC_SITE_NAME` | No | Site display name (default: CivicCircle) |

Do not commit `.env.local`. Never put a `service_role` key in `NEXT_PUBLIC_` variables.

### Supabase Setup

1. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, then restart Next.js.
2. In Supabase Dashboard > Authentication > Providers, enable Google and configure the authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard > Authentication > URL Configuration, allow the app callback URL (e.g. `http://localhost:3000/auth/callback`).
4. Apply migrations in `supabase/migrations` in timestamp order.
5. Optionally run `supabase/seed.sql` to seed initial city data.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run format` | Format code with Prettier |

## Known Limitations

- **In-memory rate limiter:** The rate limiter stores counts in a per-process Map. Limits reset on restart and are not shared across server instances. Production deployment should use a shared store (Redis/Upstash) via `createRateLimiter("redis")`.
- **Mock data / no Supabase:** Without Supabase configuration, API routes return placeholder responses and the app shows setup guidance.
- **Legal pages:** Privacy and Terms pages are draft guidance requiring legal review before public launch.
- **Chat:** Uses polling-based refresh; not end-to-end encrypted or private messaging.

## Deployment

### Vercel

Import the repository into Vercel with the repository root (`./`) as the project root. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production and Preview environments. Add the deployed Vercel callback URL (`https://<project>.vercel.app/auth/callback`) to Supabase Authentication > URL Configuration > Redirect URLs.

## CI

GitHub Actions runs on push to `main` and pull requests: Node 20, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`.
