# CivicCircle Hyperlocal Research

**Phase:** 0, research and option review  
**Date:** 13 November 2026  
**Status:** Complete, awaiting plan approval  
**Scope:** area chat rooms, nearby shop listings, India-local map, automatic radius expansion, free-tier only

**Rules used for this research**

- Public official sources only. No private APIs, leaked documents, or scraped product data.
- No code, assets, logos, copy, illustrations, or visual layouts copied from other apps.
- No paid service, paid API key, or billing account required.
- No scraping that breaks a site's terms. OSM data is collected through the documented Overpass API and cached.
- New UI must not look AI-generated: no purple or blue gradients, no glassmorphism, no excessive pill buttons, no fake reviews, fake counts, or fake activity, no em dashes, no flashy animation.

---

## 1. Feature patterns worth studying

| Product or pattern | What it does | Official source | What CivicCircle can adopt | What CivicCircle must not copy |
|---|---|---|---|---|
| Telegram People Nearby | Shows nearby groups and people only after the user explicitly makes themselves visible. The user can stop showing themselves at any time. Distances are approximate. | https://telegram.org/blog/contacts-local-groups | Explicit opt-in visibility, a clear "stop showing me" control, approximate distance, no exact point | Their UI, copy, icons, ranking logic, or exact-location exposure |
| Nextdoor neighbourhood model | Groups people by a verified local area, not by a global feed. Address verification decides which neighbourhood a person can join. | https://about.nextdoor.com/ and https://help.nextdoor.com/ | Coarse area identity (H3 cell), area switching, area-first rooms | Their address verification mechanics, postcard or SMS flow, real-name policy, branding, or neighbour-only exclusivity claims |
| Google Maps missing place and Business Profile | Users can add a missing place. Businesses can claim a listing for free. Additions and claims go through review. | https://support.google.com/maps/answer/3094045 and https://business.google.com/ | Community-added shops, correction form, free claim request, source badge, review before trust | Google ratings, reviews, photos, place data, logos, or ranking |
| Justdial listing pattern | Local business directory with category, address, phone, and a free listing path for businesses. | https://www.justdial.com/Free-Listing | Category filter, call action, address, distance sort, free listing concept | Scraped listings, paid ranking, their copy, icons, or page layout |
| Swiggy and Blinkit location pattern | Location selection decides serviceability. The app shows an honest unserviceable or empty state instead of pretending coverage. | https://www.swiggy.com/ and https://blinkit.com/ | Honest "no shops nearby" state, radius expansion message, manual area change | Their UI, illustrations, offers, availability claims, or dark patterns |
| ShareChat and Kutumb local-language pattern | Local-language community framing with simple posting and discovery. | https://sharechat.com/ and https://www.kutumbapp.com/ | Hindi and English labels, simple community language, local relevance | Their engagement loops, visual assets, creator programs, or growth mechanics |
| OpenStreetMap and Overpass | Open map data and a documented query API for extracting POIs. Data is ODbL licensed. | https://www.openstreetmap.org/copyright and https://wiki.openstreetmap.org/wiki/Overpass_API | Shop names, categories, addresses, opening hours, coordinates, source attribution | Calling Overpass live on every user request, ignoring attribution, or treating OSM as complete |

### Kya adopt karein

1. **Opt-in local visibility.** A person appears in an area only after choosing "Use my area". A visible "Stop showing me here" control is always available. The map never shows the person's exact point.
2. **Coarse area identity.** The product works with a cell of about 0.7 km², not a street address. This is enough for a locality room and shops within walking distance.
3. **Area-first rooms.** Default room is the locality. The user can move up to ward or city, but the default stays local.
4. **Honest radius expansion.** If there are fewer than 5 shops or no active people, the app says so and expands in fixed steps. It never fills the gap with fake shops, fake people, or fake ratings.
5. **Community-added shops with correction and claim paths.** A shop card always shows where the data came from. A user can suggest a correction. A business owner can request a claim without paying.
6. **Free claim, manual review.** No OTP purchase, no paid verification vendor. A claim request is a reviewed report in the MVP.
7. **Local language labels.** Hindi and English labels for core actions, with `lang` attributes and no machine-translated blocks of body copy.
8. **Safety controls.** Report, block, mute, a small slur filter, and a link limit. Report and block are stored. Mute can be local.
9. **Source and freshness labels.** "Source: OpenStreetMap" and "Last checked" are visible. If hours are missing, say "Hours not listed" instead of guessing.
10. **Plain, calm design.** Flat charcoal surfaces, yellow action colour, readable type, no decorative stats, no fake "1.2k people nearby" counters.

