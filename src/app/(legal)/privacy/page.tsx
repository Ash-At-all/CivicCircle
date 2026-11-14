import type { Metadata } from "next";
import { LegalShell } from "@/components/layout/legal-shell";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalShell>
      <article className="legal-content">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="legal-notice">
          Draft notice. This summary describes the application’s current features, but is not a
          complete privacy policy or legal advice. The service operator must add contact, retention,
          jurisdiction-specific rights, and provider details and obtain legal review before public
          launch.
        </p>

        <h2>Information the app handles</h2>
        <p>
          When Supabase is configured, the app uses anonymous or configured account sessions.
          CivicCircle stores profile information you submit (such as username/display details where
          provided), public posts and attached images, comments, votes, messages, reports, and
          account blocks in the configured Supabase project. Reports are visible to the reporter and
          authorized moderators.
        </p>
        <p>
          Joined cities, favourites, and drafts may be stored in this browser. The hosting provider
          and Supabase may process technical request information under their own terms.
        </p>

        <h2>Location and nearby area data</h2>
        <p>
          Nearby shops and area chat use an approximate area, not your exact location. When you set
          your area, the app converts your chosen point to an H3 resolution 8 cell in your browser
          and sends only H3 cell identifiers needed to resolve the locality, ward, and city areas.
          The server stores your current area as H3/area identifiers in your profile location record.
          Exact latitude/longitude is not stored in that profile location record.
        </p>
        <p>
          No location history is kept by the app’s area feature. You can change or clear your area
          at any time; clearing your area removes your saved profile location and stops presence for
          that area. Presence in area rooms is opt-in and shown only as aggregate activity counts (no
          exact user location is shown).
        </p>

        <h2>Visibility and storage providers</h2>
        <p>
          Profiles, posts, post images, avatars, comments, and messages are designed to be readable
          according to the configured project’s access rules (public or authenticated as applicable).
          Area chat messages are limited to your resolved locality/ward/city rooms and subject to
          moderation controls (report/block/mute). Do not submit sensitive information or content you
          intend to keep private. Supabase and the application’s hosting provider process
          information to provide the service.
        </p>

        <h2>Your choices</h2>
        <p>
          You can edit your profile where supported, delete your own posts where supported, manage
          blocks/mutes, set or clear your area, and clear browser-local preferences using your
          browser’s site-data settings. The current interface may not provide a complete
          account-deletion or data-export workflow. Contact the service operator for account or
          privacy requests; operator contact information must be published before launch.
        </p>

        <h2>Security and changes</h2>
        <p>
          Database access is protected by Supabase Row Level Security and application routes. No
          online service can guarantee absolute security. The operator must publish applicable
          retention periods, privacy-rights instructions, and any changes to the service’s data
          practices before public launch.
        </p>
      </article>
    </LegalShell>
  );
}
