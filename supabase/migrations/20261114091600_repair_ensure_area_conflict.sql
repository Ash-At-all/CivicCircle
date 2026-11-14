-- Repair: ensure_area had an ambiguous ON CONFLICT target under PL/pgSQL
-- ("kind" could refer to the returned table column). Use the table unique constraint.

drop function if exists public.ensure_area(text, text, text, text, text, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.ensure_area(p_kind text, p_h3 text, p_name text, p_name_hi text, p_city text, p_lat double precision, p_lng double precision, p_parent_id uuid)
 RETURNS TABLE(id uuid, kind text, h3_cell text, name text, name_hi text, city_slug text, parent_id uuid, centroid_lat double precision, centroid_lng double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  if p_city is null or p_city <> 'sambhajinagar' then
    raise exception 'unsupported city';
  end if;

  if p_lat is null
    or p_lng is null
    or not public.in_city_bounds(p_lat, p_lng) then
    raise exception 'area outside launch city';
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

revoke all on function public.ensure_area(text, text, text, text, text, double precision, double precision, uuid) from public, anon, authenticated;
grant execute on function public.ensure_area(text, text, text, text, text, double precision, double precision, uuid) to service_role;

notify pgrst, 'reload schema';
