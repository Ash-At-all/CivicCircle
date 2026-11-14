-- Abuse reports gain message, shop, and user targets. The old anonymous
-- check constraint is dropped by its real name, not a guess.

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%post_id%'
      and pg_get_constraintdef(oid) like '%comment_id%'
  loop
    execute format(
      'alter table public.reports drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.reports
  add column if not exists message_id uuid references public.messages (id) on delete cascade,
  add column if not exists shop_id uuid references public.shops (id) on delete cascade,
  add column if not exists target_user_id uuid references auth.users (id) on delete cascade;

alter table public.reports drop constraint if exists reports_one_target;
alter table public.reports
  add constraint reports_one_target
  check (
    (post_id is not null)::integer
    + (comment_id is not null)::integer
    + (message_id is not null)::integer
    + (shop_id is not null)::integer
    + (target_user_id is not null)::integer = 1
  );

create index if not exists reports_message_idx on public.reports (message_id);
create index if not exists reports_shop_idx on public.reports (shop_id);
create index if not exists reports_target_user_idx on public.reports (target_user_id);

revoke all on public.reports from public, anon, authenticated;
grant select on public.reports to authenticated;
grant insert (
  reporter_id,
  post_id,
  comment_id,
  message_id,
  shop_id,
  target_user_id,
  reason,
  details
) on public.reports to authenticated;
grant update (status) on public.reports to authenticated;

notify pgrst, 'reload schema';
