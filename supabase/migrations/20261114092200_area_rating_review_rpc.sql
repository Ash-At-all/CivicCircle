-- Atomic upserts for area ratings and reviews.
--
-- PostgREST's `on_conflict=merge-duplicates` writes every payload column, so
-- the column-level `update (rating)` / `update (body)` grants are not enough
-- for a plain table upsert. These functions keep the column grants narrow by
-- doing the upsert server-side with a single statement, under the caller's
-- identity (security invoker) so RLS still applies.

create or replace function public.set_area_rating(p_area_id uuid, p_rating integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.area_ratings (area_id, user_id, rating)
  values (p_area_id, (select auth.uid()), p_rating::smallint)
  on conflict (area_id, user_id) do update set rating = excluded.rating;
$$;

create or replace function public.set_area_review(p_area_id uuid, p_body text)
returns public.area_reviews
language sql
security invoker
set search_path = ''
as $$
  insert into public.area_reviews (area_id, user_id, body)
  values (p_area_id, (select auth.uid()), p_body)
  on conflict (area_id, user_id) do update set body = excluded.body
  returning *;
$$;

revoke all on function public.set_area_rating(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.set_area_review(uuid, text)
  from public, anon, authenticated;

grant execute on function public.set_area_rating(uuid, integer) to authenticated, service_role;
grant execute on function public.set_area_review(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
