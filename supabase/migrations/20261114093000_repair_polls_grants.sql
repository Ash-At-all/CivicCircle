-- ============================================================================
-- Repair production RLS + grants for posts and polls.
--
-- Safe to run more than once. Nothing here disables RLS, drops a table or
-- removes the posts triggers (`posts_set_updated_at`,
-- `posts_validate_image_ownership`).
--
-- Identity model (verified in the application code):
--   * Every product user, including a "login-free" user, is a real Supabase
--     user. `src/components/auth/auth-bootstrap.tsx` calls
--     `supabase.auth.signInAnonymously()`, so anonymous visitors also carry a
--     real JWT, have role `authenticated` and a stable `auth.uid()`.
--   * Posts and polls are written through `getSupabaseServerClient()`, i.e.
--     the user's JWT, never the service_role key.
--   * `posts.author_id` is set to `auth.uid()` for every post, anonymous users
--     included. `posts.anon_id` is legacy display data and is NOT a trusted
--     identity: a browser can send any value, so no policy below may authorize
--     writes from it.
--
-- The two production failures this repairs:
--   1. `permission denied for table posts`
--      The column-level INSERT grant on `posts` did not include `author_id`
--      (and `alert_type`), which `POST /api/posts` always writes.
--   2. `new row violates row-level security policy for table polls`
--      RLS is enabled on `polls` / `poll_options` but no INSERT policy exists
--      in the migrations, so PostgreSQL denies every poll create.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. RLS stays on. (Idempotent, never disables.)
-- ----------------------------------------------------------------------------
alter table public.posts        enable row level security;
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

-- ----------------------------------------------------------------------------
-- 1. posts: allow authenticated users to insert every column the API writes.
--
--    Existing grants only covered (city_slug, tag, title, body, image_paths).
--    `POST /api/posts` also writes `author_id` and `alert_type`; PostgreSQL
--    reports that missing column privilege as "permission denied for table
--    posts". GRANT is additive, so these statements widen the privilege
--    without removing anything.
--
--    The existing INSERT policy ("Users can create posts as themselves",
--    `with check (auth.uid() = author_id)`) is left untouched: it is what
--    makes this grant safe, because a user can still only insert their own id.
-- ----------------------------------------------------------------------------
grant insert (city_slug, tag, title, body, image_paths, author_id)
  on public.posts to authenticated;

do $$
begin
  -- `alert_type` was added later; grant it only on databases that have it so
  -- the migration also runs on an older schema.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'alert_type'
  ) then
    execute 'grant insert (alert_type) on public.posts to authenticated';
  end if;
end $$;

-- Defense in depth: the `anon` role is for requests with no session at all.
-- Every product write happens as `authenticated` (anonymous sign-in included),
-- so `anon` must never hold write privileges on posts. SELECT stays as-is
-- because the public feed is readable before sign-in completes.
revoke insert, update, delete, truncate, references, trigger
  on public.posts from anon;

-- ----------------------------------------------------------------------------
-- 2. polls / poll_options / poll_votes: remove legacy insertion policies.
--
--    Production and the repository disagree about which poll policies exist,
--    and policy names differ. Dropping only the INSERT policies first makes
--    this repair deterministic and guarantees one policy per table instead of
--    leaving duplicate/overlapping policies. SELECT, UPDATE and DELETE policies
--    are not touched.
-- ----------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'polls' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.polls', pol.policyname);
  end loop;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'poll_options' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.poll_options', pol.policyname);
  end loop;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'poll_votes' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.poll_votes', pol.policyname);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. polls INSERT: only the author of the post may create its poll.
--
--    `polls.post_id = posts.id AND posts.author_id = auth.uid()`.
--    For a registered user `auth.uid()` is their account id; for a login-free
--    user it is their verified Supabase anonymous-auth id. `posts.anon_id` is
--    deliberately ignored because it is client-controlled.
-- ----------------------------------------------------------------------------
create policy "Authors can create polls on their own posts"
  on public.polls
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.posts p
      where p.id = polls.post_id
        and p.author_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 4. poll_options INSERT: only the owner of the poll's post may add options.
--
--    Without this a user could add options to somebody else's poll even though
--    they cannot create the poll itself.
-- ----------------------------------------------------------------------------
create policy "Poll authors can add options to their own polls"
  on public.poll_options
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.polls p
      join public.posts po on po.id = p.post_id
      where p.id = poll_options.poll_id
        and po.author_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. poll_votes INSERT: a user may only vote as themselves, on an open poll,
--    with an option that belongs to that poll.
--
--    The previous policy only checked `auth.uid() is not null`, which let a
--    caller store any `user_id` (impersonating another anonymous identity) and
--    vote on expired polls or with an option from a different poll.
-- ----------------------------------------------------------------------------
create policy "Users can vote as themselves on open polls"
  on public.poll_votes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.polls p
      where p.id = poll_votes.poll_id
        and p.expires_at > now()
    )
    and exists (
      select 1
      from public.poll_options o
      where o.id = poll_votes.option_id
        and o.poll_id = poll_votes.poll_id
    )
  );

-- ----------------------------------------------------------------------------
-- 6. poll_votes SELECT: required by the vote endpoint, which recounts results.
--
--    The repository migration never created this policy, so on a database built
--    only from migrations every tally read returns zero rows. Add it only when
--    no SELECT policy already exists, so production keeps its existing one.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'poll_votes' and cmd = 'SELECT'
  ) then
    execute $policy$
      create policy "Authenticated users can read poll votes"
        on public.poll_votes
        for select
        to authenticated
        using (true)
    $policy$;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Grants. Re-assert the intended privileges idempotently.
--
--    `anon` needs no poll access at all: unauthenticated requests are denied,
--    and login-free users are `authenticated`. Revoke first so no stale broad
--    `grant all ... to anon` from an earlier migration survives.
-- ----------------------------------------------------------------------------
revoke all on public.polls        from anon;
revoke all on public.poll_options from anon;
revoke all on public.poll_votes   from anon;

grant select on public.polls        to authenticated;
grant select on public.poll_options to authenticated;
grant select on public.poll_votes   to authenticated;

grant insert on public.polls        to authenticated;
grant insert on public.poll_options to authenticated;
grant insert on public.poll_votes   to authenticated;

grant delete on public.poll_votes   to authenticated;

grant all on public.polls        to service_role;
grant all on public.poll_options to service_role;
grant all on public.poll_votes   to service_role;

-- ----------------------------------------------------------------------------
-- 8. Ask PostgREST to pick up the new policies/grants immediately.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
