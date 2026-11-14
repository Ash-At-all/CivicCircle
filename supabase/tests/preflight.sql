-- Read-only preflight. Run against the exact Supabase project the app uses:
--   psql "$DATABASE_URL" -f supabase/tests/preflight.sql
-- It prints PASS/FAIL lines; it never prints secrets.

\set ON_ERROR_STOP on

\echo 'CivicCircle preflight: shared rate limiter and votes'

select
  'rate_limits table' as check,
  case when to_regclass('public.rate_limits') is not null then 'PASS' else 'FAIL' end as result;

select
  'consume_rate_limit function' as check,
  case when to_regprocedure('public.consume_rate_limit(text,integer,integer)') is not null
    then 'PASS' else 'FAIL' end as result;

select
  'set_post_vote function' as check,
  case when to_regprocedure('public.set_post_vote(uuid,smallint)') is not null
    then 'PASS' else 'FAIL' end as result;

select
  'post_votes table' as check,
  case when to_regclass('public.post_votes') is not null then 'PASS' else 'FAIL' end as result;

select
  'rate_limits RLS' as check,
  case when exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'rate_limits' and c.relrowsecurity
  ) then 'PASS' else 'FAIL' end as result;

select
  'authenticated can execute consume_rate_limit' as check,
  case when has_function_privilege(
    'authenticated',
    'public.consume_rate_limit(text,integer,integer)',
    'execute'
  ) then 'PASS' else 'FAIL' end as result;

select
  'anon cannot execute consume_rate_limit' as check,
  case when not has_function_privilege(
    'anon',
    'public.consume_rate_limit(text,integer,integer)',
    'execute'
  ) then 'PASS' else 'FAIL' end as result;

select
  'authenticated can execute set_post_vote' as check,
  case when has_function_privilege(
    'authenticated',
    'public.set_post_vote(uuid,smallint)',
    'execute'
  ) then 'PASS' else 'FAIL' end as result;

-- Exercise the limiter as the authenticated role without committing anything.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select
  'consume_rate_limit smoke' as check,
  case when allowed then 'PASS' else 'FAIL' end as result
from public.consume_rate_limit('preflight', 10, 60);
rollback;
