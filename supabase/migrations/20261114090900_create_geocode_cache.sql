-- Server-only cache for Photon and Nominatim. The cache key is a cell
-- or a normalised query hash, never raw coordinates.

create table public.geocode_cache (
  key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index geocode_cache_expires_idx on public.geocode_cache (expires_at);

alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from public, anon, authenticated;

notify pgrst, 'reload schema';
