# Database deliverable notes

**Date:** 13 November 2026  
**Scope:** Deliverable 2, database foundation only. No app code is wired to these tables yet.  
**Plan:** `docs/plan.md`  
**Research:** `docs/research.md`

---

## Migration order

| File | Purpose |
|---|---|
| `20261114090000_harden_existing_policies.sql` | Removes the open `posts`, `messages`, and `post_comments` policies and grants; restores author checks, avatar storage policies, and author foreign keys as `NOT VALID`. |
| `20261114090100_extensions_and_helpers.sql` | Enables PostGIS and pg_trgm in `extensions`; adds `in_city_bounds`. |
| `20261114090200_create_areas.sql` | Area hierarchy with H3 resolution checks. |
| `20261114090250_create_profile_locations.sql` | Self-only current area, opt-in presence, hierarchy validation trigger. |
| `20261114090300_create_shops.sql` | Shops, categories, trigram index, URL checks, updated-at trigger. |
| `20261114090400_create_shop_photos_and_reports.sql` | Photo metadata, corrections and claims, storage bucket and policies. |
| `20261114090500_alter_messages_for_areas.sql` | Area columns, soft-delete constraint, area indexes, client-id idempotency. |
| `20261114090550_alter_reports_for_areas.sql` | Message, shop, and user targets; one-target constraint. |
| `20261114090600_create_presence.sql` | `room_presence`, no direct client access. |
| `20261114090700_create_rate_limits.sql` | Shared rate-limit table, no direct client access. |
| `20261114090800_create_blocks_and_mutes.sql` | Reuses `user_blocks`; adds `area_mutes`. |
| `20261114090900_create_geocode_cache.sql` | Server-only geocode cache. |
| `20261114091000_create_rpc_functions.sql` | Rate limit, area upsert, nearby shops and people, room counts, presence, soft delete. |
| `20261114091100_rls_and_grants.sql` | Final RLS policies and column grants. |
| `20261114091200_seed_sambhajinagar.sql` | Seeded city area only. No fake shops. |
| `20261114091300_repair_shared_rate_limits.sql` | Idempotent repair for `rate_limits` + `consume_rate_limit` (missing-table/function or stale PostgREST cache), grants, and schema reload. |

`supabase/seed.sql` no longer inserts into the nonexistent `cities` table. It documents that base data is in migrations and real shops come from the weekly OSM import.

---

## Deliberate changes from the plan

1. **`user_blocks` is reused instead of creating `blocks`.**
   The table already exists with a safe own-row policy and grants. A second block table would duplicate state. All new functions and policies use `public.user_blocks`.

2. **`ensure_area` is service-role only.**
   A browser could otherwise pass its exact coordinates as an area centroid. The route will validate the H3 cell, compute the centroid with `h3-js`, apply the `area-create` rate limit with the user session, and then call `ensure_area` with the server-only service client. The service key stays on the server. This is a stronger privacy guarantee than the plan's authenticated RPC.

3. **Area messages are readable only in the caller's own locality, ward, or city.**
   The plan's sample policy allowed any authenticated user to read any area message. The implemented policy checks `profile_locations` and the caller's block list.

4. **Shop photo paths include the user id.**
   Paths are `<shop_id>/<user_id>/<uuid>.<ext>`. This lets storage policies prove ownership without depending on storage columns that differ between Supabase versions.

5. **H3 resolution is checked in the database.**
   The second hex character of an H3 cell is its resolution. Locality cells must match `^88`, wards `^87`, cities `^85`, and shop or profile cells must be res 8. This stops a direct caller from storing a wrong-resolution cell even if the route has a bug.

6. **Author foreign keys are restored as `NOT VALID`.**
   `remove_auth` dropped them. New writes are checked immediately, while legacy rows with missing authors do not block the migration.

---

## Privacy invariants enforced here

- `profile_locations` stores only `h3_r8` and area ids. There is no latitude or longitude column.
- `areas.centroid` is the cell centroid supplied by the server route, not a user point.
- `shops.location` is a public business location, never a user location.
- `room_presence` has RLS enabled and no client policies. Reads are aggregate-only through `nearby_people` and `room_counts`.
- Presence is opt-in (`show_presence` default `false`) and expires after 90 seconds.
- `rate_limits` and `geocode_cache` have no client access.
- `anon` has no write access to any post, comment, message, shop, report, or area table.

---

## Verification performed

- Every new SQL file and `supabase/tests/rls.sql` parsed with `pglast` (PostgreSQL grammar) without syntax errors.
- Manual review of policy recursion, function `search_path`, variable/column ambiguity, grant coverage, and H3 resolution checks.
- The SQL tests cover profile-location isolation, message impersonation, anonymous writes, block filtering, presence reads, room counts, rate limiting, community shop ownership, `ensure_area` access, and the city bounds.

