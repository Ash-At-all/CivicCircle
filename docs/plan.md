# CivicCircle Hyperlocal Plan

**Phase:** 1, architecture and delivery plan  
**Date:** 13 November 2026  
**Status:** Awaiting approval. No code or migration changes have been made.  
**Companion document:** `docs/research.md`  
**Implementation notes:** `docs/db-notes.md`

---

## 1. Goal

Add a hyperlocal layer to CivicCircle:

- A locality chat room based on the user's approximate area.
- A nearby shop list with map pins, categories, distance sort, search, details, corrections, and a free claim request.
- An India-local map that stays inside the launch city and does not pretend to be a legal national boundary map.
- Automatic radius expansion for shops and people, with honest messages.
- Strong privacy: no exact user coordinates stored, no location history, no exact user pin.
- Everything on free tiers, with RLS on every table and no service key in the browser.

The launch city is **Chhatrapati Sambhajinagar**.

---

## 2. What is broken today

These are facts from the current repository, not assumptions:

1. `src/lib/supabase/server.ts` is a placeholder object. `getUser()` always returns `null`, inserts always fail, and `getSupabaseServerClient()` is not a real Supabase client.
2. `20261108000000_remove_auth.sql` creates open policies on `posts` and `messages` with `using (true)` and `with check (true)`, and grants `all` to `anon` and `authenticated`. Anyone with the anon key can update or delete any post or message.
3. `supabase/seed.sql` inserts into a `cities` table that does not exist in the migrations.
4. The chat page at `src/app/chat/[roomId]/page.tsx` is a client-side mock with polling and a generated local client id. It is not connected to a real session.
5. The existing UI uses purple gradients, glass cards, and radial glows. New screens must not copy that style.
6. `CivicCircle-app/supabase/migrations` contains modified duplicate migration files. The root `supabase/migrations` folder is the canonical one. I will not delete or rewrite the nested folder without approval.

**Therefore the first implementation deliverable is database hardening, not the map.**

---

## 3. Assumptions

Write these down so they can be challenged:

1. Supabase anonymous sign-in is enabled for the project. It is free and available on the free plan.
2. Cloudflare Turnstile can be configured for anonymous sign-in. If the user does not want it, Supabase's default IP limit of 30 anonymous sign-ins per hour still applies.
3. The app is served from one primary domain. Cookies are first-party and `SameSite=Lax`.
4. The launch city is Chhatrapati Sambhajinagar, with a city bounding box of approximately `lat 19.70 to 20.10`, `lng 75.10 to 75.60`. This box is a safety limit, not an official boundary.
5. OSM data for the city is imported weekly and stored in Supabase. No user request calls Overpass.
6. Photon is used for typeahead and reverse lookup through a server proxy. Nominatim is used only for one-shot lookups with caching, or not at all. The proxy can switch provider through an environment variable without a client release.
7. Map tiles come from the OpenFreeMap public instance. If it fails, the list view still works.
8. English is the default UI language. Hindi labels are shown for core controls. There is no full translation framework in the MVP.
9. Area chat is text only. No images, voice notes, or file attachments in area chat.
10. Chat transport is polling first. Realtime is a later feature flag, not a day-one dependency.
11. Shop claiming is a manual review request. No paid OTP, SMS, or phone verification in the MVP.
12. Existing posts and messages policies will be hardened in the same migration series.
13. No production data exists yet. Migrations can be written for a clean schema, with legacy compatibility where cheap.
14. Browser support: current Chrome on Android, current Safari on iOS 16 and later, current Edge and Firefox. No Internet Explorer.

---

## 4. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Use Supabase anonymous auth plus RLS, with server route handlers for writes | Real user ids for reports, blocks, ownership, and rate limits. RLS stays enforceable. No service key in the browser. |
| D2 | Store only the H3 resolution 8 cell, and use its centroid for queries | About 0.74 km² average area. Coarse enough for privacy, fine enough for a locality room. |
| D3 | Use Postgres for rate limiting, not Upstash | Shared across server instances, no extra vendor, no extra key, no extra quota. Atomic SQL function. |
| D4 | Use polling for chat and presence in the MVP | Realtime free tier allows 2 million messages per month and 200 concurrent connections. Polling with a cursor is cheaper and easier to reason about at launch. |
| D5 | Use MapLibre GL JS plus OpenFreeMap | Free, no key, vector tiles, clustering, custom dark style, commercial use allowed, no request limit. |
| D6 | Use Photon for typeahead, Nominatim only for one-shot cached lookup | Nominatim explicitly forbids autocomplete. Photon supports typeahead under fair use. |
| D7 | Constrain the map to the launch city | Avoids depicting an unverified national boundary. A national map needs authorised Survey of India data and legal review. |
| D8 | Defer paid OTP and automated claim verification | Keeps the stack free. A manual claim request is honest and enough for the MVP. |
| D9 | Add a new `/nearby` route instead of rewriting the existing chat page | The existing chat is a mock. The new feature gets a clean route and does not break current screens. |
| D10 | Seed only real OSM places, plus a city and area skeleton | No fake shops, ratings, reviews, or counters. If the import is empty, the UI shows an honest empty state. |
| D11 | Keep the existing purple design system untouched, and build new screens in charcoal and yellow | The user asked for no purple or blue gradients on new work. A global redesign is a separate project. |

---

## 5. Architecture

```
Browser
  |
  |  geolocation permission (explicit button)
  |  h3-js: lat/lng -> res 8 cell, res 7 parent, res 5 parent
  |  exact lat/lng discarded after cell calculation
  |
  |  POST /api/area/resolve  { h3r8, h3r7, h3r5 }
  v
Next.js route handlers (Node runtime)
  |  real Supabase server client from cookies
  |  zod validation, origin check, moderation, rate-limit RPC
  |  h3-js server validation + centroid calculation
  |  Photon proxy with cache
  v
Supabase
  |  Postgres + PostGIS + pg_trgm
  |  RLS on every app table
  |  Storage bucket shop-photos
  |  no service key in the client
  |
  |  weekly GitHub Action -> Overpass -> normalise -> upsert shops
  v
OpenFreeMap tiles (direct from browser) + OSM attribution
```

### Key flows

**Location flow**

1. User taps "Use my area". This is the only action that requests geolocation.
2. Browser gets latitude and longitude with `enableHighAccuracy: false`.
3. Browser computes the H3 res 8 cell and its res 7 and res 5 parents.
4. Browser sends only the three cell strings to `/api/area/resolve`.
5. Server validates the cells, computes centroids, resolves names through Photon or cache, and upserts the area hierarchy.
6. Server stores `profile_locations.h3_r8`, `locality_area_id`, `ward_area_id`, and `city_area_id`. It never stores latitude or longitude.
7. Server returns area ids, names, and the locality centroid for the map.
8. Browser keeps area ids and centroid in memory. No coordinates in localStorage, analytics, or error reports.

**Shop radius flow**

1. One request returns up to 200 published shops within 50 km, with distance in metres.
2. Client walks `[500, 1000, 2000, 5000, 10000, 25000, 50000]` and picks the first radius with at least 5 shops.
3. Client shows the radius circle, the list, and a message when expansion happened.
4. Slider changes the radius locally. No new request until the area changes.
5. If there are no shops within 50 km, show the empty state and an "Add a shop" action.

**People radius flow**

1. One request returns active people counts for each radius step.
2. Active means a presence heartbeat in the last 90 seconds.
3. Client picks the first radius with at least 1 active person other than the current user, if possible.
4. If there is no one within 50 km, the chat falls back to the city room and shows "Start this area".
5. The room hierarchy (locality, ward, city) can be switched independently of the radius slider.

---

## 6. Database design

All new tables live in `public`. RLS is enabled on every table. `anon` has no write access to any app table. `authenticated` access is scoped by policy. The service role is used only in CI import, local admin scripts, and the server-only geocode cache route. It is never included in a client bundle or a `NEXT_PUBLIC_` variable.

### 6.1 Existing tables to harden

- `profiles`: keep public profile columns readable, but no location columns here.
- `posts`: drop `"Anyone can insert posts"`, `"Anyone can update posts"`, and `"Anyone can delete posts"`; remove `grant all`; restore `author_id = auth.uid()` for insert, update, and delete. Rows with a null author stay read-only.
- `messages`: drop open update and delete policies; remove `grant all`; keep select for authenticated; require `author_id = auth.uid()` for new inserts. Legacy rows with a null author stay read-only.
- `post_comments`: same treatment as posts.
- `reports`: extend with message, shop, and user targets.
- Storage policies: remove broad "anyone can upload avatars" policies and restore folder checks. The old policies allowed any anon user to upload to `avatars` and `post-images`.

