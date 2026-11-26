-- Multi-city support, Phase 1: Maharashtra launch cities.
--
-- City boxes are approximate. They are not official boundaries. The same
-- values live in src/features/area/cities.ts and scripts/import-osm-shops.ts
-- uses the TypeScript list for its import bounding boxes.

set search_path = public, extensions;

create table if not exists public.city_configs (
  slug text primary key check (char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 1 and 80),
  name_hi text check (char_length(name_hi) <= 80),
  lat_min double precision not null,
  lat_max double precision not null,
  lng_min double precision not null,
  lng_max double precision not null,
  centroid_lat double precision not null,
  centroid_lng double precision not null,
  h3_r5 text not null unique check (h3_r5 ~ '^85[0-9a-f]{13}$'),
  created_at timestamptz not null default now(),
  constraint city_configs_bounds_check check (lat_min < lat_max and lng_min < lng_max),
  constraint city_configs_centroid_check check (
    centroid_lat between lat_min and lat_max
    and centroid_lng between lng_min and lng_max
  )
);

alter table public.city_configs enable row level security;

drop policy if exists city_configs_read on public.city_configs;
create policy city_configs_read on public.city_configs
  for select to anon, authenticated
  using (true);

revoke all on public.city_configs from public, anon, authenticated;
grant select on public.city_configs to anon, authenticated;
grant all on public.city_configs to service_role;

insert into public.city_configs (
  slug, name, name_hi,
  lat_min, lat_max, lng_min, lng_max,
  centroid_lat, centroid_lng, h3_r5
)
values
  (
    'sambhajinagar',
    'Chhatrapati Sambhajinagar',
    'छत्रपती संभाजीनगर',
    19.75, 20.05, 75.25, 75.55,
    19.949389927734455, 75.37063270084657,
    '85609c37fffffff'
  ),
  (
    'pune',
    'Pune',
    'पुणे',
    18.40, 18.65, 73.75, 74.05,
    18.5204, 73.8567,
    '85608853fffffff'
  ),
  (
    'mumbai',
    'Mumbai',
    'मुंबई',
    18.90, 19.30, 72.75, 73.05,
    19.0760, 72.8777,
    '85608b57fffffff'
  ),
  (
    'nagpur',
    'Nagpur',
    'नागपूर',
    21.05, 21.25, 78.95, 79.25,
    21.1458, 79.0882,
    '85609613fffffff'
  ),
  (
    'nashik',
    'Nashik',
    'नाशिक',
    19.95, 20.10, 73.70, 73.90,
    19.9975, 73.7898,
    '856099a3fffffff'
  )
on conflict (slug) do update
  set name = excluded.name,
      name_hi = excluded.name_hi,
      lat_min = excluded.lat_min,
      lat_max = excluded.lat_max,
      lng_min = excluded.lng_min,
      lng_max = excluded.lng_max,
      centroid_lat = excluded.centroid_lat,
      centroid_lng = excluded.centroid_lng,
      h3_r5 = excluded.h3_r5;

-- Two-argument form: is this point inside any supported city?
create or replace function public.in_city_bounds(
  p_lat double precision,
  p_lng double precision
)
returns boolean
language sql
stable
parallel safe
as $$
  select exists (
    select 1
    from public.city_configs c
    where p_lat between c.lat_min and c.lat_max
      and p_lng between c.lng_min and c.lng_max
  );
$$;

-- City-specific form. `p_pad` lets child-area centroids (ward / locality)
-- sit a short distance outside the box, because an H3 cell centroid can fall
-- just past the edge of an approximate city box.
create or replace function public.in_city_bounds(
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_pad double precision default 0
)
returns boolean
language sql
stable
parallel safe
as $$
  select exists (
    select 1
    from public.city_configs c
    where c.slug = p_city
      and p_lat between c.lat_min - greatest(0, p_pad) and c.lat_max + greatest(0, p_pad)
      and p_lng between c.lng_min - greatest(0, p_pad) and c.lng_max + greatest(0, p_pad)
  );
$$;

revoke all on function public.in_city_bounds(double precision, double precision)
  from public, anon;
grant execute on function public.in_city_bounds(double precision, double precision)
  to authenticated, service_role;

