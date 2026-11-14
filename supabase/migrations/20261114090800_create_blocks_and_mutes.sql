-- Blocking already exists as public.user_blocks from the posts feature.
-- Reuse it instead of creating a second block table. Muting is per area.

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id);

create table public.area_mutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, area_id)
);

alter table public.area_mutes enable row level security;
revoke all on public.area_mutes from public, anon, authenticated;

notify pgrst, 'reload schema';
