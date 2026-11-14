-- RLS contract for the area module. Every table has RLS enabled.
-- `anon` has no access to any area table.

alter table public.areas enable row level security;
alter table public.profile_locations enable row level security;
alter table public.shops enable row level security;
alter table public.shop_photos enable row level security;
alter table public.shop_reports enable row level security;
alter table public.messages enable row level security;
alter table public.room_presence enable row level security;
alter table public.rate_limits enable row level security;
alter table public.area_mutes enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.user_blocks enable row level security;

-- ---------------------------------------------------------------
-- areas
-- ---------------------------------------------------------------
drop policy if exists "Authenticated users can read areas" on public.areas;
create policy "Authenticated users can read areas"
  on public.areas
  for select
  to authenticated
  using (true);

revoke all on public.areas from public, anon, authenticated;
grant select on public.areas to authenticated;

-- ---------------------------------------------------------------
-- profile_locations: self only
-- ---------------------------------------------------------------
drop policy if exists "Users can read their own location" on public.profile_locations;
create policy "Users can read their own location"
  on public.profile_locations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own location" on public.profile_locations;
create policy "Users can add their own location"
  on public.profile_locations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own location" on public.profile_locations;
create policy "Users can update their own location"
  on public.profile_locations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can clear their own location" on public.profile_locations;
create policy "Users can clear their own location"
  on public.profile_locations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profile_locations from public, anon, authenticated;
grant select on public.profile_locations to authenticated;
grant insert (
  user_id,
  h3_r8,
  locality_area_id,
  ward_area_id,
  city_area_id,
  show_presence
) on public.profile_locations to authenticated;
grant update (
  h3_r8,
  locality_area_id,
  ward_area_id,
  city_area_id,
  show_presence
) on public.profile_locations to authenticated;
grant delete on public.profile_locations to authenticated;

-- ---------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------
drop policy if exists "Authenticated users can read published shops" on public.shops;
create policy "Authenticated users can read published shops"
  on public.shops
  for select
  to authenticated
  using (status = 'published');

drop policy if exists "Authenticated users can add community shops" on public.shops;
create policy "Authenticated users can add community shops"
  on public.shops
  for insert
  to authenticated
  with check (
    source = 'community'
    and status = 'published'
    and created_by = (select auth.uid())
  );

revoke all on public.shops from public, anon, authenticated;
grant select on public.shops to authenticated;
grant insert (
  name,
  name_hi,
  category,
  address,
  phone,
  website,
  opening_hours,
  location,
  h3_r8,
  source,
  source_url,
  osm_tags,
  created_by
) on public.shops to authenticated;

-- ---------------------------------------------------------------
-- shop_photos
-- ---------------------------------------------------------------
drop policy if exists "Authenticated users can read published shop photos" on public.shop_photos;
create policy "Authenticated users can read published shop photos"
  on public.shop_photos
  for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.shops s
      where s.id = shop_photos.shop_id
        and s.status = 'published'
    )
  );

drop policy if exists "Users can add photos to published shops" on public.shop_photos;
create policy "Users can add photos to published shops"
  on public.shop_photos
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and status = 'published'
    and exists (
      select 1
      from public.shops s
      where s.id = shop_photos.shop_id
        and s.status = 'published'
    )
  );

drop policy if exists "Users can delete their own shop photos" on public.shop_photos;
create policy "Users can delete their own shop photos"
  on public.shop_photos
  for delete
  to authenticated
  using (uploaded_by = (select auth.uid()));

revoke all on public.shop_photos from public, anon, authenticated;
grant select on public.shop_photos to authenticated;
grant insert (shop_id, storage_path, width, height, uploaded_by)
  on public.shop_photos to authenticated;
grant delete on public.shop_photos to authenticated;

-- ---------------------------------------------------------------
-- shop_reports
-- ---------------------------------------------------------------
drop policy if exists "Users can read their own shop reports" on public.shop_reports;
create policy "Users can read their own shop reports"
  on public.shop_reports
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can submit shop reports" on public.shop_reports;
create policy "Users can submit shop reports"
  on public.shop_reports
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.shop_reports from public, anon, authenticated;
grant select on public.shop_reports to authenticated;
grant insert (shop_id, user_id, kind, field, note, contact)
  on public.shop_reports to authenticated;

-- ---------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------
drop policy if exists "Authenticated users can read area messages" on public.messages;
create policy "Authenticated users can read area messages"
  on public.messages
  for select
  to authenticated
  using (
    area_id is not null
    and exists (
      select 1
      from public.profile_locations pl
      where pl.user_id = (select auth.uid())
        and messages.area_id in (
          pl.locality_area_id,
          pl.ward_area_id,
          pl.city_area_id
        )
    )
    and not exists (
      select 1
      from public.user_blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = messages.author_id
    )
  );

drop policy if exists "Authenticated users can send area messages as themselves" on public.messages;
create policy "Authenticated users can send area messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and area_id is not null
    and deleted_at is null
    and exists (
      select 1
      from public.profile_locations pl
      where pl.user_id = (select auth.uid())
        and messages.area_id in (
          pl.locality_area_id,
          pl.ward_area_id,
          pl.city_area_id
        )
    )
  );

revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;
grant insert (area_id, scope, h3_cell, client_id, author_id, author_handle, body)
  on public.messages to authenticated;

-- ---------------------------------------------------------------
-- area_mutes
-- ---------------------------------------------------------------
drop policy if exists "Users can read their own area mutes" on public.area_mutes;
create policy "Users can read their own area mutes"
  on public.area_mutes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can mute areas for themselves" on public.area_mutes;
create policy "Users can mute areas for themselves"
  on public.area_mutes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can unmute their own areas" on public.area_mutes;
create policy "Users can unmute their own areas"
  on public.area_mutes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.area_mutes from public, anon, authenticated;
grant select on public.area_mutes to authenticated;
grant insert (user_id, area_id) on public.area_mutes to authenticated;
grant delete on public.area_mutes to authenticated;

-- ---------------------------------------------------------------
-- tables with no direct client access
-- ---------------------------------------------------------------
revoke all on public.room_presence from public, anon, authenticated;
revoke all on public.rate_limits from public, anon, authenticated;
revoke all on public.geocode_cache from public, anon, authenticated;

notify pgrst, 'reload schema';