The hardening migration must run before the app starts using the real Supabase client. Otherwise the existing open policies remain exploitable.

### 6.2 New tables

#### `profile_locations`

Current area only. One row per user. No history.

```sql
create table public.profile_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  h3_r8 text not null check (char_length(h3_r8) = 15),
  locality_area_id uuid references public.areas (id) on delete set null,
  ward_area_id uuid references public.areas (id) on delete set null,
  city_area_id uuid references public.areas (id) on delete set null,
  show_presence boolean not null default false,
  updated_at timestamptz not null default now()
);
```

Privacy rule: this table is self-only. No other user can select it. No public view includes it. `show_presence` is opt-in and defaults to `false`. The three area ids are used to validate that a user can only read and write in their own locality, zone, or city room.

#### `areas`

Locality, ward, and city nodes.

```sql
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('locality', 'ward', 'city')),
  h3_cell text not null check (char_length(h3_cell) = 15),
  name text not null check (char_length(name) between 1 and 80),
  name_hi text check (char_length(name_hi) <= 80),
  city_slug text not null check (char_length(city_slug) between 2 and 60),
  centroid geography(Point, 4326) not null,
  parent_id uuid references public.areas (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, h3_cell)
);

create index areas_h3_cell_idx on public.areas (h3_cell);
create index areas_parent_idx on public.areas (parent_id);
create index areas_centroid_gix on public.areas using gist (centroid);
```

#### `shops`

```sql
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  osm_type text check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint,
  name text not null check (char_length(name) between 1 and 160),
  name_hi text check (char_length(name_hi) <= 160),
  category text not null,
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 40),
  website text check (char_length(website) <= 300),
  opening_hours text check (char_length(opening_hours) <= 300),
  location geography(Point, 4326) not null,
  h3_r8 text not null check (char_length(h3_r8) = 15),
  source text not null default 'osm' check (source in ('osm', 'community')),
  source_url text check (char_length(source_url) <= 500),
  osm_tags jsonb,
  status text not null default 'published'
    check (status in ('published', 'pending', 'hidden', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  claimed_by uuid references auth.users (id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);

create index shops_location_gix on public.shops using gist (location);
create index shops_h3_r8_idx on public.shops (h3_r8);
create index shops_name_trgm_idx on public.shops using gin (lower(name) gin_trgm_ops);
create index shops_category_idx on public.shops (category) where status = 'published';
```

Category values are fixed in a shared TypeScript constant and a database check:

`food`, `grocery`, `pharmacy`, `health`, `education`, `services`, `repair`, `salon`, `hardware`, `clothing`, `electronics`, `transport`, `other`.

#### `shop_photos`

```sql
create table public.shop_photos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  storage_path text not null unique,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create index shop_photos_shop_idx on public.shop_photos (shop_id, created_at desc);
```

Storage bucket:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-photos',
  'shop-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
```

Storage policies:

- Public read for `shop-photos`.
- Authenticated insert only when the first folder is a valid shop id and the extension is jpg, jpeg, png, or webp.
- Authenticated delete only when `owner = auth.uid()`.
- No anon insert or update.

#### `shop_reports`

Corrections, duplicate flags, claims, and closed-place reports.

```sql
create table public.shop_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('correction', 'duplicate', 'claim', 'closed', 'wrong_location')),
  field text check (char_length(field) <= 40),
  note text not null check (char_length(note) between 3 and 1000),
  contact text check (char_length(contact) <= 160),
  status text not null default 'open'
    check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index shop_reports_shop_idx on public.shop_reports (shop_id, created_at desc);
create index shop_reports_open_idx on public.shop_reports (created_at desc) where status = 'open';
```

`reports` is for abuse. `shop_reports` is for data corrections, duplicates, closed places, and claims. They are separate so a correction does not look like a harassment report.

#### `messages` changes

Keep legacy columns nullable so old rows do not break. New area messages must use the new columns.

```sql
alter table public.messages
  add column area_id uuid references public.areas (id) on delete cascade,
  add column scope text check (scope in ('locality', 'ward', 'city')),
  add column h3_cell text check (h3_cell is null or char_length(h3_cell) = 15),
  add column client_id uuid,
  add column author_handle text check (char_length(author_handle) <= 40),
  add column deleted_at timestamptz;

alter table public.messages alter column city_slug drop not null;
alter table public.messages alter column channel_id drop not null;

create index messages_area_created_idx
  on public.messages (area_id, created_at desc, id desc);
create unique index messages_author_client_idx
  on public.messages (author_id, client_id)
  where client_id is not null;
```

Add a body limit for area messages:

```sql
alter table public.messages
  add constraint messages_area_body_length
  check (area_id is null or char_length(body) <= 500);
```

#### `room_presence`

```sql
create table public.room_presence (
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  home_area_id uuid not null references public.areas (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

create index room_presence_area_seen_idx
  on public.room_presence (area_id, last_seen_at desc);
create index room_presence_home_seen_idx
  on public.room_presence (home_area_id, last_seen_at desc);
create index room_presence_seen_idx
  on public.room_presence (last_seen_at);
```

`area_id` is the room the person is viewing. `home_area_id` is the person's locality. Nearby counts use `home_area_id`, while room activity uses `area_id`. This avoids counting a person who is browsing the city room as if they were standing next to the user.

The table has RLS enabled and no direct client policies. All writes go through the `heartbeat` and `stop_presence` functions. All reads go through `nearby_people` and `room_counts`, which return aggregates only.

#### `rate_limits`

```sql
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null
);

create index rate_limits_expires_idx on public.rate_limits (expires_at);
```

RLS enabled, no policies, `revoke all` from `public`, `anon`, `authenticated`. Only the security definer function touches it.

#### `blocks`

```sql
create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
```

#### `area_mutes`

```sql
create table public.area_mutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, area_id)
);
```

#### `geocode_cache`

Server-only cache for Photon and Nominatim results.

```sql
create table public.geocode_cache (
  key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index geocode_cache_expires_idx on public.geocode_cache (expires_at);
```

RLS enabled, no policies, `revoke all`. Only server routes with the service role or a security definer function can use it. For the MVP, the route uses the service role for cache reads and writes. The key is a cell or a normalised query hash, never raw coordinates.

### 6.3 Existing `reports` extension

```sql
alter table public.reports
  add column message_id uuid references public.messages (id) on delete cascade,
  add column shop_id uuid references public.shops (id) on delete cascade,
  add column target_user_id uuid references auth.users (id) on delete cascade;

alter table public.reports drop constraint if exists reports_check;
alter table public.reports
  add constraint reports_one_target check (
    (post_id is not null)::integer
    + (comment_id is not null)::integer
    + (message_id is not null)::integer
    + (shop_id is not null)::integer
    + (target_user_id is not null)::integer = 1
  );
```

Update the insert grant to include `message_id`, `shop_id`, and `target_user_id`. The reporter id still defaults to `auth.uid()`.

The original check constraint is unnamed, so its generated name must be confirmed from `pg_constraint` on staging. The migration will drop the constraint by its actual name, not assume `reports_check`.

### 6.4 Indexes and extensions

```sql
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
```

PostGIS provides `geography` and `ST_DWithin`. `pg_trgm` provides `similarity` and the GIN index for duplicate detection.

Supabase installs extensions in the `extensions` schema. The RPC functions must use `set search_path = public, extensions` or qualify every extension function. The trigram index must use `extensions.gin_trgm_ops` if the migration does not have `extensions` on its search path. This will be tested on the staging project before the main migration set is considered done.

---

## 7. RLS and grants

Every table has RLS enabled. The matrix below is the contract.

| Table | `anon` | `authenticated` | Notes |
|---|---|---|---|
| `profiles` | select public columns | select; insert/update/delete own | No location columns here |
| `profile_locations` | none | select/insert/update/delete own only | Self-only, includes `show_presence`, no aggregate view |
| `areas` | none | select all | Inserts only through `ensure_area` |
| `shops` | none | select published; insert community shop; update own pending? | No direct delete |
| `shop_photos` | none | select published; insert own; delete own | Storage folder check |
| `shop_reports` | none | insert own; select own | No update |
| `messages` | none | select visible; insert own; update own `deleted_at` | Block filter and area hierarchy in policies |
| `room_presence` | none | none | Writes through `heartbeat`, reads through aggregate RPCs |
| `blocks` | none | select/insert/delete own blocker rows | No access to other users' blocks |
| `area_mutes` | none | select/insert/delete own | |
| `rate_limits` | none | none | Security definer only |
| `geocode_cache` | none | none | Server only |
| `reports` | none | insert own; select own | Moderator policy stays |
| `posts` | select | select; insert/update/delete own | Open write policies removed |
| `post_comments` | select | select; insert/update/delete own | Open write policies removed |

### Messages select policy

```sql
create policy "Authenticated users can read area messages"
  on public.messages
  for select
  to authenticated
  using (
    area_id is not null
    and not exists (
      select 1
      from public.blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = public.messages.author_id
    )
  );
```

### Messages insert policy

```sql
create policy "Authenticated users can send area messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and area_id is not null
    and deleted_at is null
    and exists (
      select 1
      from public.profile_locations pl
      where pl.user_id = (select auth.uid())
        and public.messages.area_id in (
          pl.locality_area_id,
          pl.ward_area_id,
          pl.city_area_id
        )
    )
  );
