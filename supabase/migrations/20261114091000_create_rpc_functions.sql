-- Server-side functions. Every security definer function validates the
-- caller and is executable only by authenticated users.

-- ---------------------------------------------------------------
-- consume_rate_limit
-- ---------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
  v_key text;
  v_now timestamptz := now();
  v_row public.rate_limits%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_action is null or char_length(btrim(p_action)) = 0 then
    raise exception 'invalid rate limit action';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit policy';
  end if;

  v_key := p_action || ':' || v_uid::text;

  insert into public.rate_limits as rl (key, window_start, count, expires_at)
  values (v_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case
          when rl.expires_at <= v_now then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.expires_at <= v_now then v_now
          else rl.window_start
        end,
        expires_at = case
          when rl.expires_at <= v_now
            then v_now + make_interval(secs => p_window_seconds)
          else rl.expires_at
        end
  returning * into v_row;

  if v_row.count > p_limit then
    return query
      select false, 0,
        greatest(1, ceil(extract(epoch from (v_row.expires_at - v_now)))::integer);
  end if;

  return query select true, greatest(0, p_limit - v_row.count), 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------
-- ensure_area
-- Server-only. The route validates the H3 cell, computes the cell
-- centroid with h3-js, and calls this with the service role. A browser
-- cannot call it, so it cannot submit an exact location as a centroid.
-- ---------------------------------------------------------------
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
set search_path = public, extensions
as $$
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
  on conflict (kind, h3_cell) do update
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
$$;

revoke all on function public.ensure_area(
  text, text, text, text, text, double precision, double precision, uuid
) from public, anon, authenticated;
grant execute on function public.ensure_area(
  text, text, text, text, text, double precision, double precision, uuid
) to service_role;

-- ---------------------------------------------------------------
-- nearby_shops
-- ---------------------------------------------------------------
create or replace function public.nearby_shops(
  p_lat double precision,
  p_lng double precision,
  p_max_m integer default 50000
)
returns table (
  id uuid,
  name text,
  name_hi text,
  category text,
  address text,
  phone text,
  website text,
  opening_hours text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  source text,
  source_url text,
  last_verified_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id,
    s.name,
    s.name_hi,
    s.category,
    s.address,
    s.phone,
    s.website,
    s.opening_hours,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    st_distance(
      s.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m,
    s.source,
    s.source_url,
    s.last_verified_at
  from public.shops s
  where public.in_city_bounds(p_lat, p_lng)
    and s.status = 'published'
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      least(greatest(coalesce(p_max_m, 50000), 100), 50000)
    )
  order by distance_m asc
  limit 200;
$$;

revoke all on function public.nearby_shops(double precision, double precision, integer)
  from public, anon;
grant execute on function public.nearby_shops(double precision, double precision, integer)
  to authenticated;

-- ---------------------------------------------------------------
-- nearby_people
-- ---------------------------------------------------------------
create or replace function public.nearby_people(
  p_lat double precision,
  p_lng double precision
)
returns table (radius_m integer, active_people integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with steps(radius_m) as (
    values (500), (1000), (2000), (5000), (10000), (25000), (50000)
  )
  select
    steps.radius_m,
    (
      select count(distinct rp.user_id)::integer
      from public.room_presence rp
      join public.areas a on a.id = rp.home_area_id
      where public.in_city_bounds(p_lat, p_lng)
        and rp.last_seen_at > now() - interval '90 seconds'
        and rp.user_id <> (select auth.uid())
        and not exists (
          select 1
          from public.user_blocks b
          where b.blocker_id = (select auth.uid())
            and b.blocked_id = rp.user_id
        )
        and st_dwithin(
          a.centroid,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          steps.radius_m
        )
    ) as active_people
  from steps
  order by steps.radius_m;
$$;

revoke all on function public.nearby_people(double precision, double precision)
  from public, anon;
grant execute on function public.nearby_people(double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------
-- room_counts
-- ---------------------------------------------------------------
create or replace function public.room_counts(p_area_ids uuid[])
returns table (area_id uuid, active_people integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    a.id as area_id,
    count(distinct rp.user_id)::integer as active_people
  from public.areas a
  join public.profile_locations pl
    on pl.user_id = (select auth.uid())
    and a.id in (pl.locality_area_id, pl.ward_area_id, pl.city_area_id)
  left join public.room_presence rp
    on rp.area_id = a.id
    and rp.last_seen_at > now() - interval '90 seconds'
    and rp.user_id <> (select auth.uid())
    and not exists (
      select 1
      from public.user_blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = rp.user_id
    )
  where a.id = any(p_area_ids)
  group by a.id;
$$;

revoke all on function public.room_counts(uuid[]) from public, anon;
grant execute on function public.room_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------
-- heartbeat and stop_presence
-- ---------------------------------------------------------------
create or replace function public.heartbeat(p_area_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
  v_home uuid;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select locality_area_id into v_home
  from public.profile_locations
  where user_id = v_uid and show_presence = true;

  if v_home is null then
    raise exception 'presence is off';
  end if;

  if not exists (
    select 1
    from public.profile_locations
    where user_id = v_uid
      and p_area_id in (locality_area_id, ward_area_id, city_area_id)
  ) then
    raise exception 'area not allowed';
  end if;

  select rl.allowed into v_allowed
  from public.consume_rate_limit('presence-heartbeat', 4, 60) rl;

  if not coalesce(v_allowed, false) then
    raise exception 'presence rate limit';
  end if;

  insert into public.room_presence (area_id, user_id, home_area_id, last_seen_at)
  values (p_area_id, v_uid, v_home, now())
  on conflict (area_id, user_id) do update
    set home_area_id = excluded.home_area_id,
        last_seen_at = now();

  delete from public.room_presence
  where user_id = v_uid
    and last_seen_at < now() - interval '5 minutes';
end;
$$;

create or replace function public.stop_presence()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  update public.profile_locations
  set show_presence = false, updated_at = now()
  where user_id = v_uid;

  delete from public.room_presence where user_id = v_uid;
end;
$$;

revoke all on function public.heartbeat(uuid) from public, anon;
revoke all on function public.stop_presence() from public, anon;
grant execute on function public.heartbeat(uuid) to authenticated;
grant execute on function public.stop_presence() to authenticated;

-- ---------------------------------------------------------------
-- delete_message
-- ---------------------------------------------------------------
create or replace function public.delete_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  update public.messages
  set body = '', deleted_at = now()
  where id = p_id
    and author_id = v_uid
    and deleted_at is null;

  if not found then
    raise exception 'message not found';
  end if;
end;
$$;

revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;

notify pgrst, 'reload schema';
