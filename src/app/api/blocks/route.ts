import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 1024;
const blockSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-z0-9_]+$/),
}).strict();

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return NextResponse.json({ error: "Sign in to view blocked accounts." }, { status: 401 });
    }

    // Anonymous sessions return an empty list without showing sign-in error banner
    if (userResult.user.is_anonymous) {
      return NextResponse.json({ blocked: [] });
    }

    const { data: blocks, error } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userResult.user.id);
    if (error) {
      return NextResponse.json({ blocked: [] });
    }
    const blockedIds = (blocks ?? []).map((block) => block.blocked_id);
    const { data: profiles } = blockedIds.length
      ? await supabase.from("profiles").select("username, display_name").in("id", blockedIds)
      : { data: [] };
    return NextResponse.json({
      blocked: (profiles ?? []).map((profile) => ({
        username: profile.username,
        name: profile.display_name || profile.username,
      })),
    });
  } catch (error) {
    console.error("Block list lookup error:", error);
    return NextResponse.json({ blocked: [] });
  }
}

export async function POST(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "blocks");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = blockSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid username to block." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return NextResponse.json({ error: "Sign in to block an account." }, { status: 401 });
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", parsed.data.username)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: "That account was not found." }, { status: 404 });
    if (target.id === userResult.user.id) {
      return NextResponse.json({ error: "You cannot block your own account." }, { status: 400 });
    }

    await supabase.from("user_blocks").upsert({
      blocker_id: userResult.user.id,
      blocked_id: target.id,
    }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });

    return NextResponse.json({
      blocked: { username: target.username, name: target.display_name || target.username },
    }, { status: 201 });
  } catch (error) {
    console.error("Block request error:", error);
    return NextResponse.json({ error: "Could not block that account. Please try again." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "blocks");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = blockSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid username to unblock." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return NextResponse.json({ error: "Sign in to unblock an account." }, { status: 401 });
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username)
      .maybeSingle();

    if (target) {
      await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userResult.user.id)
        .eq("blocked_id", target.id);
    }

    return NextResponse.json({ unblocked: parsed.data.username });
  } catch (error) {
    console.error("Unblock request error:", error);
    return NextResponse.json({ error: "Could not unblock that account. Please try again." }, { status: 503 });
  }
}