```

Grant only the columns the client needs:

```sql
revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;
grant insert (area_id, scope, h3_cell, client_id, author_id, author_handle, body)
  on public.messages to authenticated;
grant update (deleted_at) on public.messages to authenticated;
```

### Shops write policy

Community shops are inserted by authenticated users with RLS, not by the service role:

```sql
create policy "Authenticated users can add community shops"
  on public.shops
  for insert
  to authenticated
  with check (
    source = 'community'
    and status = 'published'
    and created_by = (select auth.uid())
  );
```

The route also checks the city bounding box, duplicate detection, and rate limit. OSM imports use the service role in CI.

### Functions

#### `ensure_area`

Create `consume_rate_limit` before this function in the migration, because `ensure_area` calls it.

Security definer, validates cell format and city bounds, upserts the area, returns the row.

```sql
create or replace function public.ensure_area(
  p_kind text,
  p_h3 text,
  p_name text,
  p_name_hi text,
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_parent_id uuid
)
returns public.areas
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_area public.areas;
begin
  if p_kind not in ('locality', 'ward', 'city') then
    raise exception 'invalid area kind';
  end if;
  if char_length(p_h3) <> 15 then
    raise exception 'invalid cell';
  end if;
  if p_lat not between 19.70 and 20.10 or p_lng not between 75.10 and 75.60 then
    raise exception 'area outside launch city';
  end if;

  if not (
    select allowed
    from public.consume_rate_limit('area-create', 60, 86400)
  ) then
    raise exception 'area rate limit';
  end if;

  insert into public.areas (kind, h3_cell, name, name_hi, city_slug, centroid, parent_id)
  values (
    p_kind,
    p_h3,
    left(trim(p_name), 80),
    nullif(left(trim(coalesce(p_name_hi, '')), 80), ''),
    p_city,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_parent_id
  )
  on conflict (kind, h3_cell) do update
    set name = excluded.name,
        name_hi = coalesce(public.areas.name_hi, excluded.name_hi),
        parent_id = coalesce(public.areas.parent_id, excluded.parent_id)
  returning * into v_area;

  return v_area;
end;
$$;

revoke all on function public.ensure_area(text, text, text, text, text, double precision, double precision, uuid)
  from public, anon;
grant execute on function public.ensure_area(text, text, text, text, text, double precision, double precision, uuid)
  to authenticated;
```

The function accepts cell strings but not H3 itself. The route validates the cell with `h3-js` before calling. The function also consumes an `area-create` rate-limit slot, so a client cannot create thousands of junk areas through the RPC.

#### `consume_rate_limit`

Atomic, user-scoped. The client cannot choose another user's key.

```sql
create or replace function public.consume_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
  v_key text;
  v_now timestamptz := now();
  v_row public.rate_limits;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit policy';
  end if;

  v_key := p_action || ':' || v_uid::text;

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
  end if;

  return query select true, greatest(0, p_limit - v_row.count), 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;
