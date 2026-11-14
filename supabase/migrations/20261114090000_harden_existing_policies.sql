-- Harden the open policies introduced by 20261108000000_remove_auth.sql.
-- Run this before the app uses the real Supabase client.

-- ---------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------
drop policy if exists "Anyone can read posts" on public.posts;
drop policy if exists "Anyone can insert posts" on public.posts;
drop policy if exists "Anyone can update posts" on public.posts;
drop policy if exists "Anyone can delete posts" on public.posts;
drop policy if exists "Users can create posts as themselves" on public.posts;
drop policy if exists "Users can update their own posts" on public.posts;
drop policy if exists "Users can delete their own posts" on public.posts;

create policy "Anyone can read posts"
  on public.posts
  for select
  to anon, authenticated
  using (true);

create policy "Users can create posts as themselves"
  on public.posts
  for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users can update their own posts"
  on public.posts
  for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Users can delete their own posts"
  on public.posts
  for delete
  to authenticated
  using ((select auth.uid()) = author_id);

revoke all on public.posts from public, anon, authenticated;
grant select (id, city_slug, tag, title, body, image_paths, created_at, updated_at)
  on public.posts to anon;
grant select on public.posts to authenticated;
grant insert (city_slug, tag, title, body, image_paths)
  on public.posts to authenticated;
grant update (city_slug, tag, title, body, image_paths)
  on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- remove_auth dropped the author foreign keys. Restore them without
-- failing on legacy rows: NOT VALID enforces new writes immediately.
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete cascade
  not valid;

-- ---------------------------------------------------------------
-- messages
-- The area read and insert policies are added after the area columns
-- exist. Until then, RLS denies access, which is the safe default.
-- ---------------------------------------------------------------
drop policy if exists "Anyone can read messages" on public.messages;
drop policy if exists "Anyone can insert messages" on public.messages;
drop policy if exists "Users can create messages as themselves" on public.messages;
drop policy if exists "Users can delete their own messages" on public.messages;

revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;

-- remove_auth dropped this foreign key.
alter table public.messages drop constraint if exists messages_author_id_fkey;
alter table public.messages
  add constraint messages_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete cascade
  not valid;

-- ---------------------------------------------------------------
-- post_comments
-- ---------------------------------------------------------------
drop policy if exists "Anyone can insert comments" on public.post_comments;
drop policy if exists "Users can create comments as themselves" on public.post_comments;
drop policy if exists "Users can update their own comments" on public.post_comments;
drop policy if exists "Users can delete their own comments" on public.post_comments;

create policy "Users can create comments as themselves"
  on public.post_comments
  for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users can update their own comments"
  on public.post_comments
  for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Users can delete their own comments"
  on public.post_comments
  for delete
  to authenticated
  using ((select auth.uid()) = author_id);

revoke all on public.post_comments from public, anon, authenticated;
grant select (id, post_id, parent_id, body, created_at)
  on public.post_comments to anon, authenticated;
grant insert (post_id, parent_id, author_id, body)
  on public.post_comments to authenticated;
grant update (body) on public.post_comments to authenticated;
grant delete on public.post_comments to authenticated;

alter table public.post_comments drop constraint if exists post_comments_author_id_fkey;
alter table public.post_comments
  add constraint post_comments_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete cascade
  not valid;

-- ---------------------------------------------------------------
-- storage: avatars and post images
-- remove_auth created an open insert policy for both buckets.
-- ---------------------------------------------------------------
drop policy if exists "Anyone can upload avatars" on storage.objects;
drop policy if exists "Anyone can read avatars" on storage.objects;
drop policy if exists "Signed-in users upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

create policy "Signed-in users upload their own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "Anyone can read avatars"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "Users can update their own avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "Users can delete their own avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