revoke all on function public.in_city_bounds(text, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.in_city_bounds(text, double precision, double precision, double precision)
  to authenticated, service_role;

create or replace function public.ensure_area(
  p_kind text,
  p_h3 text,
  p_name text,
  p_name_hi text,
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_parent_id uuid
)
returns table (
  id uuid,
  kind text,
  h3_cell text,
  name text,
  name_hi text,
  city_slug text,
  parent_id uuid,
  centroid_lat double precision,
  centroid_lng double precision
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_parent_kind text;
  v_parent_city text;
begin
  if p_kind not in ('locality', 'ward', 'city') then
    raise exception 'invalid area kind';
  end if;

  if p_h3 is null
    or char_length(p_h3) <> 15
    or (
      (p_kind = 'locality' and p_h3 !~ '^88[0-9a-f]{13}$')
      or (p_kind = 'ward' and p_h3 !~ '^87[0-9a-f]{13}$')
      or (p_kind = 'city' and p_h3 !~ '^85[0-9a-f]{13}$')
    ) then
    raise exception 'invalid cell for area kind';
  end if;

  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'invalid area name';
  end if;

  if p_city is null
    or not exists (
      select 1 from public.city_configs c where c.slug = p_city
    ) then
    raise exception 'unsupported city';
  end if;

  if p_lat is null
    or p_lng is null
    or not public.in_city_bounds(
      p_city,
      p_lat,
      p_lng,
      case when p_kind = 'city' then 0 else 0.02 end
    ) then
    raise exception 'area outside city bounds';
  end if;

  if p_kind = 'locality' and p_parent_id is null then
    raise exception 'a locality requires a ward parent';
  end if;

  if p_kind = 'ward' and p_parent_id is null then
    raise exception 'a ward requires a city parent';
  end if;

  if p_parent_id is not null then
    select a.kind, a.city_slug into v_parent_kind, v_parent_city
    from public.areas a
    where a.id = p_parent_id;

    if v_parent_kind is null then
      raise exception 'parent area not found';
    end if;

    if p_kind = 'locality' and v_parent_kind <> 'ward' then
      raise exception 'a locality parent must be a ward';
    end if;

    if p_kind = 'ward' and v_parent_kind <> 'city' then
      raise exception 'a ward parent must be a city';
    end if;

    if p_kind = 'city' then
      raise exception 'a city area cannot have a parent';
    end if;

    if v_parent_city <> p_city then
      raise exception 'parent area belongs to another city';
    end if;
  end if;

  insert into public.areas (kind, h3_cell, name, name_hi, city_slug, centroid, parent_id)
  values (
    p_kind,
    p_h3,
    left(btrim(p_name), 80),
    nullif(left(btrim(coalesce(p_name_hi, '')), 80), ''),
    p_city,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_parent_id
  )
  on conflict on constraint areas_kind_h3_cell_key do update
    set name_hi = coalesce(public.areas.name_hi, excluded.name_hi),
        parent_id = coalesce(public.areas.parent_id, excluded.parent_id);

  return query
    select
      a.id,
      a.kind,
      a.h3_cell,
      a.name,
      a.name_hi,
      a.city_slug,
      a.parent_id,
      st_y(a.centroid::geometry),
      st_x(a.centroid::geometry)
    from public.areas a
    where a.kind = p_kind and a.h3_cell = p_h3;
end;
$function$;

revoke all on function public.ensure_area(text, text, text, text, text, double precision, double precision, uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_area(text, text, text, text, text, double precision, double precision, uuid)
  to service_role;

-- City area rows for every supported city. Shops still arrive from the OSM
-- import or community additions, so no fake places are created here.
insert into public.areas (kind, h3_cell, name, name_hi, city_slug, centroid)
select
  'city',
  c.h3_r5,
  c.name,
  c.name_hi,
  c.slug,
  st_setsrid(st_makepoint(c.centroid_lng, c.centroid_lat), 4326)::geography
from public.city_configs c
on conflict (kind, h3_cell) do update
  set name = excluded.name,
      name_hi = coalesce(public.areas.name_hi, excluded.name_hi),
      city_slug = excluded.city_slug;

notify pgrst, 'reload schema';
