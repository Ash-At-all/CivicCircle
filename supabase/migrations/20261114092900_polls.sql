-- Anonymous local polls.

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists polls_post_idx on public.polls (post_id);
create index if not exists polls_expires_idx on public.polls (expires_at);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint poll_votes_poll_user_unique unique (poll_id, user_id)
);

create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

alter table public.polls enable row level security;
create policy "Authenticated users can read polls" on public.polls
  for select to authenticated
  using (true);

alter table public.poll_options enable row level security;
create policy "Authenticated users can read poll options" on public.poll_options
  for select to authenticated
  using (true);

alter table public.poll_votes enable row level security;
create policy "Authenticated users can vote on polls" on public.poll_votes
  for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy "Users can delete their own poll votes" on public.poll_votes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.polls to authenticated;
grant select on public.poll_options to authenticated;
grant select on public.poll_votes to authenticated;
grant insert on public.polls to authenticated;
grant insert on public.poll_options to authenticated;
grant insert on public.poll_votes to authenticated;
grant delete on public.poll_votes to authenticated;
grant all on public.polls to service_role;
grant all on public.poll_options to service_role;
grant all on public.poll_votes to service_role;

notify pgrst, 'reload schema';