**Not run:** the migrations were not applied to a database. This machine has no Docker, no local Postgres, and no database password or linked Supabase project. The repository's `.env.local` has a project URL and anon key only, which is not enough to push migrations and is not a staging credential.

**Required before calling this done:** run the migrations and `supabase/tests/rls.sql` against the staging project. Do not push to production until that passes.

---

## Review summary

### Tables, RLS status, policies, and grants (after `2026111409*`)

`RLS` = `ENABLE ROW LEVEL SECURITY` is set. `Policies: none` means direct client access is denied by RLS unless a security-definer RPC is used.

| Table | RLS | Policies (role → command → rule) | Table grants (role) |
|---|---|---|---|
| `public.areas` | On | `authenticated` → `select` → `using (true)` | `authenticated`: `select` |
| `public.profile_locations` | On | `authenticated` → `select` → own row (`auth.uid() = user_id`); `insert` → own row; `update` → own row (`using` + `with check`); `delete` → own row | `authenticated`: `select`, `insert(user_id,h3_r8,locality_area_id,ward_area_id,city_area_id,show_presence)`, `update(h3_r8,locality_area_id,ward_area_id,city_area_id,show_presence)`, `delete` |
| `public.shops` | On | `authenticated` → `select` → `status = 'published'`; `insert` → `source='community' and status='published' and created_by = auth.uid()` | `authenticated`: `select`, `insert(name,name_hi,category,address,phone,website,opening_hours,location,h3_r8,source,source_url,osm_tags,created_by)` |
| `public.shop_photos` | On | `authenticated` → `select` → photo and shop published; `insert` → own `uploaded_by`, published photo on published shop; `delete` → own `uploaded_by` | `authenticated`: `select`, `insert(shop_id,storage_path,width,height,uploaded_by)`, `delete` |
| `public.shop_reports` | On | `authenticated` → `select` → own row (`user_id`); `insert` → own row | `authenticated`: `select`, `insert(shop_id,user_id,kind,field,note,contact)` |
| `public.messages` | On | `authenticated` → `select` → `area_id` in caller’s locality/ward/city (`profile_locations`) and author not blocked (`user_blocks`); `insert` → own `author_id`, `area_id` in caller’s areas, `deleted_at is null` (no direct client `update`/`delete`; removal is via `delete_message` RPC) | `authenticated`: `select`, `insert(area_id,scope,h3_cell,client_id,author_id,author_handle,body)` |
| `public.room_presence` | On | none (direct access denied) | none (reads/writes only via `nearby_people`, `room_counts`, `heartbeat`, `stop_presence`) |
| `public.rate_limits` | On | none | none (security-definer functions only) |
| `public.area_mutes` | On | `authenticated` → `select`/`insert`/`delete` → own row (`user_id`) | `authenticated`: `select`, `insert(user_id,area_id)`, `delete` |
| `public.geocode_cache` | On | none | none (server-only) |
| `public.user_blocks` | On | pre-existing: `authenticated` → manage own rows (`blocker_id = auth.uid()` for all commands); RLS re-enabled in `20261114091100` | pre-existing: `authenticated` `select(blocker_id,blocked_id,created_at)`, `insert(blocker_id,blocked_id)`, `delete` |
| `public.posts` (hardened) | On | `anon, authenticated` → `select` → `using (true)`; `authenticated` → `insert`/`update`/`delete` → own `author_id` | `anon`: `select(id,city_slug,tag,title,body,image_paths,created_at,updated_at)`; `authenticated`: `select`, `insert/update(city_slug,tag,title,body,image_paths)`, `delete` |
| `public.post_comments` (hardened) | On | pre-existing `Anyone can read post comments` (`anon, authenticated`, `select`) remains; `authenticated` → `insert`/`update`/`delete` → own `author_id` (set in `20261114090000`) | `anon, authenticated`: `select(id,post_id,parent_id,body,created_at)`; `authenticated`: `insert(post_id,parent_id,author_id,body)`, `update(body)`, `delete` |

Storage policies added/tightened by these migrations: `avatars` readable by `anon, authenticated`, writable/updatable/deletable only by the owning authenticated user in their folder; `shop-photos` readable by `anon, authenticated`, insert/delete only by the owning authenticated user under `<shop_id>/<user_id>/...` (`jpg/jpeg/png/webp`).

### Tables with direct `anon` access

