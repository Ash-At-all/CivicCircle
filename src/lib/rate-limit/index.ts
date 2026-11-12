import { enforceRateLimit } from "./memory";
import { createRedisRateLimiter } from "./redis";

export type RateLimitAction = "posts" | "postValidation" | "postImages" | "comments" | "votes" | "reports" | "blocks" | "messages" | "profiles" | "avatars";

export interface RateLimiter {
  enforce(request: Request, action: RateLimitAction): Response | null;
}

export function createMemoryRateLimiter(): RateLimiter {
  return {
    enforce: (request: Request, action: RateLimitAction) => enforceRateLimit(request, action),
  };
}

export function createRateLimiter(backend: "memory" | "redis" = "memory"): RateLimiter {
  if (backend === "redis") {
    return createRedisRateLimiter();
  }
  return createMemoryRateLimiter();
}
