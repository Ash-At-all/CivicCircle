import { NextResponse } from "next/server";
import { loadOwnAreas } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { HighlightsResponse } from "@/features/highlights/types";

const POSTS_WINDOW_HOURS = 48;
const CHAT_WINDOW_MINUTES = 30;
const CHAT_BUSY_THRESHOLD = 6;

type PostRow = {
  city_slug: string | null;
  tag: string | null;
};

function emptyResponse(): HighlightsResponse {
  return {
    posts: { total: 0, byBoard: [], topTag: null },
    chat: { recent: 0, busy: false, localityName: null },
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    const now = Date.now();
    const postsSince = new Date(now - POSTS_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const chatSince = new Date(now - CHAT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: recentPosts } = await supabase
      .from("posts")
      .select("city_slug, tag")
      .gte("created_at", postsSince)
      .limit(500);

    const boardCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const row of (recentPosts ?? []) as PostRow[]) {
      const board = String(row.city_slug || "general");
      boardCounts.set(board, (boardCounts.get(board) ?? 0) + 1);
      const tag = String(row.tag || "General");
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    const byBoard = [...boardCounts.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topTagEntry = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    let chat: HighlightsResponse["chat"] = { recent: 0, busy: false, localityName: null };

    if (userResult?.user) {
      const ownArea = await loadOwnAreas(supabase, userResult.user.id);
      if (ownArea.ok) {
        const [chatResult, areaResult] = await Promise.all([
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("area_id", ownArea.areaIds.locality)
            .gte("created_at", chatSince)
            .is("deleted_at", null),
          supabase.from("areas").select("name").eq("id", ownArea.areaIds.locality).maybeSingle(),
        ]);

        const recentChat = chatResult.count ?? 0;
        const areaName = (areaResult.data as { name?: string } | null)?.name ?? null;
        chat = {
          recent: recentChat,
          busy: recentChat >= CHAT_BUSY_THRESHOLD,
          localityName: areaName,
        };
      }
    }

    return NextResponse.json({
      posts: {
        total: recentPosts?.length ?? 0,
        byBoard,
        topTag: topTagEntry ? { tag: topTagEntry[0], count: topTagEntry[1] } : null,
      },
      chat,
      generatedAt: new Date().toISOString(),
    } satisfies HighlightsResponse);
  } catch (error) {
    console.error("Highlights load failed:", error);
    return NextResponse.json(emptyResponse());
  }
}
