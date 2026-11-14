import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RATE_LIMIT_POLICIES, type RateLimitAction } from "./policy";

export type { RateLimitAction } from "./policy";

function friendlyMessage(label: string, retryAfter: number) {
  const unit = retryAfter === 1 ? "second" : "seconds";
  if (label === "sending messages") {
    return `You are sending messages too quickly. Try again in ${retryAfter} ${unit}.`;
  }
  return `You are doing that too quickly. Try again in ${retryAfter} ${unit}.`;
}

export async function enforceRateLimit(
  supabase: SupabaseClient,
  action: RateLimitAction,
  scopeKey?: string,
): Promise<Response | null> {
  const policy = RATE_LIMIT_POLICIES[action];
  const actionKey = scopeKey ? `${policy.action}:${scopeKey}` : policy.action;
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_action: actionKey,
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds,
  });

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const errorCode = (error as { code?: string }).code;
    console.error("Rate limit check failed", {
      action: actionKey,
      code: errorCode,
      message: error.message,
    });

    // If the user is not authenticated, the RPC raises and we cannot enforce a
    // per-user shared limit. Require authentication for rate-limited actions.
    if (message.includes("authentication required") || message.includes("auth")) {
      return NextResponse.json(
        { error: "Sign in to continue.", code: "auth_required" },
        { status: 401 },
      );
    }

    // PGRST202: function missing from the PostgREST schema cache.
    // 42P01: relation missing. Both mean the shared limiter migration has not
    // been applied to the Supabase project this deployment is using.
    if (
      errorCode === "PGRST202" ||
      errorCode === "42P01" ||
      message.includes("schema cache") ||
      message.includes("could not find the function") ||
      message.includes("does not exist")
    ) {
      return NextResponse.json(
        {
          error: "Request limits are not available right now. Please try again later.",
          code: "rate_limit_unavailable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Could not check request limits. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.allowed) return null;

  const retryAfter = Math.max(1, Number(row?.retry_after ?? policy.windowSeconds));
  return NextResponse.json(
    {
      error: friendlyMessage(policy.label, retryAfter),
      code: "rate_limited",
      retry_after: retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
