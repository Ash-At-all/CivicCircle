-- Repair: restore the intended RPC execution grants after the production
-- migrations were applied. This is safe to run more than once.
--
-- ensure_area is server-only. The API route calls it with the service role,
-- so browsers (anon/authenticated) must not be able to execute it.
--
-- All user-facing RPCs are called through a user session and must remain
-- executable by authenticated only.

-- ---------------------------------------------------------------------------
-- ensure_area: service_role only
-- ---------------------------------------------------------------------------
revoke all on function public.ensure_area(
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  uuid
) from public, anon, authenticated;

grant execute on function public.ensure_area(
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- consume_rate_limit: authenticated only
-- ---------------------------------------------------------------------------
revoke all on function public.consume_rate_limit(
  text,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.consume_rate_limit(
  text,
  integer,
  integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Nearby and room RPCs: authenticated only
-- ---------------------------------------------------------------------------
revoke all on function public.nearby_shops(
  double precision,
  double precision,
  integer
) from public, anon, authenticated;

grant execute on function public.nearby_shops(
  double precision,
  double precision,
  integer
) to authenticated;

revoke all on function public.nearby_people(
  double precision,
  double precision
) from public, anon, authenticated;

grant execute on function public.nearby_people(
  double precision,
  double precision
) to authenticated;

revoke all on function public.room_counts(uuid[])
  from public, anon, authenticated;

grant execute on function public.room_counts(uuid[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- Presence and message RPCs: authenticated only
-- ---------------------------------------------------------------------------
revoke all on function public.heartbeat(uuid)
  from public, anon, authenticated;

grant execute on function public.heartbeat(uuid)
  to authenticated;

revoke all on function public.leave_room_presence(uuid)
  from public, anon, authenticated;

grant execute on function public.leave_room_presence(uuid)
  to authenticated;

revoke all on function public.stop_presence()
  from public, anon, authenticated;

grant execute on function public.stop_presence()
  to authenticated;

revoke all on function public.delete_message(uuid)
  from public, anon, authenticated;

grant execute on function public.delete_message(uuid)
  to authenticated;

notify pgrst, 'reload schema';
