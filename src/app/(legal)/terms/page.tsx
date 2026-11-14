import type { Metadata } from "next";
import { LegalShell } from "@/components/layout/legal-shell";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalShell>
      <article className="legal-content">
        <p className="eyebrow">Legal</p>
        <h1>Terms and Conditions</h1>
        <p className="legal-notice">
          Preview draft. These terms are not legal advice. Review and adapt them for the final
          service before launch.
        </p>

        <h2>Using CivicCircle</h2>
        <p>
          CivicCircle provides community features such as posts, city/topic chat, profiles, and
          nearby area features (shops and area rooms) when configured. Availability depends on the
          connected backend and third-party services.
        </p>

        <h2>Community conduct</h2>
        <p>
          Do not harass or threaten others, share private information without consent, impersonate
          people, spam communities, or use the service for illegal activity. Reports are submitted
          to the configured project’s authorized moderators. Blocking/muting filters content in your
          view according to the feature; it does not delete other users’ content by itself.
        </p>

        <h2>Area chat conduct</h2>
        <p>
          Area rooms are for local, text-based conversation within your resolved locality, ward, or
          city. Do not post harassment, hate, threats, sexual content involving minors, doxxing or
          other personal information, spam, scams, or illegal content. Keep messages respectful and
          relevant to the area. Messages may be subject to automated limits (rate limits, length/link
          limits, and content filtering) and can be reported by other users. Moderators may review
          reports and take action according to the operator’s policies.
        </p>

        <h2>Your content</h2>
        <p>
          You remain responsible for content you submit. Posts, profile content, comments, and chat
          messages may be visible to others as determined by the feature and configured access rules.
          Do not submit content you do not have the right to share or want to keep private. The
          service operator must define an appropriate content license and moderation/appeal process
          in final terms before public launch.
        </p>

        <h2>Moderation and availability</h2>
        <p>
          The app may accept reports and provide moderator review tools, but moderation behavior and
          enforcement depend on operator configuration. The service may change or become temporarily
          unavailable. These preview terms should be replaced with reviewed terms before public
          launch.
        </p>

        <h2>Contact</h2>
        <p>Contact details will be published here before the service launches.</p>
      </article>
    </LegalShell>
  );
}
