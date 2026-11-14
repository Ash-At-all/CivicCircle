# Deliverable 4 notes — map & shops

**Date:** 14 November 2026  
**Scope:** Deliverable 4 as expanded: `/nearby` full-width MapLibre/OpenFreeMap map, bottom-sheet shops list, auto-radius expansion, shop cards, category filter, marker clustering, radius circle, dark style, Hindi/English label toggle, city-constrained boundary handling, low-end mobile performance. Stop after D4 for review. No Deliverable 5 work.

## What was delivered

- **`/nearby` experience (`src/app/nearby/page.tsx`)**
  - Consent/area picker flow when no area is set (existing D3 flow preserved).
  - When area is set: full-viewport map with floating area header and a bottom sheet (collapsed 46dvh / expanded 82dvh) containing the shops list.
  - Auto-radius expansion via `chooseShopRadius` (client-side over API results, steps `[0.5,1,2,5,10,25,50] km`, `MIN_SHOPS=5`) with honest radius/expansion message; user can override radius via selector.
  - People/activity message via `choosePeopleRadius` + `peopleMessage` (honest, respects presence preference state).
  - Distances shown as approximate from area centre; OpenStreetMap attribution and boundary disclaimer noted.

- **Map (`src/components/map/NearbyMap.tsx`, dynamic import, client-only)**
  - MapLibre GL JS with OpenFreeMap dark style, navigation control, compact attribution.
  - City-constrained bounds matching `CITY_BOUNDS` in `src/features/area/h3.ts` (`maxBounds`), no national boundary layer drawn by the app; base-map boundaries are explicitly not a legal claim.
  - Radius circle (fill/line) around area centroid for selected radius.
  - Shop pins as clustered GeoJSON source (cluster click expands/zooms; unclustered points rendered).
  - Hindi/English shop-label toggle (map labels + cards), `lang` attributes on names.
  - Performance options: `antialias: false`, `fadeDuration: 0`, `renderWorldCopies: false`, clustered source, dynamic import/SSR off.

- **Shops list & cards (`src/components/shops/ShopCard.tsx`, `ShopsList.tsx`, `src/features/shops/{categories,format,types}.ts`)**
  - Cards: name (+Hindi when available), category, address or “Address not listed”, distance (from area centre), call (if phone), directions link, source badge (OpenStreetMap / Added by community), hours or “Hours not listed”. No ratings/reviews/popularity/fake counts.
  - Filters/sort/search: category select, sort Nearest/Name A–Z (language-aware), text search over name/Hindi name/address (client-side over loaded results).
  - Map pin click expands the sheet, scrolls to the matching card, and highlights it.
  - Honest empty/filtered-empty states and an `aria-live` result count.

- **API tweak:** `GET /api/area/nearby` now returns `localityName` (from linked area) for display.

## Verification

- `npm run typecheck`: **pass**
- Unit tests: `node --experimental-strip-types --test tests/unit/h3.test.ts tests/unit/radius.test.ts` — **11/11 pass**
- Lint (source-only, with `.kilo/worktrees/**` and `CivicCircle-app/**` ignored): **14 problems (3 errors, 11 warnings)** — accepted pre-existing baseline (fix in D6); no new lint issues from D4 files.
- `npm run build`: **pass** (Next 16.4.2/Turbopack).
- `.next/static` service-role grep (`SERVICE_ROLE`/`service_role`/`__nearbyMap`): **zero hits**.
- Staging DB vote path: `set_post_vote` exercised end-to-end in a rolled-back transaction (vote up then remove) and `consume_rate_limit` exercised as `authenticated` (see `docs/db-notes.md`).
- Map render check (production build, headless preview page removed afterwards): base map, radius circle, both shop pins and both labels rendered; `querySourceFeatures("shops")` returned 3, rendered pin/label features returned 2 each; OpenFreeMap attribution shown; no map errors.
- Hindi/English toggle check: switching the language control changed the rendered map labels from English names to their Hindi names (`name_hi`), and back.

## Privacy / security

- No exact user lat/lng stored or sent beyond existing resolve flow; distances/centroid are area-centre based. No location history.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only (`src/lib/supabase/admin.ts`, `server-only`, not `NEXT_PUBLIC_`); no client-side service-role usage.
- No fake shops/reviews/stats; shop data comes from DB (`shops` via `nearby_shops` RPC). If no shops exist, UI states this honestly.

## Gaps / follow-ups (planned D4 items not fully completed)

- Shop detail page, corrections, claim flow (manual), photo upload/display, duplicate detection — not implemented.
- Map style customization/fallback tuning beyond OpenFreeMap dark URL, and fuller mobile bottom-sheet/tab layout per plan (current responsive grid with map + panel) — can be refined.
- Lighthouse mobile 85+ and low-end Android/3G measurement not run in this turn; performance options are in place (dynamic map import, clustered source, POI/transit layer hiding, no antialiasing/fade), but need a device/network profile run.
- MapLibre worker: the UMD build creates its worker from an inline blob; the earlier `setWorkerUrl(...)` override was removed because it resolved to a missing bundler-relative path under Next/Turbopack and would leave the map blank.
- **Map pins root cause (fixed):** the clustered source's tiles were being marked errored whenever a symbol layer was added without an explicit `text-font`. MapLibre then requests its default font stack (`Open Sans Regular` / `Arial Unicode MS Regular`), which OpenFreeMap does not serve, so glyph requests 404 and the source's tiles fail; `querySourceFeatures` returned 0 and no pins/labels rendered. Both symbol layers now set `"text-font": ["Noto Sans Regular"]` (the only stack in OpenFreeMap's dark style), and pins/labels render on a production build. Keep this in mind for any new symbol layer added to this map.
- India boundary: the map is city-constrained (`minZoom` 11 + `maxBounds` for Chhatrapati Sambhajinagar) and the app draws no national boundary layer; the base map's boundaries are labelled as not a legal claim.
- Area name may be fallback if not refined; Turnstile wiring and presence heartbeat API remain as previously decided (D3/D5).

## Manual checks suggested

- With a staging area set and published shops in DB: map loads, radius circle/clustering correct, auto-expansion message accurate, filters/sort/search work, cards show correct fields/attribution.
- With no shops in range: honest “no shops listed…” / expansion-to-50km messaging.
- Change/clear area, presence toggle (rate-limited), responsive behavior on mobile/desktop.
