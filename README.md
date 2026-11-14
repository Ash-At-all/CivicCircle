# CivicCircle

CivicCircle is a Next.js (App Router, TypeScript) application for local community posts/chat and a hyperlocal **Nearby** experience (map, local shops, and area chat) for Chhatrapati Sambhajinagar.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Auth, Postgres/PostGIS, RLS, Realtime, Storage)
- **Map:** MapLibre GL JS + OpenFreeMap (no API key)
- **Geocoding/search:** Photon (Komoot, public) for place lookup
- **Area indexing:** H3 (`h3-js`)
- **Validation:** Zod

## Setup

### Prerequisites
- Node.js 20+ (project currently used with Node 24 in dev environment)
- npm
- A Supabase project (staging/production) with Postgres/PostGIS available

### Install
```bash
npm install
```

### Configure environment
Create `.env.local` in the project root (do not commit). Required for a working backend:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server-only) | Service role key for server-only operations (e.g. area resolution/admin RPC paths). **Never** expose as `NEXT_PUBLIC_*` and never ship to client bundles. |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL |
| `NEXT_PUBLIC_SITE_NAME` | No | Site display name |

**Security:** no `service_role`/`SUPABASE_SERVICE_ROLE_KEY` in client code or `NEXT_PUBLIC_*` variables. Area writes/privileged operations go through server route handlers and/or server-only clients.

### Database migrations
Apply SQL migrations in `supabase/migrations/` **in timestamp order** to the target Supabase project. Do not apply to production without review/backups.

**Migration order (current):**
1. `20261022171000_create_posts.sql`
2. `20261022172000_enable_rls_for_public_tables.sql`
3. `20261022195800_add_post_image_storage.sql`
4. `20261022201500_fix_post_image_storage_policies.sql`
5. `20261022205500_ensure_post_image_paths.sql`
6. `20261023130000_create_profiles.sql`
7. `20261023160000_fix_profiles_permissions.sql`
8. `20261023170000_create_messages.sql`
9. `20261023200000_create_post_interactions.sql`
10. `20261023210000_create_reports.sql`
11. `20261108000000_remove_auth.sql`
12. `20261114090000_harden_existing_policies.sql`
13. `20261114090100_extensions_and_helpers.sql`
14. `20261114090200_create_areas.sql`
15. `20261114090250_create_profile_locations.sql`
16. `20261114090300_create_shops.sql`
17. `20261114090400_create_shop_photos_and_reports.sql`
18. `20261114090500_alter_messages_for_areas.sql`
19. `20261114090550_alter_reports_for_areas.sql`
20. `20261114090600_create_presence.sql`
21. `20261114090700_create_rate_limits.sql`
22. `20261114090800_create_blocks_and_mutes.sql`
23. `20261114090900_create_geocode_cache.sql`
24. `20261114091000_create_rpc_functions.sql`
25. `20261114091100_rls_and_grants.sql`
26. `20261114091200_seed_sambhajinagar.sql`
27. `20261114091300_repair_shared_rate_limits.sql`
28. `20261114091500_d5_area_chat.sql`
29. `20261114091600_repair_ensure_area_conflict.sql`
30. `20261114091700_repair_profile_locations_grants.sql`

Optional: `supabase/seed.sql` for initial city data where applicable. After applying migrations, verify with `supabase/tests/preflight.sql` / `supabase/tests/rls.sql` patterns as appropriate for the environment.

### Run
```bash
npm run dev
```
Open `http://localhost:3000`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run format` | Prettier |

Unit tests (no npm script configured):  
`node --experimental-strip-types --test tests/unit/h3.test.ts tests/unit/radius.test.ts`

## Nearby / hyperlocal feature notes

- **Area identity:** H3 resolution 8 cell; hierarchy to ward (res 7) and city (res 5). Exact user lat/lng is not stored in `profile_locations`; only H3/area identifiers are persisted. No location history. Users can change/clear area (clearing removes saved profile location and stops presence).
- **Presence:** opt-in, aggregate room counts only (no exact user points). Heartbeat/room leave handled server-side/RPC with privacy-preserving behavior.
- **Map/shops:** MapLibre GL + OpenFreeMap dark style, radius expansion steps `[0.5,1,2,5,10,25,50] km`, honest empty/loading/error states, shop data from configured/public sources as implemented (no fake stats/reviews).
- **Area chat:** locality/ward/city rooms, last 50 + cursor pagination, optimistic send/retry, Supabase Realtime with polling fallback, per-room mute, report/block actions, server-side validation/rate limits, friendly 429/empty/error/offline states.
- **Rate limiting:** Postgres-backed shared limiter via `consume_rate_limit` RPC; `areaResolve` limit is relaxed in non-production (`NODE_ENV !== "production"`) for local/staging testing.

## Free tier limits and external services (operational)

These are important for capacity planning; actual limits depend on provider plans/configuration:
- **Supabase (free tier, typical):** limited database size/storage/egress, capped Realtime concurrent connections/messages and Auth/API quotas. Heavy chat/realtime usage can hit plan limits.
- **OpenFreeMap:** free vector tiles/styles (no key) subject to provider availability/fair use; no SLA implied.
- **Photon (Komoot geocoding):** public service, fair-use/rate expectations apply; can be throttled/unavailable. App behavior should degrade gracefully.
- **Map tiles/geocoding/network:** client-side map and search depend on third-party availability and user network quality.

## Known limitations

- **Legal pages are drafts:** Privacy/Terms require operator-specific contact/retention/rights details and legal review before public launch.
- **Lighthouse/performance:** scores vary by device/network/build and third-party tile/geocode availability; treat reported scores as point-in-time measurements.
- **Realtime dependency:** live chat delivery requires Supabase Realtime/publication and valid client sessions; polling fallback exists but is not identical to realtime latency.
- **Anonymous/abuse controls:** ghost handles, rate limits, filters, report/block/mute reduce abuse but do not eliminate it; moderation workflows depend on operator processes.
- **Launch scope:** nearby experience is configured for Chhatrapati Sambhajinagar launch bounds/data as implemented; other cities/data coverage may be limited.
- **Staging drift:** if migrations/hotfixes are applied directly to a DB, ensure the same migrations exist and are applied in order in repo-managed environments.
- **Testing:** automated coverage is limited (current unit tests cover H3/radius helpers); see `docs/manual-test.md`.

## Docs
- `docs/research.md`, `docs/plan.md` - product/architecture planning
- `docs/db-notes.md` - migration/RLS/function notes and staging findings
- `docs/deliverable-*-notes.md` - phased delivery notes
- `docs/manual-test.md` - manual test checklist
- `docs/rollback.md` - rollback guidance

## CI
GitHub Actions (if configured) typically runs lint/typecheck/build on push/PR; ensure env/secrets and migration state are appropriate for CI targets.
