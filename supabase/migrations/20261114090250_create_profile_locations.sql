-- The user's current area. One row per user. No coordinates and no history.

create table public.profile_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  h3_r8 text not null check (
    char_length(h3_r8) = 15
    and h3_r8 ~ '^88[0-9a-f]{13}$'
  ),
  locality_area_id uuid references public.areas (id) on delete set null,
  ward_area_id uuid references public.areas (id) on delete set null,
  city_area_id uuid references public.areas (id) on delete set null,
  show_presence boolean not null default false,
  updated_at timestamptz not null default now()
);

create index profile_locations_locality_idx on public.profile_locations (locality_area_id);
create index profile_locations_ward_idx on public.profile_locations (ward_area_id);
create index profile_locations_city_idx on public.profile_locations (city_area_id);

-- Keep the three area ids internally consistent. The route resolves the
-- cells, and this trigger stops a client from mixing a locality with an
-- unrelated ward or city.
create or replace function public.validate_profile_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_locality_kind text;
  v_locality_parent uuid;
  v_locality_cell text;
  v_ward_kind text;
  v_ward_parent uuid;
  v_city_kind text;
begin
  if new.locality_area_id is not null then
    select kind, parent_id, h3_cell
      into v_locality_kind, v_locality_parent, v_locality_cell
    from public.areas
    where id = new.locality_area_id;

    if v_locality_kind is distinct from 'locality' then
      raise exception 'locality_area_id must reference a locality';
    end if;

    if v_locality_cell is distinct from new.h3_r8 then
      raise exception 'h3_r8 does not match the locality cell';
    end if;

    if new.ward_area_id is null or new.city_area_id is null then
      raise exception 'a locality requires a ward and a city';
    end if;
  end if;

  if new.ward_area_id is not null then
    select kind, parent_id
      into v_ward_kind, v_ward_parent
    from public.areas
    where id = new.ward_area_id;

    if v_ward_kind is distinct from 'ward' then
      raise exception 'ward_area_id must reference a ward';
    end if;

    if new.locality_area_id is not null
      and v_locality_parent is distinct from new.ward_area_id then
      raise exception 'locality does not belong to the selected ward';
    end if;

    if new.city_area_id is null then
      raise exception 'a ward requires a city';
    end if;
  end if;

  if new.city_area_id is not null then
    select kind into v_city_kind
    from public.areas
    where id = new.city_area_id;

    if v_city_kind is distinct from 'city' then
      raise exception 'city_area_id must reference a city';
    end if;

    if new.ward_area_id is not null
      and v_ward_parent is distinct from new.city_area_id then
      raise exception 'ward does not belong to the selected city';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_profile_location() from public, anon, authenticated;

create trigger profile_locations_validate
  before insert or update on public.profile_locations
  for each row
  execute function public.validate_profile_location();

alter table public.profile_locations enable row level security;

notify pgrst, 'reload schema';
