# Deliverable 5 notes: area chat + safety

Date: 2026-11-14
Scope: area messages API, room-scoped realtime/polling chat, presence heartbeat, mute/block/report actions, and `/nearby` chat tab. No D6 work.

## Delivered

- **Migration:** `supabase/migrations/20261114091500_d5_area_chat.sql`
  - `leave_room_presence(p_area_id uuid)` security definer, `authenticated` execute only. Removes only the requested room row from `room_presence` and does **not** change `show_presence`, so switching rooms does not silently opt the user out.
  - Adds `public.messages` to the `supabase_realtime` publication idempotently when that publication exists. RLS still applies to `postgres_changes`.
  - `notify pgrst, 'reload schema'`.
- **Chat helpers:** `src/features/area/chat.ts` (scope/types, cursor encode/decode, room-count copy, scope labels, message validation with 500-char limit, max 2 links, and blocked-language filter), `src/lib/server/area-scope.ts` (resolve caller's own area ids/scope cell from `profile_locations`).
- **Rate limits:** `enforceRateLimit` accepts an optional scope key so per-room actions can be keyed as `${policy.action}:${areaId}` (used for `areaMessagesRead`, `areaMessageSend`, `areaMute`).
- **Area messages API:** `GET/POST /api/area/messages`
  - `GET ?scope=locality|ward|city&cursor=...`: auth required, resolves caller's own area ids, per-room read rate limit, returns newest-first page mapped to chronological order (last 50), keyset cursor (`created_at|id`), `roomCount` from `room_counts`, `muted` state, and viewer handle.
  - `POST {scope, body, clientId}`: same-origin, auth, per-room send rate limit, server-side body/link/slur checks, server-set `author_handle` from profile, idempotent retry via existing `(author_id, client_id)` unique index (returns existing row on 23505).
- **Presence API:** `POST/DELETE /api/area/presence`
  - `POST {scope}`: same-origin, auth, resolves scope room in caller's own hierarchy, requires `show_presence` on, calls `heartbeat(p_area_id)` (DB enforces allowed room + `presence-heartbeat` limit). Friendly 409/429/403 mapping.
  - `DELETE ?scope=...`: same-origin, auth, calls `leave_room_presence` for that room only.
- **Mute API:** `GET/POST/DELETE /api/area/mute`
  - Own-row `area_mutes` per scope in caller's area hierarchy, same-origin on writes, `areaMute` rate limit on writes.
- **Moderation APIs:**
  - `POST /api/reports` now accepts `type: "message"` (same-origin). For messages it uses `areaReport`, verifies the target message is readable in the caller's own area rooms and not deleted, and inserts `message_id`. Duplicate reports return 409. Existing post/comment/moderator flows preserved.
  - `GET/POST/DELETE /api/blocks` now accept `username` or `userId` (same-origin on writes, `areaBlock` on writes). Supports chat-author blocking by user id while keeping username-based blocking; responses include `userId`/`username`/`name` where available.
- **UI:** `src/components/area/area-chat.tsx` in `/nearby` bottom sheet (`Shops` | `Chat` tabs, chat auto-expands sheet).
  - Locality/ward/city scope tabs, initial load + "Load older messages" cursor pagination, optimistic send with retry for failed sends, per-room mute toggle, honest room presence line from `room_counts`.
  - Realtime `postgres_changes` subscription per active `area_id` with 12s polling fallback/refresh; offline banner and reconnect refresh; friendly 429/error/empty states.
  - Presence heartbeat every 60s while opted in, online, and visible; room leave on scope change/unmount via `leave_room_presence` (preference unchanged). Presence preference toggle remains on the Shops panel.
  - Message actions: report (reason + optional details) and block person (removes blocked author's visible messages immediately; server/RLS enforce hiding on reload).

## Privacy and safety

- No exact user lat/lng stored or sent by chat/presence flows; scope is derived from the caller's stored H3 res 8 location and mapped to their own locality/ward/city area ids.
- Room counts are aggregate-only (`room_counts`/`room_presence` not directly readable). No fake presence numbers.
- Service key is not used client-side and no `NEXT_PUBLIC_*` service-role values are introduced.
- Same-origin checks on state-changing area chat/mute/presence/report/block routes; shared Postgres rate limits for reads/sends/mutes/reports/blocks.
- Message body validation is server-side (trim, 500 chars, max 2 links, blocked-language filter). UI enforces max length but server remains authoritative.

## Verification

- `npm run typecheck`: **pass**.
- `npm run lint`: **14 problems (3 errors, 11 warnings)** - unchanged pre-existing baseline; no new lint issues introduced by D5 files.
- Unit tests: `node --experimental-strip-types --test tests/unit/h3.test.ts tests/unit/radius.test.ts` - **11/11 pass**.
- `npm run build`: **pass** (Next 16.4.2/Turbopack). `/api/area/messages`, `/api/area/presence`, `/api/area/mute` are dynamic routes.
- `.next/static` grep for `service_role` / `SERVICE_ROLE` / `__nearbyMap`: **no matches**.

## Notes / follow-up (not in D5)

- Migration `20261114091500_d5_area_chat.sql` must be applied to the target Supabase project and `supabase_realtime` publication must be available for live inserts; the client falls back to polling when realtime is unavailable.
- Realtime subscriptions depend on browser auth/session cookies and RLS visibility of `messages`; staging/production verification should confirm live delivery, pagination, mute/report/block effects, and heartbeat/count behavior with real users/sessions.
- Existing lint baseline remains for D6 cleanup.
- Turnstile client widget/token wiring remains pending user keys (prior decision).
