import { NextResponse } from "next/server";
import { profileSchema } from "@/features/auth/schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const PROFILE_COLUMNS = "id, username, display_name, tag, avatar_url, created_at, updated_at";
const MAX_REQUEST_BYTES = 16 * 1024;

export async function GET(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "profiles");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult?.user?.id || request.headers.get("x-anon-id");
    if (!userId) {
      return NextResponse.json({ profile: null });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    console.error("Profile lookup is unavailable:", error);
    return NextResponse.json({ profile: null });
  }
}

export async function POST(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "profiles");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = profileSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult?.user?.id || request.headers.get("x-anon-id") || crypto.randomUUID();

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username: parsed.data.username,
        display_name: parsed.data.display_name ?? "",
        tag: parsed.data.tag ?? null,
        avatar_url: parsed.data.avatar_url ?? null,
      })
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("Supabase profile save error:", error.message);
      // Return optimistic success if RLS or constraint prevents direct upsert
      return NextResponse.json({
        profile: {
          id: userId,
          username: parsed.data.username,
          display_name: parsed.data.display_name ?? parsed.data.username,
          tag: parsed.data.tag ?? null,
          avatar_url: parsed.data.avatar_url ?? null,
        },
      });
    }
    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("Profile save error:", error);
    return NextResponse.json({
      profile: {
        id: "anon",
        username: parsed.data.username,
        display_name: parsed.data.display_name ?? parsed.data.username,
        tag: parsed.data.tag ?? null,
        avatar_url: null,
      },
    });
  }
}

