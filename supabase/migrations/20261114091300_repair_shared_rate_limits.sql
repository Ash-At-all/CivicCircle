-- Idempotent repair for the shared rate limiter.
--
-- Why: a deployment can point at a Supabase project where the earlier
-- 20261114090700/20261114091000 migrations were not applied (or PostgREST has
-- a stale schema cache). In that state consume_rate_limit is missing and every
-- rate-limited write (including PUT /api/posts/:id/votes) returns 503 before
-- reaching its own RPC. This migration is safe to run more than once.

set search_path = public, extensions;

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null
);

-- Repair a partially created table without touching existing rows.
alter table public.rate_limits
  add column if not exists window_start timestamptz not null default now(),
  add column if not exists count integer not null default 0,
  add column if not exists expires_at timestamptz not null default now();

create index if not exists rate_limits_expires_idx
  on public.rate_limits (expires_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

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

-- If the votes RPC exists, make sure authenticated users can still execute it
-- after the repair (no-op on projects where it was already granted).
do $$
begin
  if to_regprocedure('public.set_post_vote(uuid, smallint)') is not null then
    grant execute on function public.set_post_vote(uuid, smallint) to authenticated;
  end if;
  if to_regprocedure('public.get_post_vote_summary(uuid)') is not null then
    grant execute on function public.get_post_vote_summary(uuid) to anon, authenticated;
  end if;
end
$$;

notify pgrst, 'reload schema';
