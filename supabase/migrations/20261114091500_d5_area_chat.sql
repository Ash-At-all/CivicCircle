-- Deliverable 5: area chat transport and presence cleanup.
--
-- leave_room_presence removes only the room the user is leaving. It does not
-- change show_presence, so navigating between rooms does not silently opt the
-- user out of presence.

create or replace function public.leave_room_presence(p_area_id uuid)
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

  delete from public.room_presence
  where user_id = v_uid
    and area_id = p_area_id;
end;
$$;

revoke all on function public.leave_room_presence(uuid) from public, anon;
grant execute on function public.leave_room_presence(uuid) to authenticated;

-- Supabase Realtime only streams tables that are part of this publication.
-- RLS still applies to each postgres_changes subscription.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;

notify pgrst, 'reload schema';
