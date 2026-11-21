import type { PostTag } from "./schema";

type TagRule = {
  tag: PostTag;
  pattern: RegExp;
  reason: string;
};

const TAG_RULES: TagRule[] = [
  {
    tag: "Food",
    pattern:
      /\b(food|restaurant|restaurants|cafe|coffee|menu|dish|dishes|pizza|biryani|samosa|tiffin|mess|bakery|breakfast|lunch|dinner|snack|snacks|recipe|eat|eatery|thali|chai)\b/gi,
    reason: "Food posts help neighbours find places, dishes, and recommendations.",
  },
  {
    tag: "Jobs",
    pattern:
      /\b(job|jobs|hiring|vacancy|vacancies|salary|resume|interview|internship|intern|part-time|full-time|walk-in|opening|openings|recruit|recruitment)\b/gi,
    reason: "Job posts are easier to scan on the Jobs tag.",
  },
  {
    tag: "Rent",
    pattern:
      /\b(rent|rental|flat|flats|apartment|apartments|deposit|landlord|tenant|pg|hostel|lease|furnished|unfurnished|bhk|1bhk|2bhk|3bhk)\b/gi,
    reason: "Rent and flat posts fit the Rent tag.",
  },
  {
    tag: "Events",
    pattern:
      /\b(event|events|meetup|meet-up|workshop|festival|concert|party|camp|drive|celebration|tickets|sunday|saturday|tomorrow|this weekend|clean-up|cleanup)\b/gi,
    reason: "Events and meetups belong on the Events tag.",
  },
];

export type TagSuggestion = {
  tag: PostTag;
  reason: string;
};

export function suggestTag(title: string, body: string): TagSuggestion | null {
  const text = `${title} ${body}`.trim().toLowerCase();
  if (!text) return null;

  const looksLikeQuestion =
    title.trim().endsWith("?") ||
    /\b(anyone|anybody|does anyone|where can|how do i|how to|which is|recommend|suggestion|suggestions|help|advice|looking for)\b/.test(text);

  if (looksLikeQuestion) {
    return {
      tag: "Question",
      reason: "This reads like a question, so neighbours can find and answer it.",
    };
  }

  let best: { tag: PostTag; score: number; reason: string } | null = null;
  for (const rule of TAG_RULES) {
    const score = (text.match(rule.pattern) ?? []).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { tag: rule.tag, score, reason: rule.reason };
    }
  }

  if (!best) return null;
  return { tag: best.tag, reason: best.reason };
}
