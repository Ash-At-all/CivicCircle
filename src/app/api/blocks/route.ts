import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceSameOrigin } from "@/lib/server/origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 1024;
const blockSchema = z
  .object({
    username: z.string().min(2).max(30).regex(/^[a-z0-9_]+$/).optional(),
    userId: z.string().uuid().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.username || value.userId), {
    message: "Choose an account to block.",
  });

async function resolveTarget(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: { username?: string; userId?: string },
) {
  const query = supabase.from("profiles").select("id, username, display_name");
  const { data } = input.userId
    ? await query.eq("id", input.userId).maybeSingle()
    : await query.eq("username", input.username ?? "").maybeSingle();
  return data as { id: string; username: string; display_name: string | null } | null;
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return NextResponse.json({ error: "Sign in to view blocked accounts." }, { status: 401 });
    }

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
    const blockedIds = (blocks ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (block: any) => block.blocked_id,
    );
    const { data: profiles } = blockedIds.length
      ? await supabase.from("profiles").select("id, username, display_name").in("id", blockedIds)
      : { data: [] };
    return NextResponse.json({
      blocked: (profiles ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile: any) => ({
          userId: profile.id,
          username: profile.username,
          name: profile.display_name || profile.username,
        }),
      ),
    });
  } catch (error) {
    console.error("Block list lookup error:", error);
    return NextResponse.json({ blocked: [] });
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = blockSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid account to block." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return NextResponse.json({ error: "Sign in to block an account.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "areaBlock");
    if (rateLimitResponse) return rateLimitResponse;

    const target = await resolveTarget(supabase, parsed.data);

    if (!target) return NextResponse.json({ error: "That account was not found." }, { status: 404 });
    if (target.id === userResult.user.id) {
      return NextResponse.json({ error: "You cannot block your own account." }, { status: 400 });
    }

    await supabase.from("user_blocks").upsert(
      {
        blocker_id: userResult.user.id,
        blocked_id: target.id,
      },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );

    return NextResponse.json({
      blocked: {
        userId: target.id,
        username: target.username,
        name: target.display_name || target.username,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Block request error:", error);
    return NextResponse.json({ error: "Could not block that account. Please try again." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = blockSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid account to unblock." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return NextResponse.json({ error: "Sign in to unblock an account.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "areaBlock");
    if (rateLimitResponse) return rateLimitResponse;

    const target = await resolveTarget(supabase, parsed.data);

    if (target) {
      await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userResult.user.id)
        .eq("blocked_id", target.id);
    }

    return NextResponse.json({
      unblocked: target
        ? { userId: target.id, username: target.username }
        : parsed.data,
    });
  } catch (error) {
    console.error("Unblock request error:", error);
    return NextResponse.json({ error: "Could not unblock that account. Please try again." }, { status: 503 });
  }
}


