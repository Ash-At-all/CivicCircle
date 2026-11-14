import { NextResponse } from "next/server";
import { commentDraftSchema } from "@/features/posts/schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4096;

export async function POST(request: Request) {
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = commentDraftSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const rateLimitResponse = await enforceRateLimit(supabase, "comments");
    if (rateLimitResponse) return rateLimitResponse;
  } catch {
    // Validation can still run without a session; rate limiting is best-effort.
  }

  return NextResponse.json({ valid: true });
}