- **`public.posts`**: `anon` has `SELECT` (public columns) and a `SELECT` RLS policy. No `INSERT/UPDATE/DELETE`.
- **`public.post_comments`**: `anon` has `SELECT` and a read policy. No `INSERT/UPDATE/DELETE`.
- **All area tables created by this deliverable** (`areas`, `profile_locations`, `shops`, `shop_photos`, `shop_reports`, `messages` as used for areas, `room_presence`, `rate_limits`, `area_mutes`, `geocode_cache`): `anon` has **no direct table grants and no policies**. Storage read for `avatars` and `shop-photos` is allowed to `anon` by storage policies (public assets), not table access.

### `SECURITY DEFINER` functions

Every definer function sets `search_path = public, extensions` and validates the caller or is server-only.

| Function | Why `SECURITY DEFINER` is required |
|---|---|
| `public.validate_profile_location()` (trigger) | Runs during `profile_locations` writes to read `areas` and enforce hierarchy/H3 consistency regardless of the row’s RLS visibility. |
| `public.consume_rate_limit(p_action, p_limit, p_window_seconds)` | Atomically reads/writes `public.rate_limits`, which has RLS on and no client policies/grants. Key is derived from `auth.uid()` so callers cannot choose another user’s bucket. |
| `public.ensure_area(...)` | Upserts `public.areas` (clients cannot insert areas) using server-validated H3 centroid data. **Executable only by `service_role`** (revoked from `public, anon, authenticated`) so the browser cannot submit coordinates. |
| `public.nearby_people(p_lat, p_lng)` | Aggregates other users’ `room_presence` and `areas`; table is inaccessible to clients. Returns counts only, excludes caller and blocked users. |
| `public.room_counts(p_area_ids)` | Aggregates `room_presence` across a room; table is inaccessible to clients. Restricted to the caller’s own locality/ward/city, excludes caller and blocked users, returns counts only. |
| `public.heartbeat(p_area_id)` | Validates opt-in, allowed area, and rate limit, then upserts/deletes `room_presence` (no direct client access). |
| `public.stop_presence()` | Clears `show_presence` and deletes the caller’s `room_presence` rows (no direct client access). |
| `public.delete_message(p_id)` | Soft-deletes only the caller’s own message by clearing body and setting `deleted_at`; clients have no direct `UPDATE` grant on `messages`. |

`in_city_bounds` and `nearby_shops` are not `SECURITY DEFINER` (`IMMUTABLE` and `SECURITY INVOKER` respectively).

---

## Staging apply and RLS test steps

