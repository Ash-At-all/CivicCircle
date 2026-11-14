-- City skeleton for the launch city. No fake shops, ratings, or counters.
-- Shops arrive from the weekly OSM import or from community additions.
-- The row is idempotent so `db push` can run more than once safely.

set search_path = public, extensions;

insert into public.areas (kind, h3_cell, name, name_hi, city_slug, centroid)
values (
  'city',
  '85609c37fffffff',
  'Chhatrapati Sambhajinagar',
  'छत्रपती संभाजीनगर',
  'sambhajinagar',
  st_setsrid(st_makepoint(75.37063270084657, 19.949389927734455), 4326)::geography
)
on conflict (kind, h3_cell) do update
  set name_hi = coalesce(public.areas.name_hi, excluded.name_hi);

notify pgrst, 'reload schema';
