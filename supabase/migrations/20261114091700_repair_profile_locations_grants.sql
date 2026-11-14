-- Repair: ensure profile_locations RLS, policies, and grants are present.
-- This matches the intended self-only access model and is idempotent.

alter table public.profile_locations enable row level security;

drop policy if exists "Users can read their own location" on public.profile_locations;
create policy "Users can read their own location"
  on public.profile_locations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own location" on public.profile_locations;
create policy "Users can add their own location"
  on public.profile_locations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own location" on public.profile_locations;
create policy "Users can update their own location"
  on public.profile_locations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can clear their own location" on public.profile_locations;
create policy "Users can clear their own location"
  on public.profile_locations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profile_locations from public, anon, authenticated;
grant select, insert, update, delete on public.profile_locations to authenticated;

notify pgrst, 'reload schema';
