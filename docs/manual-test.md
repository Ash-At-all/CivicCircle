# Manual test checklist

Use on a migrated Supabase environment with required env vars configured. Record build/commit, environment (local/staging), browser/device, and pass/fail with notes.

## 0. Automated checks (pre-merge / pre-release)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` at or below accepted baseline (record count)
- [ ] `npm run build` passes
- [ ] Unit tests pass: `node --experimental-strip-types --test tests/unit/h3.test.ts tests/unit/radius.test.ts` (11/11 expected)

## 1. Auth and session basics
- [ ] App loads without server/client crashes
- [ ] Anonymous/session flow works as configured (or sign-in flow where required)
- [ ] Protected actions prompt/fail gracefully when unauthenticated

## 2. Area setup and privacy (Nearby)
- [ ] `/nearby` shows consent/setup UI when no area is set
- [ ] **Use my area** (browser geolocation) resolves to an area and loads nearby view
- [ ] **Choose area manually** (search/pick) resolves and loads nearby view
- [ ] **Change area** works and updates shops/chat context
- [ ] **Clear area** removes saved area; returning to `/nearby` requires setup again
- [ ] No exact user lat/lng is stored in `profile_locations` (H3/area ids only); no location history
- [ ] Presence toggle defaults off; toggling on/off behaves correctly and is revocable
- [ ] Presence is shown only as aggregate/honest counts (no exact user location points)

## 3. Map and shops
- [ ] Map renders (OpenFreeMap tiles/style) for Chhatrapati Sambhajinagar bounds
- [ ] Radius circle and shop markers/labels render correctly (symbol layers must use supported font stack)
- [ ] Radius selector/expansion behaves per steps `[0.5,1,2,5,10,25,50] km` with honest messages
- [ ] Empty state is honest when no shops/coverage in range
- [ ] Shop cards show available factual details only (no fake ratings/reviews/counts)
- [ ] English/Hindi label toggle works (where supported)
- [ ] Loading and error states display correctly

## 4. Area chat
- [ ] Locality/Ward/City tabs switch rooms within the user’s resolved hierarchy
- [ ] Initial load shows last messages; **Load older messages** (cursor pagination) works
- [ ] Send message works (optimistic UI) and confirms on server/realtime
- [ ] Retry works for failed sends; duplicate/idempotent retry does not create duplicates
- [ ] Offline banner/state shown when offline; reconnect resumes/polls appropriately
- [ ] Rate-limit (429) shows friendly message and recovers after wait
- [ ] Empty, loading, and error states are honest
- [ ] Room presence/count text is honest (aggregate only)
- [ ] Mute/unmute room works per scope
- [ ] Report message flow works (reason/details) and prevents invalid targets
- [ ] Block person flow works and hides blocked user’s messages in view as expected
- [ ] Realtime delivery works when available; polling fallback works when realtime unavailable

## 5. Moderation and safety APIs/UX
- [ ] Message body validation enforced server-side (length/links/blocked language) with clear errors
- [ ] Report/block/mute actions require auth and enforce same-origin/rate limits
- [ ] No service-role secrets exposed to client (`NEXT_PUBLIC_*` / built assets)

## 6. Legal and content
- [ ] Privacy Policy includes location data section (H3-only area, no exact lat/lng stored in profile location, clear area removes saved location, opt-in aggregate presence)
- [ ] Terms include area chat conduct section
- [ ] No fake stats/reviews/counters; copy remains factual

## 7. Responsive and accessibility basics
- [ ] `/nearby` usable on mobile viewport (map, bottom sheet, tabs, composer)
- [ ] Keyboard focus/labels for primary controls and dialogs
- [ ] Color/contrast and text remain readable in dark UI

## 8. Performance (point-in-time)
- [ ] Run Lighthouse mobile on `/nearby` (production build/server): record Performance, Accessibility, Best Practices, SEO and note environment/throttling
- [ ] Re-run if third-party tile/geocode services were degraded during test

## 9. Regression smoke
- [ ] Core existing flows (home/posts/chat/profile as applicable) still load without D6 regressions
- [ ] No console errors indicating broken assets/API contracts in tested flows
