-- Presence is opt-in and short-lived. No history is kept.
-- Writes go through heartbeat() and stop_presence(); reads go through
-- aggregate functions only. RLS with no policies denies direct access.

create table public.room_presence (
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  home_area_id uuid not null references public.areas (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

create index room_presence_area_seen_idx
  on public.room_presence (area_id, last_seen_at desc);
create index room_presence_home_seen_idx
  on public.room_presence (home_area_id, last_seen_at desc);
create index room_presence_seen_idx
  on public.room_presence (last_seen_at);

alter table public.room_presence enable row level security;
revoke all on public.room_presence from public, anon, authenticated;

notify pgrst, 'reload schema';
