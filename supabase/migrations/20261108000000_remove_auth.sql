-- ==============================================================
-- VIBECHAT AUTH-FREE & ANONYMOUS MIGRATION
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================

-- 1. Modify posts table: make author_id optional, add anon_id, remove old city constraint
alter table public.posts
  alter column author_id drop not null,
  add column if not exists anon_id text;

alter table public.posts
  drop constraint if exists posts_author_id_fkey;

alter table public.posts
  drop constraint if exists posts_city_slug_check;

alter table public.posts
  drop constraint if exists posts_tag_check;

-- 2. Modify messages table: make author_id optional, add anon_id
alter table public.messages
  alter column author_id drop not null,
  add column if not exists anon_id text;

alter table public.messages
  drop constraint if exists messages_author_id_fkey;

-- 3. Modify comments table (if present)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'post_comments') then
    alter table public.post_comments alter column author_id drop not null;
    alter table public.post_comments drop constraint if exists post_comments_author_id_fkey;
  end if;
end $$;

-- 4. Clean up old auth policies on posts
drop policy if exists "Users can create posts as themselves" on public.posts;
drop policy if exists "Users can update their own posts" on public.posts;
drop policy if exists "Users can delete their own posts" on public.posts;
drop policy if exists "Anyone can read posts" on public.posts;
drop policy if exists "Anyone can insert posts" on public.posts;
drop policy if exists "Anyone can update posts" on public.posts;
drop policy if exists "Anyone can delete posts" on public.posts;

-- Create open policies for posts
create policy "Anyone can read posts"
  on public.posts for select
  to anon, authenticated
  using (true);

create policy "Anyone can insert posts"
  on public.posts for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can update posts"
  on public.posts for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Anyone can delete posts"
  on public.posts for delete
  to anon, authenticated
  using (true);

-- 5. Clean up old auth policies on messages
drop policy if exists "Users can create messages as themselves" on public.messages;
drop policy if exists "Users can delete their own messages" on public.messages;
drop policy if exists "Anyone can read messages" on public.messages;
drop policy if exists "Anyone can insert messages" on public.messages;

-- Create open policies for messages
create policy "Anyone can read messages"
  on public.messages for select
  to anon, authenticated
  using (true);

create policy "Anyone can insert messages"
  on public.messages for insert
  to anon, authenticated
  with check (true);

-- 6. Grant table permissions to anon & authenticated roles
grant all on public.posts to anon, authenticated;
grant all on public.messages to anon, authenticated;

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'post_comments') then
    grant all on public.post_comments to anon, authenticated;
    drop policy if exists "Anyone can insert comments" on public.post_comments;
    create policy "Anyone can insert comments" on public.post_comments for insert to anon, authenticated with check (true);
  end if;
end $$;

-- 7. Ensure storage buckets allow anonymous uploads
drop policy if exists "Signed-in users upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;
drop policy if exists "Anyone can upload avatars" on storage.objects;
drop policy if exists "Anyone can read avatars" on storage.objects;

create policy "Anyone can upload avatars"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id in ('avatars', 'post-images'));

create policy "Anyone can read avatars"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('avatars', 'post-images'));

-- 8. Refresh schema cache
notify pgrst, 'reload schema';
