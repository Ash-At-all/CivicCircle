import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/lib/server/origin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ANON_SIGNUP_ACTION = "anon-signup";
const ANON_SIGNUP_LIMIT = 10;
const ANON_SIGNUP_WINDOW_SECONDS = 3600;

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function hashIp(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const ipHash = hashIp(getClientIp(request));
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.rpc("consume_ip_rate_limit", {
      p_action: ANON_SIGNUP_ACTION,
      p_ip_hash: ipHash,
      p_limit: ANON_SIGNUP_LIMIT,
      p_window_seconds: ANON_SIGNUP_WINDOW_SECONDS,
    });

    if (error) {
      console.error("Anonymous signup IP rate limit failed", {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      return NextResponse.json(
        { error: "Could not start a guest session. Please try again.", code: "rate_limit_unavailable" },
        { status: 503 },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.allowed) {
      const retryAfter = Math.max(1, Number(row?.retry_after ?? ANON_SIGNUP_WINDOW_SECONDS));
      return NextResponse.json(
        {
          error: `Too many guest sessions from this network. Try again in ${retryAfter} seconds.`,
          code: "rate_limited",
          retry_after: retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      console.error("Anonymous sign-in failed:", signInError.message);
      return NextResponse.json(
        { error: "Could not start a guest session. Please try again.", code: "anon_signin_failed" },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Anonymous sign-in endpoint failed:", error);
    return NextResponse.json(
      { error: "Could not start a guest session. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
