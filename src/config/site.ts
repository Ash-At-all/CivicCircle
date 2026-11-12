export const siteConfig = {
  name: "CivicCircle",
  tagline: "City boards and live chat for your community.",
  description: "Join your city, share posts, and talk with neighbors — no account needed.",
  url: "https://civiccircle.in",
  creator: "@civiccircle",
} as const;

export type SiteConfig = typeof siteConfig;
