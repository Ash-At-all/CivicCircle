-- Helpful marks: an anonymous qualitative signal, one per authenticated user per post.
-- No seeded rows, no synthetic counts. Reads expose real marks only.

set search_path = public, extensions;

create table if not exists public.helpful_marks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists helpful_marks_post_idx on public.helpful_marks (post_id);
create index if not exists helpful_marks_user_idx on public.helpful_marks (user_id);

alter table public.helpful_marks enable row level security;

drop policy if exists "Anyone can read helpful marks" on public.helpful_marks;
create policy "Anyone can read helpful marks"
  on public.helpful_marks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can mark a post as helpful" on public.helpful_marks;
create policy "Users can mark a post as helpful"
  on public.helpful_marks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own helpful mark" on public.helpful_marks;
create policy "Users can remove their own helpful mark"
  on public.helpful_marks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.helpful_marks from public, anon, authenticated;
grant select (id, post_id, user_id, created_at) on public.helpful_marks to authenticated;
grant select (id, post_id, created_at) on public.helpful_marks to anon;
grant insert (post_id, user_id) on public.helpful_marks to authenticated;
grant delete on public.helpful_marks to authenticated;
grant all on public.helpful_marks to service_role;

-- Feed summary: real count plus whether the current viewer marked it.
-- Security definer keeps the aggregate available without exposing every row.
create or replace function public.get_post_helpful_summaries(p_post_ids uuid[])
returns table (post_id uuid, helpful_count bigint, marked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    requested.id,
    count(mark.id)::bigint,
    coalesce(bool_or(mark.user_id = (select auth.uid())), false)
  from unnest(p_post_ids) as requested(id)
  left join public.helpful_marks as mark on mark.post_id = requested.id
  group by requested.id;
$$;

revoke all on function public.get_post_helpful_summaries(uuid[]) from public;
grant execute on function public.get_post_helpful_summaries(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