### Kya copy NAHI karein

- No copied logos, app icons, illustrations, screenshots, colour palettes, or exact layouts from Telegram, Nextdoor, Google, Justdial, Swiggy, Blinkit, ShareChat, Kutumb, or any map product.
- No copied product copy. All strings are written for CivicCircle.
- No Google Places data, Google reviews, Google ratings, or Google Map tiles. Google Maps is a reference for the missing-place and claim pattern only.
- No Justdial listings, ratings, or paid ranking data.
- No private or undocumented endpoints from any app.
- No exact user location, no "people near you" list with distances, no live user pins.
- No fake reviews, fake ratings, fake shop counts, fake active-user counts, or fake "trending" labels.
- No engagement bait, streak mechanics, auto-DM, or notification spam.
- No national boundary map presented as legally authoritative without authorised Survey of India data and legal review.
- No claim that the product is "encrypted" unless end-to-end encryption is actually implemented. The existing chat is not end-to-end encrypted. New copy must say "Messages are visible to people in this room", not "encrypted".

---

## 2. Map and geospatial options

### 2.1 Rendering library

| Option | Licence and cost | Fit | Decision |
|---|---|---|---|
| MapLibre GL JS | BSD, free, no key | Vector tiles, clustering, custom dark style, good mobile performance | **Use** |
| Leaflet | BSD, free, no key | Raster tiles, simpler, weaker vector styling and clustering at scale | Not needed |
| Google Maps JS | Key, billing account, terms restrictions | Strong data, but paid and incompatible with the free-only rule | Reject |
| MapTiler SDK | Free tier with key and quota | Good tiles, but another key and quota to manage | Fallback only |
| Mapbox GL JS | Paid beyond free tier, proprietary | Not free-only friendly | Reject |

MapLibre GL JS v6.18 is the current release in the public docs. Bundlephobia reports about 1.1 MB minified and 298 KB gzip for the main entry. It must be lazy-loaded only on the Nearby route, not imported into the root layout.

Next.js 16 with Turbopack needs the worker URL set explicitly:

```ts
import { setWorkerUrl } from "maplibre-gl";
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
```

This detail must be tested in the production build, not only in dev.

### 2.2 Tiles and styles

| Option | Cost | Limits and conditions | Decision |
|---|---|---|---|
| OpenFreeMap public instance | Free, no key | No request limit, commercial use allowed, no SLA, attribution required, offline download limited to 3,000 tiles or 50 MB, 4 parallel requests, unique User-Agent | **Use for MVP** |
| Protomaps self-host | Free software, hosting cost | Full control, PMTiles, requires storage and a host | Fallback and long-term option |
| MapTiler free | Free tier with key | Quota and key management | Reject for MVP |
| Carto, Stadia, Mapbox | Paid or quota-bound | Not free-only | Reject |

OpenFreeMap states that attribution is required. With MapLibre, attribution is added automatically. The visible credit must still include "OpenStreetMap contributors". The map must not hide or crop the attribution control.

The public instance has no SLA. The app must degrade to a static fallback panel with shop cards if tiles fail. It must not show a blank black rectangle.

### 2.3 Geocoding and area names

| Option | Cost | Rules | Decision |
|---|---|---|---|
| Photon public API | Free, fair use | Typeahead is supported, extensive use is throttled, no availability guarantee | **Use for area search and reverse lookup with cache** |
| Nominatim public API | Free | Maximum 1 request per second, valid User-Agent or Referer, attribution, caching required, autocomplete explicitly forbidden, no bulk or systematic queries | One-shot cached lookup only, never typeahead |
| Self-hosted Nominatim | Server cost | Full control, heavy setup | Not for MVP |
| Google Geocoding | Key, billing | Paid | Reject |

The area picker will call a server proxy, not Photon directly from the browser. The proxy will debounce, limit to one request per 500 ms per session, cache by normalised query for 30 days, and never send exact user coordinates. Reverse lookup will use the H3 cell centroid, not the raw device point. The cache key is the H3 cell, so repeated visits do not create repeated third-party requests.

### 2.4 Shop and POI data

