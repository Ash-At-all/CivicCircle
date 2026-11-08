-- Remove auth dependency: make author_id nullable, add anon_id columns
alter table public.posts
  alter column author_id drop not null,
  add column if not exists anon_id text;

alter table public.messages
  alter column author_id drop not null,
  add column if not exists anon_id text;

-- Drop FK to auth.users
alter table public.posts
  drop constraint if exists posts_author_id_fkey;

alter table public.messages
  drop constraint if exists messages_author_id_fkey;

-- Drop profiles table (replaced by anon identity)
drop table if exists public.profiles cascade;

-- Drop avatars bucket policies (keep bucket, just remove auth requirements)
drop policy if exists "Signed-in users upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

create policy "Anyone can upload avatars"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'avatars');

create policy "Anyone can read avatars"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "Anyone can delete avatars"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'avatars');

notify pgrst, 'reload schema';
