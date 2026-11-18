-- One star rating per user per area. Ratings are real user input, so there is
-- no seed data and no synthetic average: an area with no rows shows no rating.

set search_path = public, extensions;

create table if not exists public.area_ratings (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area_id, user_id)
);

create index if not exists area_ratings_area_idx on public.area_ratings (area_id);
create index if not exists area_ratings_user_idx on public.area_ratings (user_id);

drop trigger if exists area_ratings_set_updated_at on public.area_ratings;
create trigger area_ratings_set_updated_at
  before update on public.area_ratings
  for each row
  execute function public.set_updated_at();

alter table public.area_ratings enable row level security;

drop policy if exists "Signed-in users can read area ratings" on public.area_ratings;
create policy "Signed-in users can read area ratings"
  on public.area_ratings
  for select
  to authenticated
  using (true);

drop policy if exists "Users can rate an area as themselves" on public.area_ratings;
create policy "Users can rate an area as themselves"
  on public.area_ratings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can change their own area rating" on public.area_ratings;
create policy "Users can change their own area rating"
  on public.area_ratings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.area_ratings from public, anon, authenticated;
grant select on public.area_ratings to authenticated;
grant insert (area_id, user_id, rating) on public.area_ratings to authenticated;
grant update (rating) on public.area_ratings to authenticated;
grant all on public.area_ratings to service_role;

notify pgrst, 'reload schema';
