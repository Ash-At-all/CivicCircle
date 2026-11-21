-- Shop reviews: one text review per authenticated user per shop, editable by author.
-- No seeded rows, no invented handles. Handles come from profiles at read time.

set search_path = public, extensions;

create table if not exists public.shop_reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (
    char_length(body) <= 300
    and char_length(btrim(body)) > 0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create index if not exists shop_reviews_shop_created_idx
  on public.shop_reviews (shop_id, created_at desc);
create index if not exists shop_reviews_user_idx on public.shop_reviews (user_id);

drop trigger if exists shop_reviews_set_updated_at on public.shop_reviews;
create trigger shop_reviews_set_updated_at
  before update on public.shop_reviews
  for each row
  execute function public.set_updated_at();

alter table public.shop_reviews enable row level security;

drop policy if exists "Signed-in users can read shop reviews" on public.shop_reviews;
create policy "Signed-in users can read shop reviews"
  on public.shop_reviews
  for select
  to authenticated
  using (true);

drop policy if exists "Users can review a shop as themselves" on public.shop_reviews;
create policy "Users can review a shop as themselves"
  on public.shop_reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can edit their own shop review" on public.shop_reviews;
create policy "Users can edit their own shop review"
  on public.shop_reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.shop_reviews from public, anon, authenticated;
grant select on public.shop_reviews to authenticated;
grant insert (shop_id, user_id, body) on public.shop_reviews to authenticated;
grant update (body) on public.shop_reviews to authenticated;
grant all on public.shop_reviews to service_role;

notify pgrst, 'reload schema';