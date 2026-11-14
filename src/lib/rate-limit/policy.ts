export type RateLimitAction =
  | "posts"
  | "postValidation"
  | "postImages"
  | "comments"
  | "votes"
  | "reports"
  | "blocks"
  | "messages"
  | "profiles"
  | "avatars"
  | "areaResolve"
  | "areaLocationClear"
  | "areaNearby"
  | "areaMessagesRead"
  | "areaMessageSend"
  | "presenceHeartbeat"
  | "presenceStop"
  | "areaReport"
  | "areaBlock"
  | "areaMute"
  | "handleReroll"
  | "geocode"
  | "shopRead"
  | "shopCreate"
  | "shopCorrect"
  | "shopPhoto"
  | "areaCreate";

type Policy = {
  action: string;
  limit: number;
  windowSeconds: number;
  label: string;
};

export const RATE_LIMIT_POLICIES: Record<RateLimitAction, Policy> = {
  posts: { action: "posts", limit: 5, windowSeconds: 3600, label: "posting" },
  postValidation: { action: "post-validation", limit: 30, windowSeconds: 3600, label: "validation" },
  postImages: { action: "post-images", limit: 10, windowSeconds: 3600, label: "image uploads" },
  comments: { action: "comments", limit: 30, windowSeconds: 3600, label: "commenting" },
  votes: { action: "votes", limit: 60, windowSeconds: 3600, label: "voting" },
  reports: { action: "reports", limit: 10, windowSeconds: 3600, label: "reporting" },
  blocks: { action: "blocks", limit: 30, windowSeconds: 3600, label: "blocking" },
  messages: { action: "messages", limit: 30, windowSeconds: 60, label: "sending messages" },
  profiles: { action: "profiles", limit: 10, windowSeconds: 3600, label: "profile updates" },
  avatars: { action: "avatars", limit: 10, windowSeconds: 3600, label: "avatar uploads" },
  areaResolve: {
    action: "area-resolve",
    limit: process.env.NODE_ENV === "production" ? 10 : 120,
    windowSeconds: 3600,
    label: "updating your area",
  },
  areaLocationClear: { action: "area-clear", limit: 10, windowSeconds: 3600, label: "clearing your area" },
  areaNearby: { action: "area-nearby", limit: 240, windowSeconds: 3600, label: "loading nearby places" },
  areaMessagesRead: { action: "area-messages-read", limit: 600, windowSeconds: 3600, label: "loading messages" },
  areaMessageSend: { action: "area-message-send", limit: 30, windowSeconds: 60, label: "sending messages" },
  presenceHeartbeat: { action: "presence-heartbeat", limit: 4, windowSeconds: 60, label: "presence updates" },
  presenceStop: { action: "presence-stop", limit: 10, windowSeconds: 3600, label: "updating presence" },
  areaReport: { action: "area-report", limit: 10, windowSeconds: 3600, label: "reporting" },
  areaBlock: { action: "area-block", limit: 30, windowSeconds: 3600, label: "blocking" },
  areaMute: { action: "area-mute", limit: 30, windowSeconds: 3600, label: "muting" },
  handleReroll: { action: "handle-reroll", limit: 1, windowSeconds: 86400, label: "changing your handle" },
  geocode: { action: "geocode", limit: 120, windowSeconds: 3600, label: "searching places" },
  shopRead: { action: "shop-read", limit: 240, windowSeconds: 3600, label: "loading shops" },
  shopCreate: { action: "shop-create", limit: 3, windowSeconds: 86400, label: "adding shops" },
  shopCorrect: { action: "shop-correct", limit: 10, windowSeconds: 3600, label: "shop corrections" },
  shopPhoto: { action: "shop-photo", limit: 10, windowSeconds: 86400, label: "shop photos" },
  areaCreate: { action: "area-create", limit: 60, windowSeconds: 86400, label: "area updates" },
};
