-- IP-based rate limit for anonymous sign-in.
-- Stores only an IP hash in the rate limit key (no raw IP).
-- Safe to run more than once.

set search_path = public, extensions;

create or replace function public.consume_ip_rate_limit(
  p_action text,
  p_ip_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
  v_now timestamptz := now();
  v_row public.rate_limits%rowtype;
begin
  if p_action is null or char_length(btrim(p_action)) = 0 then
    raise exception 'invalid rate limit action';
  end if;
  if p_ip_hash is null or char_length(btrim(p_ip_hash)) = 0 then
    raise exception 'invalid rate limit key';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit policy';
  end if;

  v_key := p_action || ':ip:' || p_ip_hash;

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
    return;
  end if;

  return query select true, greatest(0, p_limit - v_row.count), 0;
end;
$$;

revoke all on function public.consume_ip_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ip_rate_limit(text, text, integer, integer)
  to anon, authenticated;

notify pgrst, 'reload schema';
