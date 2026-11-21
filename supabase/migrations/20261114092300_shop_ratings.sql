-- Shop ratings: one rating per authenticated user per shop.
-- No seeded or synthetic data; empty shops show no rating.

set search_path = public, extensions;

create table if not exists public.shop_ratings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create index if not exists shop_ratings_shop_idx on public.shop_ratings (shop_id);
create index if not exists shop_ratings_user_idx on public.shop_ratings (user_id);

drop trigger if exists shop_ratings_set_updated_at on public.shop_ratings;
create trigger shop_ratings_set_updated_at
  before update on public.shop_ratings
  for each row
  execute function public.set_updated_at();

alter table public.shop_ratings enable row level security;

drop policy if exists "Signed-in users can read shop ratings" on public.shop_ratings;
create policy "Signed-in users can read shop ratings"
  on public.shop_ratings
  for select
  to authenticated
  using (true);

drop policy if exists "Users can rate a shop as themselves" on public.shop_ratings;
create policy "Users can rate a shop as themselves"
  on public.shop_ratings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can change their own shop rating" on public.shop_ratings;
create policy "Users can change their own shop rating"
  on public.shop_ratings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.shop_ratings from public, anon, authenticated;
grant select on public.shop_ratings to authenticated;
grant insert (shop_id, user_id, rating) on public.shop_ratings to authenticated;
grant update (rating) on public.shop_ratings to authenticated;
grant all on public.shop_ratings to service_role;

notify pgrst, 'reload schema';