| Option | Cost | Rules | Decision |
|---|---|---|---|
| Overpass API | Free public instance | Keep regular use well under 100 queries and 10 MB per day, cache results, no parallel scripts, commercial use should self-host | **Weekly cached import only** |
| Geofabrik OSM extracts | Free | Large downloads, ODbL | Alternative for a larger import |
| Google Places | Paid | Terms restrict storage and display | Reject |
| Justdial scraping | Not allowed by terms and brittle | Legal and quality risk | Reject |
| Manual seed | Free | Only real, verifiable places | Allowed for a small launch set |

The import will run from a scheduled GitHub Action once a week, query a fixed bounding box for Chhatrapati Sambhajinagar, normalise the result, and store it as a versioned JSON file. The app reads from Supabase, never from Overpass at request time.

OSM data is ODbL. The app must show attribution and must not imply that OSM data is complete or verified. Missing opening hours are common. The UI must show "Hours not listed" rather than inventing them.

### 2.5 Distance and spatial queries

PostGIS `ST_DWithin` with a GiST index on `geography(Point, 4326)` is the correct radius query. It uses metres directly and avoids manual degree maths. The server will use the area cell centroid as the query centre, never the raw device coordinates.

H3 is used for area identity and hierarchy, not for distance. H3 cells are not legal boundaries and do not align with wards or municipal zones. The UI must call them "local area", "zone", and "city", not "official ward".

### 2.6 H3 resolution choice

| Resolution | Average cell area | Average edge | Use |
|---|---|---|---|
| 5 | 252.9 km² | 9.85 km | City room |
| 7 | 5.16 km² | 1.41 km | Ward or zone room |
| 8 | 0.737 km² | 0.531 km | Locality room and area identity |
| 9 | 0.105 km² | 0.20 km | Too small for privacy and empty-room risk |

Resolution 8 is the best balance. It is coarse enough that a single person is not pinpointed, and small enough that a locality room feels local. Resolution 9 was rejected because rooms would be empty too often and the cell would feel like a street-level location.

Source: https://h3geo.org/docs/core-library/restable/

---

## 3. Privacy and safety research

### 3.1 What must never be stored

- Exact device latitude and longitude.
- A history of location updates.
- A user pin on the map.
- A list of "people near you" with distance.
- Raw IP addresses in application tables. If an IP is needed for abuse control, hash it with a server secret and keep it only for the rate-limit window.

### 3.2 What can be stored

- The current H3 resolution 8 cell for the user.
- The cell centroid, which is derived from the cell and is about 500 m from the user at worst.
- The chosen room and a last-seen timestamp for presence.
- A generated ghost handle.
- Reports, blocks, and mutes.

### 3.3 Presence model

Supabase Realtime Presence is useful for live "who is here" state, but it is not queryable by the server for radius expansion and it consumes Realtime messages. The MVP will use a small `room_presence` table with a heartbeat every 30 seconds and a 90-second stale window. The count is real. If the count is zero, the UI says so.

This also avoids depending on the 200 concurrent Realtime connection limit on the free plan while the product is small.

### 3.4 Moderation baseline

- Maximum message length: 500 characters in the area room.
- Maximum one URL per message.
- A small local slur list with leetspeak and spacing normalisation. This is a first line of defence, not a complete moderation system.
- Report reasons: harassment, hate, spam, personal information, violence, other.
- Block hides messages from the blocked user and removes them from presence counts where possible.
- Mute hides a room from the Nearby list without leaving it.
- No image uploads in area chat for the MVP. Images add storage, moderation, and cost pressure.

### 3.5 Anonymous identity

Supabase anonymous sign-in creates a real `auth.users` row and uses the `authenticated` Postgres role with an `is_anonymous` claim. This is better than a client-generated device id because RLS can enforce ownership. The trade-off is that clearing browser data loses the identity, and the free plan has no automatic cleanup of anonymous users. The plan includes a cleanup job and Turnstile on sign-in.

Source: https://supabase.com/docs/guides/auth/auth-anonymous

---

## 4. Free-tier facts and limits