```

#### `nearby_shops`

Returns published shops within a radius, with distance. Security invoker so RLS applies.

```sql
create or replace function public.nearby_shops(
  p_lat double precision,
  p_lng double precision,
  p_max_m integer default 50000
)
returns table (
  id uuid,
  name text,
  name_hi text,
  category text,
  address text,
  phone text,
  website text,
  opening_hours text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  source text,
  source_url text,
  last_verified_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id,
    s.name,
    s.name_hi,
    s.category,
    s.address,
    s.phone,
    s.website,
    s.opening_hours,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    st_distance(
      s.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m,
    s.source,
    s.source_url,
    s.last_verified_at
  from public.shops s
  where s.status = 'published'
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      least(greatest(p_max_m, 100), 50000)
    )
  order by distance_m asc
  limit 200;
$$;

revoke all on function public.nearby_shops(double precision, double precision, integer)
  from public, anon;
grant execute on function public.nearby_shops(double precision, double precision, integer)
  to authenticated;
```

#### `nearby_people`

Returns counts per radius step. Security definer because it aggregates other users' presence, but it returns only counts, never user ids.

```sql
create or replace function public.nearby_people(
  p_lat double precision,
  p_lng double precision
)
returns table (radius_m integer, active_people integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with steps(radius_m) as (
    values (500), (1000), (2000), (5000), (10000), (25000), (50000)
  )
  select
    steps.radius_m,
    (
      select count(distinct rp.user_id)::integer
      from public.room_presence rp
      join public.areas a on a.id = rp.home_area_id
      where rp.last_seen_at > now() - interval '90 seconds'
        and rp.user_id <> (select auth.uid())
        and not exists (
          select 1
          from public.blocks b
          where b.blocker_id = (select auth.uid())
            and b.blocked_id = rp.user_id
        )
        and st_dwithin(
          a.centroid,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          steps.radius_m
        )
    ) as active_people
  from steps
  order by steps.radius_m;
$$;

revoke all on function public.nearby_people(double precision, double precision)
  from public, anon;
grant execute on function public.nearby_people(double precision, double precision)
  to authenticated;
```

`active_people` excludes the caller. The UI adds the caller only when their own heartbeat succeeded, so "3 people active now" means the caller plus two others.

#### `room_counts`

```sql
create or replace function public.room_counts(p_area_ids uuid[])
returns table (area_id uuid, active_people integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    a.id as area_id,
    count(distinct rp.user_id)::integer as active_people
  from public.areas a
  left join public.room_presence rp
    on rp.area_id = a.id
    and rp.last_seen_at > now() - interval '90 seconds'
    and rp.user_id <> (select auth.uid())
    and not exists (
      select 1
      from public.blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = rp.user_id
    )
  where a.id = any(p_area_ids)
  group by a.id;
$$;

revoke all on function public.room_counts(uuid[]) from public, anon;
grant execute on function public.room_counts(uuid[]) to authenticated;
```

#### `heartbeat` and `stop_presence`

Presence writes do not go through the table. The functions validate that the user has an area and has opted in.

```sql
create or replace function public.heartbeat(p_area_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
  v_home uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select locality_area_id into v_home
  from public.profile_locations
  where user_id = v_uid and show_presence = true;

  if v_home is null then
    raise exception 'presence is off';
  end if;

  if not exists (
    select 1
    from public.profile_locations
    where user_id = v_uid
      and p_area_id in (locality_area_id, ward_area_id, city_area_id)
  ) then
    raise exception 'area not allowed';
  end if;

  insert into public.room_presence (area_id, user_id, home_area_id, last_seen_at)
  values (p_area_id, v_uid, v_home, now())
  on conflict (area_id, user_id) do update
    set home_area_id = excluded.home_area_id,
        last_seen_at = now();
end;
$$;

create or replace function public.stop_presence()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  update public.profile_locations
  set show_presence = false, updated_at = now()
  where user_id = v_uid;

  delete from public.room_presence where user_id = v_uid;
end;
$$;

revoke all on function public.heartbeat(uuid) from public, anon;
revoke all on function public.stop_presence() from public, anon;
grant execute on function public.heartbeat(uuid) to authenticated;
grant execute on function public.stop_presence() to authenticated;
```

#### `delete_message`

Soft delete clears the body, so the row can be returned as "Message removed" without leaking the original text.

```sql
create or replace function public.delete_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.messages
  set body = '', deleted_at = now()
  where id = p_id
    and author_id = (select auth.uid())
    and deleted_at is null;

  if not found then
    raise exception 'message not found';
  end if;
end;
$$;

revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;
```

---

## 8. Privacy design

### 8.1 No exact coordinates

- Geolocation is read in the browser only.
- The browser computes the H3 cell and discards latitude and longitude.
- The network payload contains cell strings, not coordinates.
- Server logs must not contain `lat`, `lng`, or coordinate arrays. The logger is already a small wrapper and will be checked.
- Error reporting, if added later, must redact request bodies for area routes.

### 8.2 No location history

- `profile_locations` has one row per user and is updated in place.
- No append-only location table.
- No analytics events with coordinates.
- No "places you visited" feature.

### 8.3 No exact user point on the map

- The map shows the area centroid and a radius circle.
- There is no user dot.
- Shop pins are public business locations, not user locations.
- The "Add shop" flow can place a pin for a business, with the label "Shop location, not your location."

### 8.4 User controls

- "Change area": reruns the consent and area picker.
- "Use my area": requests geolocation.
- "Choose area manually": uses Photon search and stores the chosen area cell.
- "Clear my area": deletes `profile_locations`, clears local state, leaves the room.
- "Show me as active nearby": an explicit opt-in checkbox. It is off by default. Presence is not written until the user turns it on.
- "Stop showing me": calls `stop_presence`, deletes the presence rows, sets `show_presence` to false, and hides the user from counts.
- "Ghost handle": generated on first visit, editable, reroll limited to once per day.
- "Report", "Block", "Mute": available from messages and shop pages.

A user can read and chat without ever appearing in a presence count. The privacy policy must state that presence is opt-in.

### 8.5 Ghost handle

- Format: `quiet_lake_4821` for the unique username, "Quiet Lake" for the display name.
- Generated from local word lists. No real name, email, or phone number.
- Stored in `profiles.username` and `profiles.display_name`.
- Displayed in chat. The user id is never shown.
- Reroll changes the display name and username, with a 24-hour cooldown. Old messages keep an `author_handle` snapshot so history does not rewrite itself.

### 8.6 Retention

- `profile_locations`: current row only, deleted when the user clears the area.
- `room_presence`: stale rows older than 24 hours deleted by a monthly job.
- `rate_limits`: expired rows deleted by a daily job.
- `messages`: 180-day retention for locality and ward rooms, 365-day retention for city rooms. Reported messages are excluded from automatic deletion.
- `shop_reports`: claim contact details are visible only to the reviewer, are not public, and are deleted 90 days after the report is resolved.
- `geocode_cache`: 30-day expiry, purged monthly.
- Anonymous auth users: a documented SQL cleanup for users older than 30 days with no messages, run monthly. This is not automatic in Supabase.

The privacy policy must state these retention windows.

---

## 9. Radius algorithm

### 9.1 Constants

```ts
export const RADIUS_STEPS_M = [500, 1000, 2000, 5000, 10000, 25000, 50000] as const;
export const MIN_SHOPS = 5;
export const MIN_ACTIVE_PEOPLE = 1;
export const MAX_SHOPS = 200;
```

`MIN_ACTIVE_PEOPLE` counts other people. The current user is excluded by `nearby_people`, so a user cannot satisfy the threshold alone.

### 9.2 Shop selection

```ts
type ShopWithDistance = { id: string; distance_m: number };

export function chooseShopRadius(shops: ShopWithDistance[]) {
  const sorted = [...shops].sort((a, b) => a.distance_m - b.distance_m);
  let previousCount = 0;

  for (const step of RADIUS_STEPS_M) {
    const count = sorted.filter((shop) => shop.distance_m <= step).length;
    if (count >= MIN_SHOPS) {
      return {
        radius: step,
        shops: sorted.filter((shop) => shop.distance_m <= step),
        expanded: step > RADIUS_STEPS_M[0] && previousCount < MIN_SHOPS,
        previousCount,
        previousRadius: RADIUS_STEPS_M[Math.max(0, RADIUS_STEPS_M.indexOf(step) - 1)],
      };
    }
    previousCount = count;
  }

  return {
    radius: 50000,
    shops: sorted.filter((shop) => shop.distance_m <= 50000),
    expanded: true,
    previousCount,
    previousRadius: 25000,
    exhausted: true,
  };
}
```

### 9.3 People selection

```ts
export function choosePeopleRadius(counts: { radius_m: number; active_people: number }[]) {
  const sorted = [...counts].sort((a, b) => a.radius_m - b.radius_m);

  for (const item of sorted) {
    if (item.active_people >= MIN_ACTIVE_PEOPLE) {
      return { radius: item.radius_m, count: item.active_people, exhausted: false };
    }
  }

  return { radius: 50000, count: 0, exhausted: true };
}
```

Presence counts exclude the current user. The UI adds the current user only after a successful heartbeat. It never shows a count without a heartbeat.

### 9.4 UI messages

| Condition | Message |
|---|---|
| 5 or more shops in the first step | "Showing shops within 500 m." |
| Expanded from 1 km to 2 km | "Only 3 shops within 1 km, so we expanded to 2 km." |
| 50 km exhausted with shops | "Showing the closest 12 shops within 50 km." |
| 50 km exhausted with no shops | "No shops are listed within 50 km yet. Add the first one." |
| 1 or more other active people | "3 other people active within 2 km." |
| Only the current user | "You are the only one active here right now." |
| No one within 50 km | "No one is active nearby right now." |
| No one within 50 km, city room fallback | "We moved you to the city room. Start this area to invite people nearby." |

The message is always a statement of fact, not a growth prompt. "Start this area" opens the composer in the locality room. It does not post a fake system message.

### 9.5 Slider

- Slider values: the seven steps, labelled `500 m`, `1 km`, `2 km`, `5 km`, `10 km`, `25 km`, `50 km`.
- Default position: the auto-selected radius.
- Manual change: filters the already-loaded shop list and moves the circle. No new request.
- "Use suggested radius" link resets to the auto value.
- `aria-valuetext` announces the radius and shop count.

---

## 10. Rooms and chat

### 10.1 Room hierarchy

- Locality: H3 res 8. Default.
- Ward or zone: H3 res 7 parent.
- City: H3 res 5 parent.

The header shows the current scope and a segmented control:

`Locality` | `Zone` | `City`

Switching up is always allowed. Switching down is allowed only to the user's own locality or a parent the user has visited. The app never creates a room for a cell the user has not selected. No public room directory of every cell.

### 10.2 Message list

- Initial load: last 50 messages, oldest to newest in the UI.
- Infinite scroll up: cursor on `(created_at, id)`, 50 per page.
- Polling: every 15 seconds while the tab is visible, every 60 seconds while hidden, using a `since` cursor. A response with no new messages is small.
- If the user is scrolled up, new messages do not jump the viewport. Show a "New messages" button.
- Date separators in `Asia/Kolkata`.
- Own messages right-aligned with a yellow-tinted surface, not a gradient.
- Other messages left-aligned on a flat surface with a handle and time.
- Deleted messages show "Message removed" in a muted style.

### 10.3 Send flow

1. User submits. Validate client-side: non-empty, 500 characters or fewer, at most one URL.
2. Create a temporary id. Add the message with status `sending`.
3. POST `/api/area/messages` with `areaId`, `body`, `clientId`. The server sets `author_id` from the session and `author_handle` from the profile snapshot.
4. On 201, replace the temporary message with the server row.
5. On 429, keep the text in the composer, show a friendly countdown, and mark the bubble as failed. The user can retry after the countdown.
6. On network error, mark the bubble as failed with a "Retry" button. Do not lose the text.
7. On success, clear the composer and scroll to the bottom only if the user was near the bottom.
8. The unique `(author_id, client_id)` index prevents duplicate sends when the user retries after a timeout.

### 10.4 Presence heartbeat

- Presence is off until the user turns on "Show me as active nearby". The consent card has this unchecked by default.
- The explicit toggle calls POST `/api/area/presence` with `optIn: true` once. The server sets `profile_locations.show_presence = true`. Later heartbeats do not change the setting.
- When enabled, POST `/api/area/presence` immediately on entering a room, then every 30 seconds while visible.
- Server calls `heartbeat(areaId)`. The function reads the user's locality as `home_area_id`, validates that `areaId` is in the user's locality, zone, or city, and upserts `(area_id, user_id, home_area_id, last_seen_at)`.
- The API never accepts `home_area_id` from the client.
- Server rate limit: 4 heartbeats per minute.
- On "Stop showing me", call `stop_presence`, which sets `show_presence` to false and deletes the rows.
- On page unload, send a `keepalive` DELETE if possible. If it fails, the 90-second stale window handles it.
- Counts are queried every 30 seconds through `room_counts` or `nearby_people`. Both exclude the current user.

### 10.5 Rate limits

| Action | Limit | Window |
|---|---|---|
| Area message send | 30 | 60 seconds |
| Area message read | 600 | 1 hour |
| Nearby shops and people read | 240 | 1 hour |
| Presence heartbeat | 4 | 60 seconds |
| Shop add | 3 | 24 hours |
| Shop correction or claim | 10 | 1 hour |
| Shop photo | 10 | 24 hours |
| Shop detail read | 240 | 1 hour |
| Report | 10 | 1 hour |
| Block | 30 | 1 hour |
| Area resolve | 10 | 1 hour |
| Area create RPC | 60 | 24 hours |
| Geocode search | 120 | 1 hour |
| Ghost handle reroll | 1 | 24 hours |
| Clear area | 10 | 1 hour |
| Mute or unmute | 30 | 1 hour |

All use `consume_rate_limit`. The route returns HTTP 429 with `Retry-After` and this body:

```json
{
  "error": "You are sending messages too quickly. Try again in 12 seconds.",
  "code": "rate_limited",
  "retry_after": 12
}
```

The UI shows the same message. It does not blame the user or use a generic "Something went wrong".

### 10.6 Shared rate limiter migration

The must-fix is not only for new routes. Every existing route that imports `enforceRateLimit` must move to the shared store.

- Replace `src/lib/rate-limit/index.ts` with an async `enforceRateLimit(supabase, action)` wrapper that calls `consume_rate_limit`, maps the result to HTTP 429 with `Retry-After`, and returns `null` when allowed.
- Add `src/lib/rate-limit/policy.ts` with the limits and friendly labels.
- Update every route that imports `enforceRateLimit`: `api/posts`, `api/posts/[id]`, `api/posts/[id]/comments`, `api/posts/[id]/votes`, `api/posts/images`, `api/posts/validate`, `api/messages`, `api/messages/validate`, `api/comments/validate`, `api/reports`, `api/blocks`, `api/profiles`, `api/profiles/[username]`, `api/profiles/avatar`.
- Create the Supabase server client before the rate-limit call, because the function needs the user session.
- Delete `src/lib/rate-limit/memory.ts` and `src/lib/rate-limit/redis.ts`.
- Remove Upstash environment variables and comments from `.env.example` and the README.
- Add a lint check or a search in CI that fails if `memory` or `redis` rate-limiter imports return.

The in-memory limiter is per process. It cannot protect a multi-instance deployment, and it is not a real limit. It is removed, not kept as a fallback.

### 10.7 Moderation

- Normalise text: lowercase, collapse whitespace, remove zero-width characters, map common leetspeak substitutions.
- Reject if the normalised text matches the local slur list.
- Reject more than one URL.
- Reject control characters.
- Do not auto-link URLs. Render them as plain text or safe links with `rel="nofollow noopener noreferrer"`.
- Report and block are stored. Mute is stored and also reflected locally.
- Blocking a user hides their messages from the blocker and removes them from the blocker's presence counts.
- No shadowban, no hidden ranking, no fake "message removed by moderator" unless a moderator actually acted.

---

## 11. Shops

### 11.1 List

Each card shows:

- Name, with Hindi name if available.
- Category label.
- Address, or "Address not listed".
- Distance, formatted as `350 m`, `1.2 km`, `12 km`, with an accessible label "approximate distance from your area centre".
- Call button if a phone number exists.
- Directions button.
- Source badge: "OpenStreetMap" or "Added by community".
- Open status only if the hours parser is confident. Otherwise "Hours not listed" or "Hours: <raw>".

No ratings, no reviews, no "popular" labels, no fake photo counts.

All distances are measured from the area centroid, not from the user's exact location. The detail page says "approx. 1.2 km from your area centre". This is honest and consistent with the privacy design.

### 11.2 Filters and sort

- Category: a labelled `<select>` with all categories and "All categories". This avoids a wall of pill buttons.
- Sort: "Nearest first" by default. The only other option in the MVP is "Name A to Z".
- Search: a labelled text input that filters the loaded shops by name and address. Debounced 200 ms. No server call per keystroke.
- Result count: "12 shops within 2 km."

### 11.3 Detail page

Route: `/shops/[shopId]`

- Name, category, address, approximate distance from the area centroid.
- Map preview with one pin and a "Open in map" link.
- Phone, website, hours.
- Photos, if any. One photo per shop in the first release, with an "Add photo" action.
- Source and last checked date.
- "Suggest a correction" form.
- "This is my business" claim form.
- "Report" action.
- No reviews, no star ratings, no "verified" badge unless a human reviewed the claim.
- If the shop is hidden, show a not-found state, not a partial record.

### 11.4 Add a shop

Route: `/shops/new`

Fields: name, category, address, phone, website, hours, location pin.

- Default map centre is the area centroid, never the user's location.
- The pin is a public business location. The form says so.
- Server validates the pin is inside the city bounding box.
- Duplicate check runs before insert:
  - Same city.
  - Within 50 m.
  - `similarity(lower(name), lower(input)) > 0.55`.
  - Returns up to 3 candidates.
- If a candidate exists, the client shows "This looks like an existing shop" with links to the candidates and a "Suggest a correction" option. It does not silently create a duplicate.
- Rate limit: 3 shops per day.
- New community shops are published immediately, with a source badge and a report path. No fake "under review" state.

### 11.5 Corrections and claims

- Correction form: field selector, new value or note, optional contact. Inserts `shop_reports` with `kind='correction'` or `kind='wrong_location'`.
- Claim form: name, role, contact, note. Inserts `kind='claim'`. The UI says "We will review this request. Claiming does not change the listing automatically."
- Closed place: `kind='closed'`.
- Duplicate: `kind='duplicate'`.
- All reports are reviewed manually in SQL or a future admin page. No admin UI in the MVP.
- Accepted corrections update the shop through an admin script. The UI shows the current data, not the pending suggestion.

### 11.6 Photos

- Client-side compression with canvas: max 1600 px on the long edge, JPEG quality 0.72, target under 500 KB, hard limit 5 MB.
- Upload to Supabase Storage bucket `shop-photos`, path `<shop_id>/<uuid>.jpg`.
- Insert a `shop_photos` row with width and height.
- Display with a plain `<img>` with `loading="lazy"` and `decoding="async"`. Use `next/image` only if `next.config.ts` adds the Supabase host to `images.remotePatterns`; the MVP does not need the extra config.
- No Supabase image transformations, because they are not included on the free plan.
- One photo per user per shop per day. 10 photos per day per user.
- Photos are visible immediately, with a report action. A reported photo is hidden by an admin SQL update.
- If storage approaches 1 GB, disable new uploads with an honest message.

---

## 12. Map

### 12.1 Library setup

- `maplibre-gl` is dynamically imported in a client component. It is not imported in the root layout or any server component.
- Set the worker URL for Next 16 and Turbopack:

```ts
import { setWorkerUrl } from "maplibre-gl";
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
```

- Import `maplibre-gl/dist/maplibre-gl.css` in the map component.
- Create the map only after the area is resolved and the container has a fixed height.

### 12.2 Style

- Base style: OpenFreeMap dark.
- Fetch the style JSON once, clone it, and adjust:
  - Background to `#171921`.
  - Water to `#11131a`.
  - Roads to `#2a2d3a`.
  - Labels to `#c9cbd6`.
  - Hide POI and transit layers for performance and visual calm.
- If the style fetch fails, pass the OpenFreeMap style URL directly. The map still works.
- Keep the attribution control visible. Add "OpenStreetMap contributors" in the map footer and in the shop list.
- No country boundary layer. No national view.

### 12.3 City constraint

```ts
const CITY_BOUNDS: [[number, number], [number, number]] = [
  [75.10, 19.70],
  [75.60, 20.10],
];
```

- `maxBounds: CITY_BOUNDS`.
- `minZoom: 10`.
- `maxZoom: 18`.
- No `fitBounds` to a national extent.
- The map cannot be panned or zoomed to a disputed border area.

### 12.4 Clustering

GeoJSON source:

```ts
{
  type: "geojson",
  data: shopFeatureCollection,
  cluster: true,
  clusterRadius: 48,
  clusterMaxZoom: 15,
}
```

Layers:

1. Cluster circles, yellow with charcoal text.
2. Cluster count labels.
3. Unclustered shop points, off-white with a charcoal stroke.
4. Selected shop point, yellow ring.

Click a cluster to zoom in. Click a point to select the shop and open its card in the sheet or list. No DOM markers. No animation beyond a 150 ms selected state.

### 12.5 Radius circle

Generate a 64-point polygon with the haversine formula. Add a fill layer at 6 percent opacity and a 1.5 px yellow line. No pulse. The circle is centred on the area centroid. There is no user dot.

### 12.6 Labels

- Prefer `name:hi`, then `name:en`, then `name` for place labels.
- Apply a `text-field` expression to place and road label layers after the style loads.
- If a layer does not support the expression, skip it. Do not break the map.
- The UI language toggle changes labels, not user-generated content.

### 12.7 Performance

- `antialias: false` when `navigator.deviceMemory <= 4` or `hardwareConcurrency <= 4`.
- `maxTileCacheSize: 40`.
- `fadeDuration: 0`.
- `dragRotate: false`.
- `pitchWithRotate: false`.
- Lazy load the map after the consent card is painted, using `requestIdleCallback` with a 2-second timeout fallback.
- Preconnect to `https://tiles.openfreemap.org`.
- Cap the shop list at 200. Cluster the rest.
- Use `content-visibility: auto` on long lists.
- Test on Chrome with 4x CPU throttling and Slow 3G.

### 12.8 Failure state

If MapLibre fails to initialise or tiles fail:

- Keep the list visible.
- Show a flat panel: "The map could not load. You can still browse the shop list."
- Add a "Try again" button.
- Do not show a blank black area.

---

## 13. Responsive layout

### 13.1 Mobile

```
+----------------------------------+
| Header: area name, scope switch  |
+----------------------------------+
|                                  |
|            Map                   |
|      (about 42dvh)               |
|                                  |
+----------------------------------+
| Drag handle                      |
| Tabs: Chat | Shops | Posts       |
|                                  |
| Sheet content                    |
| (snap 35%, 60%, 90%)             |
+----------------------------------+
```

- The map fills the top area under the header.
- The bottom sheet overlays the map. It has three snap points and a visible drag handle.
- The sheet is a `<section>` with `role="dialog"` only when expanded to 90 percent. Otherwise it is a normal region.
- Tabs use `role="tablist"`, `aria-selected`, and arrow-key navigation.
- The composer stays above the keyboard with `env(safe-area-inset-bottom)`.
- The bottom navigation is hidden on the Nearby route to avoid double navigation, or kept with a clear active state. Decision: hide it on `/nearby` and provide a back link to Home. This gives the map more room.
- The sheet handle is a button with `aria-label="Expand or collapse panel"`. Arrow keys change snap points.

### 13.2 Desktop

```
+-------------------+-----------------------------+
| Sidebar           | Left panel (420px)          |
|                   | Tabs: Chat | Shops | Posts  |
|                   | List or chat                |
|                   |                             |
|                   | Right: map (sticky)         |
+-------------------+-----------------------------+
```

- Left panel: 420 px, scrolls independently.
- Right: map fills the remaining width and the viewport height.
- The radius slider and area switcher sit above the tabs.
- The list and map share selection state. Hovering a card highlights the pin. Selecting a pin scrolls the card into view.
- No hover-only actions. Every action is available by click or keyboard.

### 13.3 Posts tab

- Shows existing city posts from `posts` where `city_slug = 'sambhajinagar'`, limit 20.
- Label: "City posts".
- Read-only in the MVP. No composer.
- Empty state: "No city posts yet."
- If the posts table is not wired yet, show the empty state, not fake content.

---

## 14. API surface

All routes are under `src/app/api`. All state-changing routes require an authenticated anonymous session, validate the `Origin` header, parse JSON with a size limit, and use zod.

| Method | Route | Purpose | Rate limit |
|---|---|---|---|
| POST | `/api/area/resolve` | Validate cells, resolve names, upsert areas and profile location | 10/hour |
| DELETE | `/api/area/location` | Clear the stored area and presence | 10/hour |
| GET | `/api/area/nearby` | Shops within 50 km and people counts per step | 240/hour |
| GET | `/api/area/messages` | Last 50 or cursor page | 600/hour |
| POST | `/api/area/messages` | Send a message | 30/minute |
| POST | `/api/area/presence` | Heartbeat, `optIn: true` only on the explicit toggle | 4/minute |
| DELETE | `/api/area/presence` | Stop showing me | 10/hour |
| POST | `/api/area/block` | Block a user | 30/hour |
| DELETE | `/api/area/block` | Unblock a user | 30/hour |
| POST | `/api/area/mute` | Mute an area | 30/hour |
| DELETE | `/api/area/mute` | Unmute an area | 30/hour |
| POST | `/api/area/report` | Report a message, shop, or user | 10/hour |
| POST | `/api/profile/handle` | Reroll the ghost handle | 1/day |
| GET | `/api/geocode` | Photon proxy, cached, debounced | 120/hour |
| GET | `/api/shops/[shopId]` | Shop detail | 240/hour |
| POST | `/api/shops` | Add a community shop | 3/day |
| POST | `/api/shops/[shopId]/correct` | Correction, claim, closed, duplicate | 10/hour |
| POST | `/api/shops/[shopId]/photos` | Register an uploaded photo | 10/day |

### Response conventions

```json
{ "error": "Human readable message", "code": "machine_code", "retry_after": 12 }
```

Codes: `auth_required`, `invalid_request`, `invalid_area`, `rate_limited`, `moderation_blocked`, `duplicate_shop`, `not_found`, `server_error`.

### Auth and session

- Replace the placeholder `src/lib/supabase/server.ts` with a real `createServerClient` from `@supabase/ssr`.
- Replace the placeholder `src/lib/supabase/client.ts` with a real `createBrowserClient`.
- Add `src/proxy.ts` for Supabase session refresh. Proxy is not authorization; every route still checks `getUser()`.
- Add a client provider that calls `signInAnonymously()` once if there is no session.
- Turnstile token is passed to `signInAnonymously({ options: { captchaToken } })` when configured.
- On the first successful auth, `ensureProfile(user)` creates a ghost handle in `profiles.username` and `profiles.display_name`. It retries on a unique username collision and never asks for an email or phone.
- If auth fails, show a setup error, not a fake signed-in state.

---

## 15. File plan

### New pages

```
src/app/(app)/nearby/page.tsx
src/app/(app)/nearby/layout.tsx
src/app/(app)/nearby/loading.tsx
src/app/(app)/nearby/error.tsx
src/app/(app)/shops/[shopId]/page.tsx
src/app/(app)/shops/[shopId]/loading.tsx
src/app/(app)/shops/[shopId]/not-found.tsx
src/app/(app)/shops/new/page.tsx
```

### New components

```
src/components/nearby/area-shell.tsx
src/components/nearby/area-consent.tsx
src/components/nearby/area-switcher.tsx
src/components/nearby/radius-control.tsx
src/components/nearby/area-map.tsx
src/components/nearby/area-sheet.tsx
src/components/nearby/chat-panel.tsx
src/components/nearby/message-bubble.tsx
src/components/nearby/shops-panel.tsx
src/components/nearby/posts-panel.tsx
src/components/nearby/empty-panel.tsx
src/components/shops/shop-card.tsx
src/components/shops/shop-detail.tsx
src/components/shops/shop-form.tsx
src/components/shops/correction-form.tsx
src/components/shops/claim-form.tsx
src/components/shops/photo-upload.tsx
```

### New feature modules

```
src/features/area/h3.ts
src/features/area/radius.ts
src/features/area/schema.ts
src/features/area/types.ts
src/features/area/names.ts
src/features/shops/categories.ts
src/features/shops/hours.ts
src/features/shops/schema.ts
src/features/shops/types.ts
src/features/shops/dedupe.ts
src/lib/moderation/text.ts
src/lib/rate-limit/postgres.ts
```

### New API routes

```
src/app/api/area/resolve/route.ts
src/app/api/area/location/route.ts
src/app/api/area/nearby/route.ts
src/app/api/area/messages/route.ts
src/app/api/area/presence/route.ts
src/app/api/area/block/route.ts
src/app/api/area/mute/route.ts
src/app/api/area/report/route.ts
src/app/api/profile/handle/route.ts
src/app/api/geocode/route.ts
src/app/api/shops/route.ts
src/app/api/shops/[shopId]/route.ts
src/app/api/shops/[shopId]/correct/route.ts
src/app/api/shops/[shopId]/photos/route.ts
```

### Migrations

```
supabase/migrations/20261114090000_harden_existing_policies.sql
supabase/migrations/20261114090100_extensions_and_helpers.sql
supabase/migrations/20261114090200_create_areas.sql
supabase/migrations/20261114090250_create_profile_locations.sql
supabase/migrations/20261114090300_create_shops.sql
supabase/migrations/20261114090400_create_shop_photos_and_reports.sql
supabase/migrations/20261114090500_alter_messages_for_areas.sql
supabase/migrations/20261114090550_alter_reports_for_areas.sql
supabase/migrations/20261114090600_create_presence.sql
supabase/migrations/20261114090700_create_rate_limits.sql
supabase/migrations/20261114090800_create_blocks_and_mutes.sql
supabase/migrations/20261114090900_create_geocode_cache.sql
supabase/migrations/20261114091000_create_rpc_functions.sql
supabase/migrations/20261114091100_rls_and_grants.sql
supabase/migrations/20261114091200_seed_sambhajinagar.sql
```

### Scripts and CI

```
scripts/import-osm-shops.mjs
scripts/sync-shops.mjs
scripts/cleanup.sql
.github/workflows/osm-import.yml
.github/workflows/supabase-keepalive.yml
```

### Tests and docs

```
tests/unit/radius.test.ts
tests/unit/h3.test.ts
tests/unit/moderation.test.ts
tests/unit/hours.test.ts
tests/unit/dedupe.test.ts
tests/unit/format.test.ts
supabase/tests/rls.sql
docs/manual-test.md
docs/rollback.md
```

---

## 16. Dependencies and sizes

| Dependency | Size | Why | Loading |
|---|---|---|---|
| `maplibre-gl@^6.18` | About 1.1 MB minified, 298 KB gzip | Vector map, clustering, custom style, no API key | Dynamic import only on `/nearby` |
| `h3-js@^4.5` | About 213 KB minified, 66 KB gzip | Client-side cell calculation for privacy, server validation | Dynamic import in the area flow |
| `@types/geojson` | Types only, 0 runtime | GeoJSON types for the map | Dev dependency |
| PostGIS | Server extension | `geography`, `ST_DWithin`, GiST | Supabase |
| `pg_trgm` | Server extension | Name similarity for duplicate detection | Supabase |
| Cloudflare Turnstile | Small widget script on first sign-in | Abuse prevention for anonymous auth | Only on the auth bootstrap |

No new dependency for:

- Clustering: MapLibre built-in cluster support.
- Distance: PostGIS and a small haversine helper.
- Photos: browser canvas.
- Opening hours: a conservative local parser, no library.
- Dates: `Intl.DateTimeFormat` with `Asia/Kolkata`.
- Testing: Node 24 built-in test runner. No Vitest or Playwright in the MVP.
- State: React state and small custom hooks. No state library.

If `maplibre-gl` or `h3-js` cannot be code-split cleanly with Next 16 and Turbopack, the fallback is a server-rendered list and a static map link, not a heavier bundle.

---

## 17. Free-tier budget

Assumptions: 500 monthly active users, 100 daily active users, 2 sessions per day, 1 hour per session, 10 area messages per active day, 50 shop views per day.

| Resource | Estimated monthly use | Free limit | Headroom |
|---|---|---|---|
| Database | 60 to 100 MB in year one, with 180-day message retention | 500 MB | Good |
| Storage | 10 to 30 MB of compressed shop photos | 1 GB | Good |
| Egress | About 3 GB with 15-second polling, plus shop API reads | 5 GB | Tight at 200 daily active users |
| Auth MAU | 500 to 1,000 | 50,000 | Large |
| Realtime | 0 in the MVP | 2M messages, 200 connections | Not used |
| Map tiles | Direct from OpenFreeMap | No request limit, no SLA | Courtesy use only |
| Photon | About 1,000 requests per month, cached | Fair use | Good |
| Overpass | 4 requests per month | About 100 per day | Large |
| Vercel | About 1 GB of JS and API traffic | 100 GB | Large |

### What happens at 200 daily active users

Polling at 15 seconds becomes about 4.3 GB per month before shop reads. Mitigations, in order:

1. Raise visible polling to 30 seconds.
2. Use conditional responses with an ETag or a `since` cursor that returns `204 No Content` when there is nothing new.
3. Move to Supabase Realtime for rooms with fewer than 20 active people, where the message volume is predictable.
4. Prune messages more aggressively.

The app must show a clear degradation message if the backend returns 429 or 503. It must not silently stop updating.

### Keepalive

A GitHub Action runs once a week and calls a read-only RPC with the anon key. This keeps the free Supabase project from pausing after one week of inactivity. The action stores no secrets beyond the public URL and anon key.

### Import job

A GitHub Action runs weekly:

1. Query Overpass for the city bounding box.
2. Normalise shops and categories.
3. Upsert by `(osm_type, osm_id)`.
4. Store the raw JSON as a workflow artifact for 90 days.
5. Never run from a user request.

If CivicCircle becomes commercial at a scale that exceeds fair use, the import moves to a self-hosted Overpass instance or a Geofabrik extract. The public Overpass instance is not used as a production backend.

---

## 18. Security review

| Risk | Mitigation |
|---|---|
| Service key leaked to client | Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed. Service key exists only in CI, local admin scripts, and the server-only geocode cache route. |
| Open RLS policies | Hardening migration removes `using (true)` writes and `grant all`. |
| User writes as another user | Insert policies require `author_id = auth.uid()` or `created_by = auth.uid()`. |
| Rate limit bypass | Function uses `auth.uid()` internally. Client cannot choose another key. |
| Duplicate messages on retry | Unique `(author_id, client_id)` index. |
| XSS in messages | React escapes text. No `dangerouslySetInnerHTML`. URLs are validated. |
| SSRF in geocode proxy | Fixed Photon host. No user-supplied URL. |
| CSRF | `SameSite=Lax` cookies plus an `Origin` check on POST, PATCH, and DELETE. |
| Location leak in logs | No coordinates in payloads. Logger redaction for area routes. |
| Exact location in database | Only cell and area id. No lat/lng columns for users. |
| Storage abuse | Bucket size and MIME limits, per-user rate limit, folder path check. |
| Anonymous auth spam | Turnstile when configured, Supabase IP limit, database rate limits, cleanup query. |
| Shop spam | 3 per day, duplicate check, report path, source badge. |
| Reported content | Reports are stored. Block hides messages. Admin SQL can hide shops, photos, and messages. |

---

## 19. Legal copy outline

The legal pages exist at `src/app/(legal)/privacy/page.tsx` and `src/app/(legal)/terms/page.tsx`. The new sections must be plain, specific, and reviewed by counsel before public launch. This plan does not claim legal compliance.

### Privacy Policy additions

1. **Location and area data**
   - We ask for device location only when you tap "Use my area".
   - The app converts the location into an approximate area cell of about 0.7 km² in the browser.
   - We store the area cell and the area name. We do not store your exact latitude or longitude.
   - We do not keep a history of where you have been.
2. **Presence**
   - "Show me as active nearby" is off by default.
   - When it is on, we store that you are active in a room and a last-seen time. Other users see an approximate area count, not your location.
   - "Stop showing me" removes you from the count.
3. **Map and shop data**
   - Map tiles come from OpenFreeMap. Map data comes from OpenStreetMap contributors and is available under the ODbL.
   - Shop information may be incomplete or out of date. It is not a verified business directory.
4. **Third parties**
   - Supabase hosts the database, authentication, and storage.
   - OpenFreeMap serves map tiles.
   - Photon helps with area search. Requests contain area names or area cell centroids, not your exact location.
5. **Retention**
   - Current area only, no history.
   - Messages: 180 days for locality and zone rooms, 365 days for city rooms, unless reported.
   - Stale presence: 24 hours.
   - Rate-limit rows: deleted after expiry.
   - Claim contact details: deleted 90 days after the claim is resolved.
6. **Your controls**
   - Change area, clear area, turn presence off, reroll the ghost handle, report, block, and mute.
7. **Children and age**
   - The policy needs an age section reviewed against applicable Indian law. This plan does not invent an age limit.
8. **Contact**
   - A working privacy contact address and a response process.
9. **Compliance note**
   - India's Digital Personal Data Protection Act, 2023 and other laws may apply. Counsel must review the final text. The product must not claim compliance until that review is complete.

### Terms additions

1. **Local area and shop information**
   - Area rooms are approximate and community-based.
   - Shop data may come from OpenStreetMap or from other users.
   - We do not guarantee that a shop is open, correct, or still in business.
2. **Attribution**
   - OpenStreetMap data is ODbL. Attribution is shown in the map and the shop list.
3. **User content**
   - You are responsible for messages, shop suggestions, corrections, photos, and claims.
   - Do not post illegal content, harassment, hate, spam, personal information, or false claims.
4. **Moderation**
   - We may remove content, hide a shop or photo, or restrict access for abuse.
   - Reports are reviewed manually. We do not promise a response time.
5. **Business claims**
   - A claim request does not transfer ownership automatically.
   - We may ask for proof and may reject a claim.
6. **Maps and boundaries**
   - The map is limited to the launch city for the MVP.
   - Boundaries and place names are community data, not an official survey.
   - The map is not for navigation, emergency, or legal use.
7. **Privacy**
   - The Privacy Policy explains location handling and retention.
8. **Limitation of liability**
   - Counsel should review the existing clause and add shop data, map data, and user-generated content.
9. **Changes**
   - A clear date and change process for material updates.

---

## 20. Testing plan

### Unit tests

1. **Radius**
   - 5 shops at 400 m selects 500 m.
   - 3 shops at 400 m and 2 at 1.5 km selects 2 km and reports expansion.
   - No shops selects 50 km and the exhausted state.
   - Manual radius overrides auto-selection.
   - People radius is independent of shop radius.
2. **H3**
   - Res 8 cell accepted.
   - Res 7 cell rejected for locality.
   - Invalid string rejected.
   - Parent cells are deterministic.
3. **Moderation**
   - More than one URL rejected.
   - Slur with spaces and leetspeak rejected.
   - 500-character boundary accepted, 501 rejected.
   - Zero-width characters normalised.
4. **Hours**
   - `24/7` parses as always open.
   - `Mo-Fr 09:00-18:00` parses on a weekday and closes on Sunday.
   - Unknown syntax returns raw text, not a false open state.
5. **Dedupe**
   - Normalised names match.
   - Names with punctuation match.
   - Different names within 50 m do not match.
6. **Formatting**
   - Distance under 1 km shows metres.
   - Distance above 1 km shows one decimal.
   - Hindi and English labels do not break layout strings.

Run with `node --test` on Node 24. No test framework dependency. Use relative imports so path aliases do not need a resolver.

### SQL tests

`supabase/tests/rls.sql` with pgTAP or plain assertions:

- User A cannot select User B's `profile_locations`.
- User A cannot insert a message with `author_id = B`.
- `anon` cannot insert a post or message.
- A blocked user's messages are hidden.
- `room_presence` select returns only the caller's row.
- `room_counts` returns an aggregate without user ids.
- `consume_rate_limit` returns false after the limit.
- A community shop insert without `created_by = auth.uid()` fails.
- A shop outside the city box fails through the route and the RPC.

### Manual checklist

`docs/manual-test.md` covers:

- Geolocation allow, deny, timeout, and manual area.
- Network tab check: no latitude or longitude in `/api/area/resolve` or any area request.
- Presence opt-in default off, turn on, stop showing me.
- Area switch locality, zone, city.
- Radius slider and honest expansion messages.
- Empty state with no shops.
- Shop category, search, sort, call, directions.
- Add shop, duplicate warning, correction, claim.
- Chat send, optimistic state, retry, offline, 429.
- Presence count, stop showing me, block, report, mute.
- Map cluster click, pin select, tile failure fallback.
- Mobile sheet drag and keyboard.
- Desktop two-column layout.
- Screen reader labels and focus order.
- Lighthouse mobile performance, accessibility, best practices, and SEO at 85 or higher.

### Build checks

Every deliverable runs:

```bash
npm run typecheck
npm run lint
npm run build
node --test tests/unit
```

If the unit test glob does not work on Windows, use an explicit file list in the script. The plan does not add a test runner dependency.

---

## 21. Delivery order and stop points

### Deliverable 1: research and plan

This document and `docs/research.md`. Stop for approval.

### Deliverable 2: database foundation

- Harden existing policies.
- Add PostGIS and pg_trgm.
- Create areas, shops, photos, reports, presence, rate limits, blocks, mutes, geocode cache.
- Alter messages for areas.
- Add RPC functions and RLS policies.
- Seed the city and real OSM shops.
- Add SQL tests.
- Run the migration on a staging project if available.
- Stop with a summary and the migration list.

### Deliverable 3: real Supabase and area resolution

- Replace the placeholder Supabase clients.
- Add anonymous auth bootstrap, ghost profile creation, and Turnstile support.
- Add `src/proxy.ts` for session refresh.
- Replace the in-memory rate limiter with the Postgres wrapper, update every existing route, and delete `memory.ts` and `redis.ts`.
- Add `/api/area/resolve`, `/api/area/location`, `/api/geocode`, `/api/area/nearby`.
- Add consent card, presence opt-in, and area picker.
- Add unit tests for H3 and radius.
- Stop with a summary and a manual test note.

### Deliverable 4: map and shops

- Add `/nearby` shell with map and sheet.
- Add shop list, filters, search, cards.
- Add shop detail, corrections, claims, photos.
- Add duplicate detection.
- Add map clustering, radius circle, city constraint.
- Run Lighthouse mobile and report the score.
- Stop with a summary and screenshots or a written UI note.

### Deliverable 5: area chat and safety

- Add message list, pagination, optimistic send, retry.
- Add polling, presence heartbeat, rate limits.
- Add moderation, report, block, mute.
- Add empty, loading, error, offline, and 429 states.
- Stop with a summary and a manual test note.

### Deliverable 6: legal, README, and final pass

- Add location sections to Privacy Policy and Terms.
- Update README with setup, env, migrations, import, free-tier notes, and privacy design.
- Add `docs/manual-test.md` and `docs/rollback.md`.
- Final typecheck, lint, build, unit tests, Lighthouse, accessibility pass.
- Stop with a release checklist.

No deliverable starts before the previous one is reviewed.

---

## 22. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| India boundary legal risk | High | City-constrained map, no national layer, legal review before national release |
| OpenFreeMap has no SLA | Medium | List fallback, cached style, Protomaps self-host path |
| Photon throttles or changes | Medium | Cache, debounce, manual area entry, Nominatim fallback for one-shot |
| OSM shop data is incomplete or stale | Medium | Source badge, last checked date, correction form, no fake completeness |
| Supabase free project pauses | Medium | Weekly keepalive action |
| Egress exceeds 5 GB | Medium | Cursor polling, 15-second interval, ETag, Realtime later |
| Anonymous auth abuse | Medium | Turnstile, IP limit, database rate limits, cleanup |
| Realtime quota | Low in MVP | Polling first |
| Duplicate shops | Medium | 50 m plus trigram similarity, block silent duplicates |
| Photos fill storage | Low | Compression, 200 KB target, 10 per day, disable uploads near limit |
| Existing open policies exploited | High | Harden first, before new feature launch |
| Next 16 worker setup breaks in production | Medium | Test `npm run build` and production start, not only dev |
| Map hurts Lighthouse | Medium | Lazy load, cluster, low-end options, list fallback |
| Users expect exact "people nearby" | Low | Clear copy: approximate area, active now, no exact distance |
| Mock chat remains confusing | Medium | New route, clear label, later redirect or removal with approval |

---

## 23. What I will not do without approval

- Delete or rewrite `CivicCircle-app/supabase/migrations`.
- Redesign existing purple screens or remove existing gradients globally.
- Change the posts data model beyond security hardening.
- Add a paid map, geocoding, OTP, or rate-limit service.
- Add analytics or error reporting that could capture coordinates.
- Publish a national map or claim legal boundary compliance.
- Deploy to production or run destructive SQL on a live database.

---

## 24. Decisions needed

Recommendations are marked first.

1. **Map scope**
   - A. City-constrained map, no national boundary. Recommended.
   - B. National boundary map now, with authorised data and legal review. This adds time and legal cost.

2. **Identity**
   - A. Supabase anonymous auth plus RLS. Recommended.
   - B. Server-mediated device tokens. Simpler in some ways, but weaker ownership and blocking.

3. **Claim flow**
   - A. Manual claim request, no OTP. Recommended.
   - B. Add phone or email OTP now. Adds a vendor, cost, and privacy surface.

4. **Existing policies**
   - A. Harden posts and messages in the first migration. Recommended.
   - B. Ship the new feature beside the open policies and fix later. Not recommended.

5. **Chat transport**
   - A. Polling first, Realtime later. Recommended.
   - B. Realtime from day one. Higher quota risk.

6. **Shop photos**
   - A. One compressed photo per shop, with tight limits. Recommended.
   - B. Defer all photos to Phase 2. Lower storage and moderation risk.

---

## 25. Approval

If this plan is approved, implementation starts with Deliverable 2, the database foundation. No map or chat code will be written before the schema, RLS, and hardening migration are reviewed.
