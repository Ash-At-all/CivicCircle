-- Area messages. Legacy city/channel rows stay readable only if they
-- already exist; new rows use area_id.

alter table public.messages
  add column if not exists area_id uuid references public.areas (id) on delete cascade,
  add column if not exists scope text check (scope in ('locality', 'ward', 'city')),
  add column if not exists h3_cell text check (
    h3_cell is null or h3_cell ~ '^8[578][0-9a-f]{13}$'
  ),
  add column if not exists client_id uuid,
  add column if not exists author_handle text check (char_length(author_handle) <= 40),
  add column if not exists deleted_at timestamptz;

alter table public.messages alter column city_slug drop not null;
alter table public.messages alter column channel_id drop not null;

-- The original body check rejects the empty body used for soft deletion.
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check
  check (
    char_length(body) <= 2000
    and (deleted_at is not null or char_length(btrim(body)) > 0)
  );

alter table public.messages drop constraint if exists messages_area_body_length;
alter table public.messages
  add constraint messages_area_body_length
  check (area_id is null or char_length(body) <= 500);

alter table public.messages drop constraint if exists messages_area_scope_check;
alter table public.messages
  add constraint messages_area_scope_check
  check (
    area_id is null or (
      scope is not null
      and h3_cell is not null
      and (
        (scope = 'locality' and h3_cell ~ '^88[0-9a-f]{13}$')
        or (scope = 'ward' and h3_cell ~ '^87[0-9a-f]{13}$')
        or (scope = 'city' and h3_cell ~ '^85[0-9a-f]{13}$')
      )
    )
  );

create index if not exists messages_area_created_idx
  on public.messages (area_id, created_at desc, id desc);
create index if not exists messages_author_idx
  on public.messages (author_id);
create unique index if not exists messages_author_client_idx
  on public.messages (author_id, client_id)
  where client_id is not null;

notify pgrst, 'reload schema';
