-- Shops come from OSM imports or community additions. No ratings,
-- reviews, or invented counters.

set search_path = public, extensions;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  osm_type text check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint,
  name text not null check (char_length(name) between 1 and 160),
  name_hi text check (char_length(name_hi) <= 160),
  category text not null check (category in (
    'food',
    'grocery',
    'pharmacy',
    'health',
    'education',
    'services',
    'repair',
    'salon',
    'hardware',
    'clothing',
    'electronics',
    'transport',
    'other'
  )),
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 40),
  website text check (
    website is null or (
      char_length(website) <= 300
      and website ~* '^https?://'
    )
  ),
  opening_hours text check (char_length(opening_hours) <= 300),
  location geography(Point, 4326) not null,
  h3_r8 text not null check (
    char_length(h3_r8) = 15
    and h3_r8 ~ '^88[0-9a-f]{13}$'
  ),
  source text not null default 'osm' check (source in ('osm', 'community')),
  source_url text check (
    source_url is null or (
      char_length(source_url) <= 500
      and source_url ~* '^https?://'
    )
  ),
  osm_tags jsonb,
  status text not null default 'published'
    check (status in ('published', 'pending', 'hidden', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  claimed_by uuid references auth.users (id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);

create index shops_location_gix on public.shops using gist (location);
create index shops_h3_r8_idx on public.shops (h3_r8);
create index shops_category_idx on public.shops (category) where status = 'published';
create index shops_status_idx on public.shops (status);

create trigger shops_set_updated_at
  before update on public.shops
  for each row
  execute function public.set_updated_at();

-- The extension may live in `extensions` (Supabase default) or `public`.
do $$
declare
  v_schema text;
begin
  select n.nspname
    into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  if v_schema is null then
    raise exception 'pg_trgm is not installed';
  end if;

  execute format(
    'create index shops_name_trgm_idx on public.shops using gin (lower(name) %I.gin_trgm_ops)',
    v_schema
  );
end
$$;

alter table public.shops enable row level security;

notify pgrst, 'reload schema';
