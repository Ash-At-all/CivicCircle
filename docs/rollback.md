# Rollback notes

This document describes practical rollback guidance for the CivicCircle hyperlocal/Nearby feature set and recent deliverables. Always take/verify backups before schema or production changes.

## Principles
- **Prefer forward fixes** for data migrations and shared environments when possible; rollback SQL can be destructive or incomplete if data has evolved.
- **Coordinate app + DB rollback:** reverting app code without compatible schema/RPC/policies (or vice versa) can cause 5xx/503/permission errors.
- **Do not run destructive rollback in production without a reviewed plan and backup/restore strategy.**

## 1. Application rollback (code/config)
1. Identify the last known-good commit/tag/build deployed to the target environment.
2. Redeploy that build (or revert commits) and confirm environment variables match that version:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - server-only `SUPABASE_SERVICE_ROLE_KEY` (never public)
   - any feature/config vars expected by that build
3. Smoke-test critical routes: `/`, `/nearby`, auth, posts/chat as applicable.
4. If rollback is partial, ensure client and server API contracts (e.g. `/api/area/*`) remain compatible.

## 2. Database rollback considerations

### General
- Supabase/Postgres migrations are applied in timestamp order from `supabase/migrations/`.
- Many migrations are additive/hardening; automatic down-migrations are **not** provided.
- If a migration caused an incident and a repair migration exists (e.g. `20261114091300_repair_shared_rate_limits.sql`, `20261114091600_repair_ensure_area_conflict.sql`, `20261114091700_repair_profile_locations_grants.sql`), prefer applying the repair/fix forward on staging first, then production.

### D5/D6-specific objects (examples)
- `20261114091500_d5_area_chat.sql`: adds `leave_room_presence` RPC and adds `public.messages` to `supabase_realtime` publication (idempotent).
- `20261114091600_repair_ensure_area_conflict.sql`: replaces `ensure_area` (ambiguous `ON CONFLICT` fix).
- `20261114091700_repair_profile_locations_grants.sql`: repairs RLS/policies/grants on `profile_locations`.

**Rollback approach:** if you must revert behavior, do it with a reviewed, explicit SQL change (new migration) rather than manual ad-hoc edits, and validate RLS/grants/functions after.

### Destructive rollback (last resort, staging only unless reviewed)
- Dropping tables/functions/publication membership can remove data or break dependent features. Any destructive script must be reviewed against current schema/data and tested on a staging clone.
- After rollback/restore, run `notify pgrst, 'reload schema';` where relevant and re-verify `supabase/tests/preflight.sql` / RLS expectations.

## 3. Feature-level mitigation (without full rollback)
- **Area resolve/chat issues:** check server logs for structured RPC/upsert errors (e.g. `ensure_area`), verify deployment points to the correctly migrated Supabase project, and confirm `consume_rate_limit`/required RPCs exist.
- **Realtime issues:** verify `supabase_realtime` publication membership and client session/RLS; clients should fall back to polling but with degraded freshness.
- **Rate limiting too aggressive:** adjust policy values via a reviewed migration/config change (D6 relaxed `areaResolve` in non-production; production tuning should be deliberate).
- **Presence/location privacy:** if a regression is suspected, disable/limit affected UI paths and verify `profile_locations` stores H3/area ids only and no direct client access to sensitive presence tables.

## 4. Post-rollback verification
- [ ] App boots and `/nearby` loads (setup, map, shops, chat tabs) as expected for the rolled-back version
- [ ] Auth/session and core APIs respond correctly
- [ ] RLS/policies/grants intact for `profile_locations`, `messages`, `room_presence`, `area_mutes`, `reports`, `user_blocks` as applicable
- [ ] Required RPCs exist and match expected signatures (`ensure_area`, `consume_rate_limit`, `heartbeat`, `leave_room_presence`, `nearby_shops`, `nearby_people`, `room_counts`, etc.)
- [ ] No `service_role` exposure in client bundles
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build`, and unit tests for the deployed revision
