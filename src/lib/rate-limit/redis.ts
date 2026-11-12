/**
 * Redis-backed rate limiter stub for Upstash.
 * Not wired — configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local
 * to enable. Falls back to memory limiter until configured.
 */
import type { RateLimitAction, RateLimiter } from "./index";

export function createRedisRateLimiter(): RateLimiter {
  return {
    enforce: (_request: Request, _action: RateLimitAction): Response | null => {
      // Redis not configured — allow request through
      return null;
    },
  };
}
