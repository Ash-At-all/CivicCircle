-- Extensions and small immutable helpers used by the area module.

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- The launch city safety box. This is not an official boundary.
-- It keeps geocoding, shop pins, and area creation inside the city.
create or replace function public.in_city_bounds(
  p_lat double precision,
  p_lng double precision
)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_lat between 19.70 and 20.10
     and p_lng between 75.10 and 75.60;
$$;

revoke all on function public.in_city_bounds(double precision, double precision)
  from public, anon;
grant execute on function public.in_city_bounds(double precision, double precision)
  to authenticated;
