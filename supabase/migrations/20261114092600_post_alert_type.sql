-- Local alerts: optional alert type on posts. Null means the post is not an alert.

alter table public.posts
  add column alert_type text default null;

alter table public.posts
  add constraint posts_alert_type_check
  check (alert_type in ('water_cut', 'power_cut', 'road_closed', 'traffic_jam', 'shop_closed', 'event', 'safety_notice') or alert_type is null);

notify pgrst, 'reload schema';
