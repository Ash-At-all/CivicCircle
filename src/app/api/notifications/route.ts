import { NextResponse } from "next/server";
import { loadOwnAreas } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHAT_WINDOW_MINUTES = 30;
const CHAT_BUSY_THRESHOLD = 6;

function parseSince(raw: string | null) {
  const now = Date.now();
  if (!raw) return new Date(now - DEFAULT_WINDOW_MS);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return new Date(now - DEFAULT_WINDOW_MS);
  return new Date(Math.max(parsed, now - MAX_WINDOW_MS));
}

function emptyPayload(serverTime: string, authRequired = false) {
  return {
    authRequired,
    replies: { new: 0 },
    chat: { new: 0, recent: 0, busy: false, localityName: null as string | null },
    reviews: { new: 0 },
    serverTime,
  };
}

export async function GET(request: Request) {
  const serverTime = new Date().toISOString();
  try {
    const since = parseSince(new URL(request.url).searchParams.get("since"));
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    if (!userResult?.user) {
      return NextResponse.json(emptyPayload(serverTime, true));
    }

    const userId = userResult.user.id;
    const chatSince = new Date(Date.now() - CHAT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: myPosts } = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const myPostIds = (myPosts ?? []).map((row) => row.id).filter(Boolean);

    let replyCount = 0;
    if (myPostIds.length > 0) {
      const { count } = await supabase
        .from("post_comments")
        .select("id", { count: "exact", head: true })
        .in("post_id", myPostIds)
        .gte("created_at", since.toISOString())
        .neq("author_id", userId);
      replyCount = count ?? 0;
    }

    let chat = { new: 0, recent: 0, busy: false, localityName: null as string | null };
    let reviewCount = 0;

    const ownArea = await loadOwnAreas(supabase, userId);
    if (ownArea.ok) {
      const [chatNewResult, chatRecentResult, reviewResult, areaResult] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("area_id", ownArea.areaIds.locality)
          .gte("created_at", since.toISOString())
          .is("deleted_at", null)
          .neq("author_id", userId),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("area_id", ownArea.areaIds.locality)
          .gte("created_at", chatSince)
          .is("deleted_at", null),
        supabase
          .from("area_reviews")
          .select("id", { count: "exact", head: true })
          .eq("area_id", ownArea.areaIds.locality)
          .gte("created_at", since.toISOString())
          .neq("user_id", userId),
        supabase.from("areas").select("name").eq("id", ownArea.areaIds.locality).maybeSingle(),
      ]);

      const recentChat = chatRecentResult.count ?? 0;
      chat = {
        new: chatNewResult.count ?? 0,
        recent: recentChat,
        busy: recentChat >= CHAT_BUSY_THRESHOLD,
        localityName: (areaResult.data as { name?: string } | null)?.name ?? null,
      };
      reviewCount = reviewResult.count ?? 0;
    }

    return NextResponse.json({
      authRequired: false,
      replies: { new: replyCount },
      chat,
      reviews: { new: reviewCount },
      serverTime,
    });
  } catch (error) {
    console.error("Notification digest failed:", error);
    return NextResponse.json(emptyPayload(serverTime));
  }
}
