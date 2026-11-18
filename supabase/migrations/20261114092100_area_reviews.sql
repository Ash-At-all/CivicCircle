-- One text review per user per area, editable by the author.
-- Reviews are user text only: no seeded rows, no invented handles.
-- The ghost handle shown in the UI comes from profiles at read time.

set search_path = public, extensions;

create table if not exists public.area_reviews (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (
    char_length(body) <= 500
    and char_length(btrim(body)) > 0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area_id, user_id)
);

create index if not exists area_reviews_area_created_idx
  on public.area_reviews (area_id, created_at desc);
create index if not exists area_reviews_user_idx
  on public.area_reviews (user_id);

drop trigger if exists area_reviews_set_updated_at on public.area_reviews;
create trigger area_reviews_set_updated_at
  before update on public.area_reviews
  for each row
  execute function public.set_updated_at();

alter table public.area_reviews enable row level security;

drop policy if exists "Signed-in users can read area reviews" on public.area_reviews;
create policy "Signed-in users can read area reviews"
  on public.area_reviews
  for select
  to authenticated
  using (true);

drop policy if exists "Users can review an area as themselves" on public.area_reviews;
create policy "Users can review an area as themselves"
  on public.area_reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can edit their own area review" on public.area_reviews;
create policy "Users can edit their own area review"
  on public.area_reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.area_reviews from public, anon, authenticated;
grant select on public.area_reviews to authenticated;
grant insert (area_id, user_id, body) on public.area_reviews to authenticated;
grant update (body) on public.area_reviews to authenticated;
grant all on public.area_reviews to service_role;

-- Reviews become a report target, using the existing reports table.
alter table public.reports
  add column if not exists review_id uuid references public.area_reviews (id) on delete cascade;

alter table public.reports drop constraint if exists reports_one_target;
alter table public.reports
  add constraint reports_one_target
  check (
    (post_id is not null)::integer
    + (comment_id is not null)::integer
    + (message_id is not null)::integer
    + (shop_id is not null)::integer
    + (target_user_id is not null)::integer
    + (review_id is not null)::integer = 1
  );

create index if not exists reports_review_idx on public.reports (review_id);

grant insert (review_id) on public.reports to authenticated;

notify pgrst, 'reload schema';
