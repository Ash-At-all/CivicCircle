-- Area chat photos.
--
-- One optional photo per area message. The bucket is private and the app
-- serves short-lived signed URLs (see POST/GET /api/area/messages).
-- The client downscales and re-encodes to webp before upload, which matches
-- the existing post image pipeline (src/lib/client-image.ts).
--
-- Storage path layout is <user_id>/<area_id>/<uuid>.webp so the first folder
-- maps to the uploader and the second one to the room.

set search_path = public, extensions;

alter table public.messages
  add column if not exists photo_path text;

alter table public.messages drop constraint if exists messages_photo_path_check;
alter table public.messages
  add constraint messages_photo_path_check
  check (
    photo_path is null
    or (
      char_length(photo_path) between 1 and 400
      and lower(photo_path) like '%.webp'
    )
  );

-- A photo-only message has an empty body, so the old "body must be non-empty"
-- rule now accepts an attached photo as the alternative.
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check
  check (
    char_length(body) <= 2000
    and (
      deleted_at is not null
      or char_length(btrim(body)) > 0
      or photo_path is not null
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('area-photos', 'area-photos', false, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Signed-in users upload their own area photos" on storage.objects;
create policy "Signed-in users upload their own area photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'area-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) = 'webp'
  );

drop policy if exists "Signed-in users read area photos" on storage.objects;
create policy "Signed-in users read area photos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'area-photos');

drop policy if exists "Users can update their own area photo objects" on storage.objects;
create policy "Users can update their own area photo objects"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'area-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'area-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) = 'webp'
  );

drop policy if exists "Users can delete their own area photo objects" on storage.objects;
create policy "Users can delete their own area photo objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'area-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- A message may only point at an object the author uploaded.
create or replace function public.validate_area_photo_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.photo_path is not null then
    if split_part(new.photo_path, '/', 1) <> (select auth.uid())::text then
      raise exception 'Area photos must belong to the signed-in user';
    end if;
    if not exists (
      select 1
      from storage.objects
      where bucket_id = 'area-photos'
        and name = new.photo_path
    ) then
      raise exception 'Area photo object not found';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_area_photo_path()
  from public, anon, authenticated;

drop trigger if exists messages_validate_photo_path on public.messages;
create trigger messages_validate_photo_path
  before insert or update of photo_path on public.messages
  for each row
  execute function public.validate_area_photo_path();

-- The column grants from 20261114091100 only covered the original columns.
grant insert (photo_path) on public.messages to authenticated;

notify pgrst, 'reload schema';
