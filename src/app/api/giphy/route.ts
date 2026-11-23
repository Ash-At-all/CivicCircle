import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Server-side proxy for Giphy. The API key never reaches the browser.
const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
const RESULT_LIMIT = 24;
const RATING = "pg-13";

type GiphyImage = {
  url?: string;
  width?: string;
  height?: string;
};

type GiphyGif = {
  id?: string;
  title?: string;
  images?: {
    fixed_width?: GiphyImage;
    fixed_height?: GiphyImage;
  };
};

function normalizeGif(gif: GiphyGif) {
  const preview = gif.images?.fixed_width?.url;
  const url = gif.images?.fixed_height?.url;
  if (!gif.id || !preview || !url) return null;

  const width = Number(gif.images?.fixed_height?.width ?? 200);
  const height = Number(gif.images?.fixed_height?.height ?? 200);

  return {
    id: gif.id,
    title: (gif.title ?? "GIF").trim().slice(0, 120) || "GIF",
    preview,
    url,
    width: Number.isFinite(width) && width > 0 ? width : 200,
    height: Number.isFinite(height) && height > 0 ? height : 200,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to search GIFs.", code: "auth_required" },
        { status: 401 },
      );
    }

    // 10 searches per user per hour, enforced by the shared limiter.
    const rateLimitResponse = await enforceRateLimit(supabase, "gifSearch");
    if (rateLimitResponse) return rateLimitResponse;

    const apiKey = process.env.GIPHY_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GIF search is not configured. Add GIPHY_API_KEY to the server environment.",
          code: "giphy_unconfigured",
        },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);

    const giphyUrl = new URL(query ? `${GIPHY_BASE}/search` : `${GIPHY_BASE}/trending`);
    giphyUrl.searchParams.set("api_key", apiKey);
    giphyUrl.searchParams.set("limit", String(RESULT_LIMIT));
    giphyUrl.searchParams.set("rating", RATING);
    if (query) giphyUrl.searchParams.set("q", query);

    const response = await fetch(giphyUrl, { cache: "no-store" });
    if (!response.ok) {
      console.error("Giphy request failed:", response.status);
      return NextResponse.json(
        { error: "Could not load GIFs. Please try again.", code: "giphy_error" },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as { data?: GiphyGif[] };
    const gifs = (payload.data ?? [])
      .map(normalizeGif)
      .filter((gif): gif is NonNullable<typeof gif> => Boolean(gif));

    return NextResponse.json({ gifs, query });
  } catch (error) {
    console.error("Giphy proxy is unavailable:", error);
    return NextResponse.json(
      { error: "Could not load GIFs. Please try again.", code: "giphy_error" },
      { status: 503 },
    );
  }
}