| Service | Free allowance | What it means for CivicCircle | Source |
|---|---|---|---|
| Supabase database | 500 MB | Enough for text chat and shop records at launch scale | https://supabase.com/pricing |
| Supabase egress | 5 GB per month | Chat polling must be small and cache-friendly | https://supabase.com/pricing |
| Supabase storage | 1 GB | Shop photos must be compressed and capped | https://supabase.com/pricing |
| Supabase MAU | 50,000 | Not a launch constraint | https://supabase.com/pricing |
| Supabase projects | 2 active | One production, one staging | https://supabase.com/pricing |
| Supabase pause | After 1 week of inactivity | Weekly ping needed | https://supabase.com/pricing |
| Supabase Realtime | 200 concurrent connections, 2 million messages per month | Do not broadcast every message to every user by default | https://supabase.com/pricing |
| OpenFreeMap | No request limit, no key | Map tiles do not consume Supabase egress | https://openfreemap.org/ |
| Photon | Fair use, throttled | Typeahead proxy with cache and limits | https://photon.komoot.io/ |
| Nominatim | 1 request per second | One-shot only, cached | https://operations.osmfoundation.org/policies/nominatim/ |
| Overpass | About 100 queries and 10 MB per day for regular apps | One weekly import is well inside the limit | https://wiki.openstreetmap.org/wiki/Overpass_API |

### Free-tier risks

1. **Supabase pause after one week.** A scheduled GitHub Action will call a lightweight read-only RPC once a week. This is free and keeps the project active.
2. **Egress from polling.** Polling every 3 seconds is too expensive. The plan uses a `since` cursor, 10-second visible polling, 30-second hidden polling, and ETag or `If-None-Match` where possible.
3. **Storage from photos.** One compressed photo per shop per upload, 200 KB target, 5 MB hard limit, and a monthly cap. Photos can move to Phase 2 if storage grows too fast.
4. **Realtime quota.** Default is polling. Realtime is a feature flag for small rooms after the first month of real usage data.
5. **Anonymous auth abuse.** Turnstile on first sign-in, IP rate limit from Supabase, database rate limits per user, and a 30-day cleanup query.

---

## 5. India map boundary and legal caveats

This is the highest-risk non-technical area. It must be handled honestly.

Facts:

- OpenStreetMap is a global community project. Its boundary data follows OSM conventions and community decisions, not an Indian statutory boundary authority.
- Survey of India is India's national mapping agency. A legally authoritative national map requires authorised data and legal review.
- India has sensitive rules around the depiction of international boundaries. A global basemap that shows the full country can create a legal and reputational problem even if the app itself is not a map product.

What the MVP will do:

1. Constrain the map to the launch city bounding box. The user cannot zoom out to a national or international view.
2. Set a minimum zoom that keeps the view at city or local level.
3. Do not add a country boundary layer, a national outline, or a "India map" screen.
4. Show "Map data: OpenStreetMap contributors" and a short note that boundaries and place names are community data.
5. Treat a future national map as a separate project that needs authorised Survey of India data and legal review.

What the MVP will not do:

- It will not claim that the map is legally compliant.
- It will not use a national boundary from an unverified source.
- It will not let users pan or zoom to a disputed border area.
- It will not use the map for official, government, or emergency purposes.

This mitigation is practical, not legal advice. A lawyer should review the public launch copy and the map scope before a national release.

Sources:

- https://surveyofindia.gov.in/
- https://www.openstreetmap.org/copyright
- https://wiki.openstreetmap.org/wiki/India
- https://wiki.openstreetmap.org/wiki/Disputed_boundaries

---

## 6. Design research and guardrails

The existing app already uses a purple accent, radial glows, glass cards, and gradient buttons. Those styles conflict with the strict design brief. This plan does not redesign the whole app. It creates a new visual lane for the hyperlocal screens and leaves existing screens alone until a separate cleanup is approved.

### New-screen palette

| Token | Value | Use |
|---|---|---|
| Charcoal | `#171921` | Page background |
| Surface | `#1F2230` | Cards, sheets |
| Off-white | `#F2F0FA` | Primary text |
| Muted | `#8B8FA3` | Secondary text |
| Yellow | `#F8DC47` | Primary action, active state |
| Line | `rgba(255,255,255,0.10)` | Borders |
| Green | `#3DDC84` | Open status only, not decoration |
| Red | `#EF4444` | Errors and destructive actions |

### Rules

- No purple or blue gradients on new screens.
- No `gradient-btn`, `radial-top-glow`, `glass-card`, or `grain` in new components.
- No pill-shaped buttons except small category chips and status badges. Primary buttons use a 10 to 12 px radius.
- No emoji in UI copy.
- No fake counters, ratings, reviews, or "trending" labels.
- Motion is limited to 150 ms opacity and small translate changes. Respect `prefers-reduced-motion`.
- Use semantic HTML: `header`, `nav`, `main`, `section`, `article`, `form`, `label`, `button`.
- Every icon-only button needs an accessible name.
- Touch targets are at least 44 by 44 px.
- Body text contrast must meet WCAG AA on charcoal.
- The map must have a text alternative and a list view. The list is not an optional extra; it is the accessible path.

