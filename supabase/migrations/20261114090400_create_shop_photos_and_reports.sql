-- Shop photos and shop data reports (corrections, duplicates, claims,
-- closed places). Abuse reports stay in public.reports.

create table public.shop_photos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  storage_path text not null unique,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create index shop_photos_shop_idx on public.shop_photos (shop_id, created_at desc);

create table public.shop_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('correction', 'duplicate', 'claim', 'closed', 'wrong_location')),
  field text check (char_length(field) <= 40),
  note text not null check (char_length(note) between 3 and 1000),
  contact text check (char_length(contact) <= 160),
  status text not null default 'open'
    check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index shop_reports_shop_idx on public.shop_reports (shop_id, created_at desc);
create index shop_reports_open_idx on public.shop_reports (created_at desc) where status = 'open';
create index shop_reports_user_idx on public.shop_reports (user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-photos',
  'shop-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Paths are <shop_id>/<user_id>/<uuid>.jpg so ownership is visible in the
-- object name and does not depend on storage columns changing between versions.
drop policy if exists "Anyone can read shop photos" on storage.objects;
create policy "Anyone can read shop photos"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'shop-photos');

drop policy if exists "Signed-in users upload shop photos" on storage.objects;
create policy "Signed-in users upload shop photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists "Users can delete their own shop photos" on storage.objects;
create policy "Users can delete their own shop photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

alter table public.shop_photos enable row level security;
alter table public.shop_reports enable row level security;

notify pgrst, 'reload schema';