**Rule:** `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be placed in client code or any `NEXT_PUBLIC_` variable.

### Apply the migrations (choose one)

**Option A — Supabase CLI (single apply command), recommended if the project is linked**

1. Link the staging project once (project ref from the Supabase dashboard URL; do not use production):
   ```powershell
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```
2. Apply all pending local migrations in filename order:
   ```powershell
   npx supabase db push
   ```
   `db push` applies migrations under `supabase/migrations/` that are not yet recorded remotely. These are `20261114090000` through `20261114091200`.

**Option B — SQL Editor (manual, in order)**

1. Open staging project → **SQL Editor**.
2. Run each file below **separately, in this exact order** (each file must finish before the next):
   `20261114090000_harden_existing_policies.sql`, `20261114090100_extensions_and_helpers.sql`, `20261114090200_create_areas.sql`, `20261114090250_create_profile_locations.sql`, `20261114090300_create_shops.sql`, `20261114090400_create_shop_photos_and_reports.sql`, `20261114090500_alter_messages_for_areas.sql`, `20261114090550_alter_reports_for_areas.sql`, `20261114090600_create_presence.sql`, `20261114090700_create_rate_limits.sql`, `20261114090800_create_blocks_and_mutes.sql`, `20261114090900_create_geocode_cache.sql`, `20261114091000_create_rpc_functions.sql`, `20261114091100_rls_and_grants.sql`, `20261114091200_seed_sambhajinagar.sql`.
3. To create one pasteable file locally (no DB changes), run:
   ```powershell
   Get-ChildItem supabase\migrations\2026111409*.sql | Sort-Object Name | Get-Content -Raw | Set-Content -Encoding utf8 supabase\migrations\_apply_20261114.sql
   ```
   Review the combined file, run it in the SQL Editor, then delete the temporary file.

### Run `supabase/tests/rls.sql`

The script wraps itself in `BEGIN` … `ROLLBACK` and creates temporary auth fixtures, so it leaves no committed data.

**psql (exact):**
```powershell
psql "<STAGING_DATABASE_URL>" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```
Use the staging database connection string from Supabase project settings (Database → Connection string). Do not run against production.

**SQL Editor:** paste/run the full contents of `supabase/tests/rls.sql` as one execution. `ROLLBACK` at the end discards all test rows.

### Pass criteria

- The run exits successfully (psql exit code `0`, or the SQL Editor reports success with no error).
- The final result row is: `RLS tests passed`.
- No `ASSERT FAILED: ...` exception, no permission error, no constraint error, and no `syntax error`.
- Because the script rolls back, re-running it should produce the same pass result without leaving fixture rows behind.

If anything fails, send the exact error output and the migration/test statement that failed. I will start Deliverable 3 only after your staging apply + `rls.sql` pass result.

---

## Staging verification - 2026-11-13

- **Target:** staging database (confirmed different from main; project ref/URL not recorded here).
- **Migrations:** root `supabase/migrations/` files `20261022171000`–`20261114091200` applied in timestamp order (single ordered run with `ON_ERROR_STOP=1`).
- **Seed:** `supabase/seed.sql` applied with `ON_ERROR_STOP=1`.
- **RLS tests:** `supabase/tests/rls.sql` passed — exit success, final row `RLS tests passed`, no `ASSERT FAILED`; script rolled back.
- **Verification queries (6a–d):** reported clear by user (no secrets captured in this document).
- **Anon probe (7):** `SET LOCAL role = anon; INSERT INTO messages (body) VALUES ('hack test');` failed with `permission denied for table messages` (anon insert correctly denied). User-reported run used `-v ON_ERROR_STOP=1`; command errored as expected.
- **Temp artifact:** `supabase/.temp/all_migrations.sql` removed locally.

**Ready for Deliverable 3** (pending your explicit approval). No Deliverable 3 work started.

---

## Staging verification - 2026-11-14 (votes 503 / rate limiter repair)

**Reported issue:** `PUT /api/posts/:id/votes` returned 503 on staging.

**What was checked against the staging database (`.env.staging.local`, project ref redacted):**

- `psql` exists at `C:\Program Files\PostgreSQL\18\bin\psql.exe` (not on PATH).
- `rate_limits`, `post_votes`, `posts`, `profile_locations` exist.
- `consume_rate_limit(p_action text, p_limit integer, p_window_seconds integer)` exists as `SECURITY DEFINER` with `search_path=public, extensions`.
- `consume_rate_limit` executed successfully as `authenticated` (fake JWT claims, rolled back), returning `allowed=true`.
- `set_post_vote(uuid, smallint)` exists and executed end-to-end in a rolled-back transaction: created a temporary anonymous `auth.users` row + post, voted `1`, then removed the vote (`score 1 -> 0`). No fixture rows left behind.
- `authenticated` can execute `consume_rate_limit` and `set_post_vote`; `anon` cannot execute `consume_rate_limit`.

**Staging data state:** `auth.users = 0`, `profiles = 0`, `posts = 0`, `profile_locations = 0`, `rate_limits = 0`. The smoke session that saw the 503 was therefore **not using this staging database**. A read-only REST probe of the project referenced by `.env.local` returned `PGRST205` for `rate_limits` (table missing from that project), which is the expected cause of the 503 when a deployment uses that configuration: `enforceRateLimit` runs before `set_post_vote` and returns 503 when `consume_rate_limit` is missing.

**Repair applied to staging:** `20261114091300_repair_shared_rate_limits.sql` (idempotent) + `notify pgrst, 'reload schema'`. Preflight `supabase/tests/preflight.sql` now prints PASS for table, function, grants, RLS, and the authenticated limiter smoke test.

**Deployment action required:** ensure the deployed staging app's `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` point at the same project where the migrations are applied, or apply the D2 migrations (including `20261114091300`) to the project the app actually uses, then redeploy. The route now logs the PostgREST error code and returns `code: "rate_limit_unavailable"` instead of a generic 503.

---

## Next deliverable prerequisites

- Replace the placeholder Supabase clients in `src/lib/supabase/`.
- Add `SUPABASE_SERVICE_ROLE_KEY` to server-only environment configuration. Never expose it as `NEXT_PUBLIC_`.
- Build `/api/area/resolve` so it validates cells, computes centroids, rate-limits, and calls `ensure_area` with the service client.
- Replace the in-memory rate limiter with the `consume_rate_limit` wrapper.
- Add `h3-js` and `maplibre-gl` only when their screens are built, with the sizes already listed in the plan.

---

## Rollback outline

The new tables can be dropped in reverse dependency order:

```sql
drop table if exists public.geocode_cache;
drop table if exists public.area_mutes;
drop table if exists public.rate_limits;
drop table if exists public.room_presence;
drop table if exists public.shop_reports;
drop table if exists public.shop_photos;
drop table if exists public.shops;
drop table if exists public.profile_locations;
drop table if exists public.areas;
```

Do not roll back the policy hardening to the open `remove_auth` policies. If the hardening migration must be undone, restore the previous policies from the repository history only on a throwaway database. On production, restore from a backup instead of reopening write access.
