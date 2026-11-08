import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
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

  return NextResponse.json({
    blocked: { username: parsed.data.username, name: parsed.data.username },
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "blocks");
  if (rateLimitResponse) return rateLimitResponse;
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });
  const parsed = blockSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid username to unblock." }, { status: 400 });

  return NextResponse.json({ unblocked: parsed.data.username });
}
