export type City = { slug: string; name: string; region: string };

export const CITIES = [
  { slug: "general", name: "General", region: "All topics" },
  { slug: "ask", name: "Ask CivicCircle", region: "Questions" },
  { slug: "food", name: "Food & Dining", region: "Local eats" },
  { slug: "jobs", name: "Jobs & Careers", region: "Work" },
  { slug: "housing", name: "Housing & Rent", region: "Living" },
  { slug: "events", name: "Events", region: "Happenings" },
  { slug: "marketplace", name: "Marketplace", region: "Buy & Sell" },
  { slug: "recommendations", name: "Recommendations", region: "Local picks" },
  { slug: "tech", name: "Tech & Startups", region: "Technology" },
  { slug: "fitness", name: "Fitness & Health", region: "Wellness" },
  { slug: "travel", name: "Travel", region: "Explore" },
  { slug: "news", name: "Local News", region: "Updates" },
] as const satisfies readonly City[];
