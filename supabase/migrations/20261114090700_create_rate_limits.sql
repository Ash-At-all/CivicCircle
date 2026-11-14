-- Shared, atomic rate limits. The client cannot read this table and
-- cannot choose another user's key.

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null
);

create index rate_limits_expires_idx on public.rate_limits (expires_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

notify pgrst, 'reload schema';
