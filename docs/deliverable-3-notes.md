# Deliverable 3 notes — real Supabase and area resolution

**Date:** 13 November 2026  
**Scope:** Deliverable 3 foundation and area resolution. No Deliverable 4 (map/shops UI shell) work started.

## What was delivered

### Core infrastructure
- **Supabase clients**
  - `src/lib/supabase/server.ts`: real `createServerClient` from `@supabase/ssr` with cookie handling (read-only cookie sets in Server Components are safe; refresh handled in proxy).
  - `src/lib/supabase/client.ts`: real browser `createBrowserClient` singleton.
  - `src/lib/supabase/admin.ts`: server-only service-role client (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`) for operations that must not trust the browser (e.g. `ensure_area`).
- **Session refresh:** `src/proxy.ts` refreshes Supabase auth session on requests (no authorization logic; routes/components still verify user).
- **Environment:** `.env.example` updated with `SUPABASE_SERVICE_ROLE_KEY`, optional `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`; no service key in any `NEXT_PUBLIC_` variable.

### Rate limiter migration (shared Postgres store)
- `src/lib/rate-limit/policy.ts`: action policies (limits/windows/labels) including existing and new area/shop actions.
- `src/lib/rate-limit/index.ts`: async `enforceRateLimit(supabase, action)` calling `consume_rate_limit` RPC, returns 429 with `Retry-After` and friendly message, or 401 when unauthenticated.
- **Updated routes (rate limit + real auth patterns):** `api/posts`, `api/posts/[id]`, `api/posts/[id]/comments`, `api/posts/[id]/votes`, `api/posts/images`, `api/posts/validate`, `api/messages`, `api/messages/validate`, `api/comments/validate`, `api/reports`, `api/blocks`, `api/profiles`, `api/profiles/[username]`, `api/profiles/avatar`.
- **Deleted:** `src/lib/rate-limit/memory.ts`, `src/lib/rate-limit/redis.ts` (and no imports remain).

### Area resolution
- **Libraries:** `src/features/area/h3.ts` (city bounds, cell validation/resolution checks, `coordsToAreaCells`, centroid), `src/features/area/radius.ts` (radius steps, shop/people selection, messages), `src/features/area/schema.ts`, `src/features/area/names.ts`.
- **APIs:**
  - `POST /api/area/resolve`: validates origin/body/cells, enforces per-user rate limit, computes centroids client-independently via `h3-js`, upserts city→ward→locality via **service-role** `ensure_area`, saves `profile_locations` for the authenticated user. No lat/lng accepted from client.
  - `DELETE /api/area/location`: clears presence and deletes `profile_locations`.
  - `GET /api/area/nearby`: returns centroid-based shop/people data from RPCs plus presence/area ids for the signed-in user.
  - `GET /api/geocode`: Photon proxy, city-bounded, cached in `geocode_cache` (server-only), rate-limited.
- **Origin helper:** `src/lib/server/origin.ts` for state-changing routes.

### Auth bootstrap and area UI
- `src/lib/auth/ghost.ts`: ghost handle generator.
- `src/components/auth/auth-bootstrap.tsx`: client bootstrap that signs in anonymously when needed and ensures a ghost profile exists (retries on username collision). Mounted in root layout.
- **UI:** `src/components/area/area-consent.tsx` (consent + privacy points + actions, `PresenceOptIn` toggle default off), `src/components/area/area-picker.tsx` (manual search via geocode API).
- **Page:** `src/app/nearby/page.tsx` — minimal area setup flow: consent → use location (browser geolocation → local H3 conversion → resolve) or manual pick, shows set area with presence toggle and change/clear actions. (Full nearby shell/map/sheet is Deliverable 4.)

## Verification evidence

- `npm run typecheck` (`tsc --noEmit`): **pass**.
- Unit tests (Node `--experimental-strip-types --test`): **11/11 pass**
  - `tests/unit/h3.test.ts`: bounds, cell conversion/resolution, centroid, invalid input/out-of-city rejection.
  - `tests/unit/radius.test.ts`: shop/people radius selection and factual messages.
- `npm run lint`: **fails** due to pre-existing errors/warnings in root and duplicate copies (`.kilo/worktrees/*`, `CivicCircle-app/*`) not introduced by this deliverable (e.g. existing `home/profile/chat` hook issues, unused vars in untouched files). Issues introduced by D3 files were fixed; no unrelated refactors performed.

## Decisions recorded (2026-11-13, pre-D4)

1. **Turnstile: ENABLE now.** Cloudflare Turnstile site + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` will be added to staging env and captcha enabled for anonymous sign-ins in Supabase. Client widget wiring in auth bootstrap, pass `captchaToken` to `signInAnonymously({ options: { captchaToken } })`, handle failure/retry states, and no-op gracefully when the site key is absent (dev). *(Not yet wired in this turn.)*
2. **Area naming: keep fallback names for MVP.** No raw coordinates stored, ever. If a manual-pick geocode result label is available, it may be used as a cached label for that cell only; otherwise fallback. Revisit after D4.
3. **Presence heartbeat: stays D5 scope.** Until then, `/nearby` updates `show_presence` via `PATCH /api/area/location` (same-origin, authenticated, rate-limited via `consume_rate_limit`, policy `areaLocationClear`) and RLS restricts updates to the signed-in user's own `profile_locations` row.
4. **Legacy route validation:** user will run on staging and report failures with endpoint/payload/exact error. Fix only regressions caused by hardening.
5. **Lint baseline (accepted for now):** 3 pre-existing lint errors in `src/` (`src/app/(app)/(tabs)/home/page.tsx:59,71`, `src/app/(app)/(tabs)/profile/page.tsx:16`, `react-hooks/set-state-in-effect`) accepted as baseline; fix after D4. Current source-only baseline: **14 problems (3 errors, 11 warnings)** with `.kilo/worktrees/**` and `CivicCircle-app/**` ignored.

## Known gaps / follow-ups (intentional for this stage)

- **Turnstile:** env vars documented; widget/token wiring pending (decision 1).
- **Area name resolution:** fallback names for MVP (decision 2); manual-pick cached label refinement optional when safe.
- **Presence heartbeat API:** `POST/DELETE /api/area/presence` and real heartbeat flow are D5; preference toggle is rate-limited and own-row only (decision 3).
- **Legacy content routes:** require authenticated sessions for writes; behavior under hardened policies to be validated on staging (decision 4).
- **Full D3 extras not built:** no dedicated profile-handle reroll API/UI, no separate consent persistence beyond area flow, and `/nearby` is a minimal setup page rather than the full experience.

## Manual test checklist (recommended on staging/dev with valid Supabase env)

1. **Auth bootstrap:** load app with clean cookies; confirm anonymous session is created and a `profiles` row exists for the user (no email/phone).
2. **Rate limiter:** trigger a rate-limited write as an authenticated user; expect 429 with `Retry-After` and friendly message from `consume_rate_limit`.
3. **Area resolve (location):** on `/nearby`, choose “Use my area”, allow geolocation in Chhatrapati Sambhajinagar; confirm request sends only `h3r8/h3r7/h3r5` (no lat/lng), `profile_locations` row stores only H3/area ids, and response returns centroid/area names.
4. **Area resolve (manual):** search via geocode, pick a result, confirm resolve succeeds and stays within city bounds.
5. **Geocode:** query with <2 chars returns 400; valid query returns bounded results and repeated query can hit cache.
6. **Nearby:** after setting area, `GET /api/area/nearby` returns `centroid`, `shops`, `people` buckets, and `showPresence`.
7. **Clear area:** “Clear my area” deletes `profile_locations` and returns to consent.
8. **Privacy:** verify no lat/lng in area request payloads; presence toggle defaults off.

## Pre-D4 verification (user-reported, 2026-11-14)

- **C (staging DB):** complete — all 3 checks passed.
  - `profile_locations`: no lat/lng, only H3/area ids ✅
  - `profile_locations` RLS: 4 policies (insert/delete/select/update), own-row only ✅
  - `consume_rate_limit`: `anon=false`, `auth=true` ✅
  - `ensure_area`: `anon=false`, `auth=false` (service_role only) ✅
- **D (staging smoke):** site loads, `/nearby` works, area picker works, clear area works ✅
- **B (build bundle):** `next build` + `.next/static` grep confirmed **zero** service-role hits ✅
- **Lint:** 3 pre-existing errors accepted as known baseline (**14 problems: 3 errors, 11 warnings**), fix in D6.
- **Password reset:** done.

## Stop point

**D4 unblocked (2026-11-14).** Deliverable 4 started per explicit approval. Stop after D4 for review; service key never client-side; no fake data.