### Local language

- Core labels: "Area", "Chat", "Shops", "Posts", "Change area", "Use my area", "Stop showing me", "Report", "Block", "Mute".
- Hindi labels appear next to or below English labels, not as a replacement that breaks layout.
- Set `lang="hi"` on Hindi text.
- Do not machine-translate user-generated content.
- Do not use transliterated Hinglish in formal legal text.

---

## 7. What the research changes in the product plan

1. **Map first, but list always available.** The map is the visual anchor, but every shop and room must be usable as a list for accessibility and low-end devices.
2. **No exact user pin.** The map shows a radius circle around the area centroid. This is both a privacy and a legal simplification.
3. **City-constrained map.** The national boundary question is removed from the MVP.
4. **Polling before Realtime.** The free Realtime quota is too small for a chat that broadcasts every message. Polling with a cursor is cheaper and simpler.
5. **Postgres rate limiting.** A shared Postgres function avoids a second vendor, a second key, and a second quota. It works across server instances.
6. **No claim OTP in MVP.** A manual claim request avoids paid OTP and avoids collecting phone numbers before the product needs them.
7. **No area chat images in MVP.** Text only. Shops can have photos later.
8. **Shop data is OSM plus community corrections.** No scraped directory data.
9. **Honest empty states are a product feature.** "No shops within 50 km" is better than a fake list.
10. **Anonymous auth is the identity layer.** It enables RLS, reports, blocks, and rate limits without asking for an email or phone number.

---

## 8. Open questions for the plan approval

1. **Map boundary:** keep the MVP city-constrained, or spend time on an authorised national boundary? Recommendation: city-constrained.
2. **Identity:** Supabase anonymous auth with RLS, or server-mediated device tokens? Recommendation: anonymous auth.
3. **Claim flow:** manual review now, or wait for a free OTP option? Recommendation: manual review.
4. **Existing insecure policies:** harden posts and messages in the same migration series, or ship the new feature beside them and fix later? Recommendation: harden now.
5. **Chat transport:** polling first, Realtime later, or Realtime from day one? Recommendation: polling first.
6. **Shop photos:** include compressed photos in the first shop release, or defer to Phase 2? Recommendation: include one photo per shop with tight limits, defer galleries.

---

## 9. Sources

Accessed 13 November 2026.

### Maps and geodata

- OpenFreeMap: https://openfreemap.org/
- OpenFreeMap quick start: https://openfreemap.org/quick_start/
- OpenFreeMap terms: https://openfreemap.org/tos/
- MapLibre GL JS docs: https://maplibre.org/maplibre-gl-js/docs/
- OpenStreetMap copyright and licence: https://www.openstreetmap.org/copyright
- OpenStreetMap attribution guidelines: https://wiki.osmfoundation.org/wiki/Licence/Attribution_Guidelines
- Overpass API wiki: https://wiki.openstreetmap.org/wiki/Overpass_API
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- Photon: https://photon.komoot.io/
- H3 resolution table: https://h3geo.org/docs/core-library/restable/
- PostGIS ST_DWithin: https://postgis.net/docs/ST_DWithin.html
- Survey of India: https://surveyofindia.gov.in/
- OSM India wiki: https://wiki.openstreetmap.org/wiki/India
- OSM disputed boundaries wiki: https://wiki.openstreetmap.org/wiki/Disputed_boundaries

### Backend and platform

- Supabase pricing: https://supabase.com/pricing
- Supabase anonymous sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase row level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase PostGIS: https://supabase.com/docs/guides/database/extensions/postgis
- Supabase storage access control: https://supabase.com/docs/guides/storage/security/access-control

### Product patterns

- Telegram People Nearby: https://telegram.org/blog/contacts-local-groups
- Nextdoor: https://about.nextdoor.com/ and https://help.nextdoor.com/
- Google Maps missing place: https://support.google.com/maps/answer/3094045
- Google Business Profile: https://business.google.com/
- Justdial free listing: https://www.justdial.com/Free-Listing
- Swiggy: https://www.swiggy.com/
- Blinkit: https://blinkit.com/
- ShareChat: https://sharechat.com/
- Kutumb: https://www.kutumbapp.com/
