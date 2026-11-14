export const AREA_SCOPES = ["locality", "ward", "city"] as const;
export type AreaScope = (typeof AREA_SCOPES)[number];

export const MAX_AREA_MESSAGE_LENGTH = 500;
export const MAX_LINKS_PER_MESSAGE = 2;

export type AreaChatMessage = {
  id: string;
  clientId: string | null;
  body: string;
  authorId: string;
  authorHandle: string;
  createdAt: string;
  deleted: boolean;
};

export type AreaMessagesPage = {
  scope: AreaScope;
  areaId: string;
  messages: AreaChatMessage[];
  nextCursor: string | null;
  roomCount: number;
  muted: boolean;
  viewer: { id: string; handle: string } | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function encodeMessageCursor(createdAt: string, id: string) {
  return `${createdAt}|${id}`;
}

export function decodeMessageCursor(cursor: string) {
  const separator = cursor.indexOf("|");
  if (separator < 1 || separator === cursor.length - 1) return null;

  const createdAt = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  if (!TIMESTAMP_PATTERN.test(createdAt) || !UUID_PATTERN.test(id)) return null;
  if (Number.isNaN(Date.parse(createdAt))) return null;

  return { createdAt, id };
}

export function scopeLabel(scope: AreaScope, localityName?: string) {
  if (scope === "locality") return localityName?.trim() || "Locality";
  if (scope === "ward") return "Ward";
  return "City";
}

export function roomCountMessage(count: number) {
  if (count <= 0) return "No one else is active in this room right now.";
  if (count === 1) return "1 other person is active in this room.";
  return `${count} other people are active in this room.`;
}

const LINK_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

const BLOCKED_TERMS = [
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "chink",
  "kike",
  "madarchod",
  "behenchod",
  "bhenchod",
  "bhosdi",
  "chutiya",
  "haramkhor",
  "gandu",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Each letter may repeat so spaced or stretched spellings still match.
const BLOCKED_PATTERNS = BLOCKED_TERMS.map(
  (term) =>
    new RegExp(
      term
        .split("")
        .map((character) => `${escapeRegExp(character)}+`)
        .join(""),
      "i",
    ),
);

function normalizeForFilter(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/[^a-z0-9\u0900-\u097f]+/g, "");
}

export type AreaMessageCheck =
  | { ok: true; body: string }
  | {
      ok: false;
      reason: "empty" | "too_long" | "too_many_links" | "blocked_language";
      message: string;
    };

export function inspectAreaMessage(raw: string): AreaMessageCheck {
  const body = raw.trim();

  if (!body) {
    return { ok: false, reason: "empty", message: "Write a message before sending." };
  }
  if (body.length > MAX_AREA_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `Messages can be up to ${MAX_AREA_MESSAGE_LENGTH} characters.`,
    };
  }

  const links = body.match(LINK_PATTERN) ?? [];
  if (links.length > MAX_LINKS_PER_MESSAGE) {
    return {
      ok: false,
      reason: "too_many_links",
      message: `Messages can include up to ${MAX_LINKS_PER_MESSAGE} links.`,
    };
  }

  const normalized = normalizeForFilter(body);
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      ok: false,
      reason: "blocked_language",
      message: "That message contains language that is not allowed in area chat.",
    };
  }

  return { ok: true, body };
}
