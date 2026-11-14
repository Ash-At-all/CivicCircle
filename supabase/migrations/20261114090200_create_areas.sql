-- Area hierarchy: locality (H3 res 8), ward (res 7), city (res 5).

set search_path = public, extensions;

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('locality', 'ward', 'city')),
  h3_cell text not null check (
    char_length(h3_cell) = 15
    and (
      (kind = 'locality' and h3_cell ~ '^88[0-9a-f]{13}$')
      or (kind = 'ward' and h3_cell ~ '^87[0-9a-f]{13}$')
      or (kind = 'city' and h3_cell ~ '^85[0-9a-f]{13}$')
    )
  ),
  name text not null check (char_length(name) between 1 and 80),
  name_hi text check (char_length(name_hi) <= 80),
  city_slug text not null check (char_length(city_slug) between 2 and 60),
  centroid geography(Point, 4326) not null,
  parent_id uuid references public.areas (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, h3_cell)
);

create index areas_h3_cell_idx on public.areas (h3_cell);
create index areas_parent_idx on public.areas (parent_id);
create index areas_centroid_gix on public.areas using gist (centroid);
create index areas_city_kind_idx on public.areas (city_slug, kind);

alter table public.areas enable row level security;

notify pgrst, 'reload schema';
