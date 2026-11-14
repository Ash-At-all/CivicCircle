import { NextResponse } from "next/server";
import { messageDraftSchema } from "@/features/posts/schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = messageDraftSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const rateLimitResponse = await enforceRateLimit(supabase, "messages");
    if (rateLimitResponse) return rateLimitResponse;
  } catch {
    // Validation can still run without a session; rate limiting is best-effort.
  }

  return NextResponse.json({ valid: true });
}


