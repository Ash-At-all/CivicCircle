-- General chat is global: messages in the general room are not tied to an area.
-- Scope 'global' rows keep area_id and h3_cell null, so every signed-in user can
-- read them regardless of which city or locality they are in.

-- 1. Allow the new scope value.
alter table public.messages drop constraint if exists messages_scope_check;
alter table public.messages
  add constraint messages_scope_check
  check (scope is null or scope in ('locality', 'ward', 'city', 'global'));

-- 2. Read: global messages are readable by any signed-in user. Area messages
--    keep the existing area membership rule. Blocks apply to both.
drop policy if exists "Authenticated users can read area messages" on public.messages;
create policy "Authenticated users can read area messages"
  on public.messages
  for select
  to authenticated
  using (
    not exists (
      select 1
      from public.user_blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = messages.author_id
    )
    and (
      (
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
      )
      or (scope = 'global' and area_id is null)
    )
  );

-- 3. Insert: allow global messages without an area, still as the current user.
drop policy if exists "Authenticated users can send area messages as themselves" on public.messages;
create policy "Authenticated users can send area messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and deleted_at is null
    and (
      (
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
      )
      or (scope = 'global' and area_id is null)
    )
  );

-- 4. Fast reads for the global room.
create index if not exists messages_global_created_idx
  on public.messages (created_at desc, id desc)
  where scope = 'global';

-- 5. Move the old city-room history into the global general room so it does not
--    disappear from the UI. Locality and ward chat stays area-scoped.
update public.messages
set scope = 'global',
    area_id = null,
    h3_cell = null
where scope = 'city';

notify pgrst, 'reload schema';
