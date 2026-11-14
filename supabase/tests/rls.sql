-- RLS and RPC assertions for the area module.
--
-- Run against a staging Supabase database (never production):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- The script inserts two test auth users, runs assertions as those users,
-- and rolls everything back.

begin;

set search_path = public, extensions;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'ASSERT FAILED: %', p_message;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-a@example.test'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-b@example.test'
  )
on conflict (id) do nothing;

insert into public.areas (id, kind, h3_cell, name, city_slug, centroid, parent_id)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'city',
    '85609c37ffffffe',
    'RLS Test City',
    'rls-test',
    st_setsrid(st_makepoint(75.3433, 19.8762), 4326)::geography,
    null
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'ward',
    '87609c36dfffffe',
    'RLS Test Ward',
    'rls-test',
    st_setsrid(st_makepoint(75.3433, 19.8762), 4326)::geography,
    'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    'locality',
    '88609c36ddffffe',
    'RLS Test Locality',
    'rls-test',
    st_setsrid(st_makepoint(75.3433, 19.8762), 4326)::geography,
    'aaaaaaaa-0000-0000-0000-000000000002'
  )
on conflict (id) do nothing;

insert into public.profile_locations (
  user_id,
  h3_r8,
  locality_area_id,
  ward_area_id,
  city_area_id,
  show_presence
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '88609c36ddffffe',
    'aaaaaaaa-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    false
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '88609c36ddffffe',
    'aaaaaaaa-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true
  )
on conflict (user_id) do nothing;

insert into public.messages (area_id, scope, h3_cell, author_id, author_handle, body)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'locality',
  '88609c36ddffffe',
  '22222222-2222-2222-2222-222222222222',
  'ghost-b',
  'Hello from user B'
);

insert into public.room_presence (area_id, user_id, home_area_id, last_seen_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-0000-0000-0000-000000000003',
  now()
)
on conflict (area_id, user_id) do update set last_seen_at = now();

-- ---------------------------------------------------------------
-- Act as user A
-- ---------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1. A cannot read B's profile location.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.profile_locations
  where user_id = '22222222-2222-2222-2222-222222222222';

  perform pg_temp.assert_true(v_count = 0, 'A must not read B profile_locations');
end;
$$;

-- 2. A cannot insert a message with author_id = B.
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.messages (area_id, scope, h3_cell, author_id, author_handle, body)
    values (
      'aaaaaaaa-0000-0000-0000-000000000003',
      'locality',
      '88609c36ddffffe',
      '22222222-2222-2222-2222-222222222222',
      'fake-b',
      'Impersonation attempt'
    );
  exception when others then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'A must not insert a message as B');
end;
$$;

-- 3. A can read B's message before blocking B.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.messages
  where author_id = '22222222-2222-2222-2222-222222222222';

  perform pg_temp.assert_true(v_count = 1, 'A must read the locality message before blocking');
end;
$$;

-- 4. room_presence has no direct client access (select privilege revoked).
do $$
declare
  v_failed boolean := false;
begin
  begin
    perform count(*) from public.room_presence;
  exception when insufficient_privilege then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'room_presence must not be directly readable');
end;
$$;

-- 5. room_counts returns an aggregate for A's own room and excludes A.
do $$
declare
  v_count integer;
begin
  select active_people into v_count
  from public.room_counts(array['aaaaaaaa-0000-0000-0000-000000000003'::uuid]);

  perform pg_temp.assert_true(v_count = 1, 'room_counts must count B and exclude A');
end;
$$;

-- 6. Rate limit denies after the configured count.
do $$
declare
  v_allowed boolean;
begin
  select allowed into v_allowed
  from public.consume_rate_limit('rls-test-action', 2, 60);
  perform pg_temp.assert_true(v_allowed, 'first rate limit call must be allowed');

  select allowed into v_allowed
  from public.consume_rate_limit('rls-test-action', 2, 60);
  perform pg_temp.assert_true(v_allowed, 'second rate limit call must be allowed');

  select allowed into v_allowed
  from public.consume_rate_limit('rls-test-action', 2, 60);
  perform pg_temp.assert_true(v_allowed = false, 'third rate limit call must be denied');
end;
$$;

-- 7. A cannot insert a community shop attributed to B.
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.shops (
      name,
      category,
      location,
      h3_r8,
      source,
      created_by
    )
    values (
      'Wrong Owner Shop',
      'grocery',
      st_setsrid(st_makepoint(75.3433, 19.8762), 4326)::geography,
      '88609c36ddffffe',
      'community',
      '22222222-2222-2222-2222-222222222222'
    );
  exception when others then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'created_by must equal auth.uid()');
end;
$$;

-- 8. A valid community shop insert succeeds.
do $$
declare
  v_count integer;
begin
  insert into public.shops (
    name,
    category,
    location,
    h3_r8,
    source,
    created_by
  )
  values (
    'RLS Test Shop',
    'grocery',
    st_setsrid(st_makepoint(75.3433, 19.8762), 4326)::geography,
    '88609c36ddffffe',
    'community',
    '11111111-1111-1111-1111-111111111111'
  );

  select count(*) into v_count
  from public.shops
  where name = 'RLS Test Shop';

  perform pg_temp.assert_true(v_count = 1, 'A must be able to add an own community shop');
end;
$$;

-- 9. A blocked author's message disappears.
do $$
declare
  v_count integer;
begin
  insert into public.user_blocks (blocker_id, blocked_id)
  values (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  select count(*) into v_count
  from public.messages
  where author_id = '22222222-2222-2222-2222-222222222222';

  perform pg_temp.assert_true(v_count = 0, 'blocked author messages must be hidden');
end;
$$;

-- 10. ensure_area is not executable by a signed-in client.
do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.ensure_area(
      'locality',
      '88609c36ddffffd',
      'Client Call',
      null,
      'sambhajinagar',
      19.8762,
      75.3433,
      'aaaaaaaa-0000-0000-0000-000000000002'
    );
  exception when others then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'authenticated must not execute ensure_area directly');
end;
$$;

-- 11. ensure_area rejects a point outside the launch city (server role).
reset role;

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.ensure_area(
      'locality',
      '88609c36ddffffd',
      'Outside City',
      null,
      'sambhajinagar',
      21.0,
      75.3,
      'aaaaaaaa-0000-0000-0000-000000000002'
    );
  exception when others then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'ensure_area must reject points outside the city box');
end;
$$;

-- ---------------------------------------------------------------
-- Act as anon
-- ---------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- 12. anon cannot insert a post.
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.posts (city_slug, tag, title, body, author_id)
    values (
      'sambhajinagar',
      'General',
      'Anonymous post',
      'This must not be allowed',
      '11111111-1111-1111-1111-111111111111'
    );
  exception when others then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'anon must not insert posts');
end;
$$;

-- 13. anon cannot insert a message.
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.messages (area_id, scope, h3_cell, author_id, body)
    values (
      'aaaaaaaa-0000-0000-0000-000000000003',
      'locality',
      '88609c36ddffffe',
      '11111111-1111-1111-1111-111111111111',
      'Anonymous message'
    );
  exception when others then
    v_failed := true;
  end;

  perform pg_temp.assert_true(v_failed, 'anon must not insert messages');
end;
$$;

rollback;

select 'RLS tests passed' as result;
