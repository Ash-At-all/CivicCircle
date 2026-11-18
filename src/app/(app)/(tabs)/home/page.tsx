"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Flame,
  MessageSquare,
  ThumbsUp,
  Plus,
  Image as ImageIcon,
  X,
  Lock,
  MapPin,
  Store,
} from "lucide-react";
import { DefaultAvatar } from "@/components/ui/default-avatar";
import { CITIES } from "@/features/cities/cities";
import { POST_TAGS, type PostTag } from "@/features/posts/schema";
import { postsRepo, type PersistedPost } from "@/features/posts/actions";
import { processImage } from "@/lib/client-image";

type CitySlug = typeof CITIES[number]["slug"];

const HERO_MESSAGES = [
  "Your neighbourhood has a story. Be part of it.",
  "Something's always happening around you.",
  "Good things start with a conversation.",
  "Your local community starts here.",
  "Got something to say? Your neighbours are listening.",
  "Stay curious about your neighbourhood.",
  "A little local connection goes a long way.",
  "Know your area. Meet your community.",
  "What's happening around you today?",
  "Every neighbourhood has something to talk about.",
  "Your voice belongs in your community.",
  "New day, new conversations.",
  "There's more happening nearby than you think.",
  "Make your neighbourhood a little more connected.",
  "The best local updates come from locals.",
  "Small chats can spark big things nearby.",
  "See what's buzzing in your area.",
  "Drop in and say hi to your neighbours.",
  "Your corner of the city is worth knowing.",
  "Local tips, real people, right here.",
];

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hey night owl";
}

function daySeed(date: Date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function dailyMessageIndex(seed: number, count: number) {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  const idx = h % count;
  if (count <= 1) return idx;
  const prevSeed = seed - 1;
  let ph = prevSeed ^ 0x9e3779b9;
  ph = Math.imul(ph ^ (ph >>> 16), 0x45d9f3b);
  ph = Math.imul(ph ^ (ph >>> 16), 0x45d9f3b);
  ph = (ph ^ (ph >>> 16)) >>> 0;
  const prevIdx = ph % count;
  return idx === prevIdx ? (idx + 1) % count : idx;
}

function relativeTime(createdAt: string) {
  const d = new Date(createdAt);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get("topic") as CitySlug | null;
  const composeParam = searchParams.get("compose");

  const [activeTopic, setActiveTopic] = useState<CitySlug>(() => {
    const t = urlTopic as CitySlug | null;
    return t && CITIES.some((c) => c.slug === t) ? t : "general";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [posts, setPosts] = useState<PersistedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [selectedTag, setSelectedTag] = useState<PostTag>("General");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [heroPlace, setHeroPlace] = useState<string | null>(null);
  const [heroTick, setHeroTick] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postTagFilter, setPostTagFilter] = useState<PostTag | "all">("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [feedVersion, setFeedVersion] = useState(0);

  const clientId = typeof window !== "undefined" ? localStorage.getItem("civiccircle-client-id") || crypto.randomUUID() : "";
  const supabaseUrl = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
  if (typeof window !== "undefined" && !localStorage.getItem("civiccircle-client-id")) {
    localStorage.setItem("civiccircle-client-id", clientId);
  }

  const normalizeImageUrl = (path: string) => {
    if (!path) return path;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${supabaseUrl}/storage/v1/object/public/post-images/${path}`;
  };

  useEffect(() => {
    if (!urlTopic || !CITIES.some((c) => c.slug === urlTopic)) return;
    const id = window.setTimeout(() => {
      setActiveTopic((current) => (current === urlTopic ? current : urlTopic));
    }, 0);
    return () => window.clearTimeout(id);
  }, [urlTopic]);

  // Bottom-nav create button deep-links here with ?compose=1.
  useEffect(() => {
    if (composeParam !== "1") return;
    // Defer the state update so the effect body stays free of synchronous
    // cascading renders (same pattern as the topic-sync effect above).
    window.setTimeout(() => setCreatePostOpen(true), 0);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compose");
    const qs = params.toString();
    router.replace(qs ? `/home?${qs}` : "/home", { scroll: false });
  }, [composeParam, router, searchParams]);

  useEffect(() => {
    const readyId = window.setTimeout(() => setHeroReady(true), 0);
    const id = window.setInterval(() => setHeroTick((t) => t + 1), 60000);
    return () => {
      window.clearTimeout(readyId);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("civiccircle-post-searches");
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((v): v is string => typeof v === "string").slice(0, 5));
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function rememberSearch(value: string) {
    const q = value.trim();
    if (q.length < 2) return;
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 5);
      try {
        window.localStorage.setItem("civiccircle-post-searches", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    fetch("/api/area/nearby")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const name = typeof data.localityName === "string" ? data.localityName.trim() : "";
        if (name && name !== "Your area") setHeroPlace(name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const heroGreeting = useMemo(() => {
    void heroTick;
    if (!heroReady) return "Your area. Your people. Your city.";
    const now = new Date();
    const base = getGreeting(now.getHours());
    return heroPlace ? `${base}, ${heroPlace}!` : `${base}!`;
  }, [heroReady, heroPlace, heroTick]);

  const heroMessage = useMemo(() => {
    void heroTick;
    if (!heroReady) {
      return "Post anonymously, follow the boards that matter, and drop into the room for your locality, no account required.";
    }
    const now = new Date();
    return HERO_MESSAGES[dailyMessageIndex(daySeed(now), HERO_MESSAGES.length)];
  }, [heroReady, heroTick]);

  useEffect(() => {
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("civiccircle-onboarded") : null;
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }

    let active = true;
    const start = window.setTimeout(() => {
      if (active) {
        setLoading(true);
        setPostsError(null);
      }
    }, 0);
    postsRepo.listPosts(activeTopic === "general" ? undefined : activeTopic)
      .then((data) => {
        if (!active) return;
        setPosts(data);
        const voteMap: Record<string, number> = {};
        for (const p of data) voteMap[p.id] = p.votes || 0;
        setVotes(voteMap);
        setPostsError(null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setPostsError("Could not load posts. Check your connection and try again.");
        setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(start);
    };
  }, [activeTopic, router, feedVersion]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (postTagFilter !== "all" && p.tag !== postTagFilter) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    });
  }, [posts, searchQuery, postTagFilter]);

  async function handleUpvote(postId: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const current = votes[postId] ?? 0;
    setVotes((prev) => ({ ...prev, [postId]: current + 1 }));
    try {
      await fetch(`/api/posts/${encodeURIComponent(postId)}/votes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: 1 }),
      });
    } catch {
      // optimistic
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 4 - selectedImages.length);
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const f of files) {
      try {
        const processed = await processImage(f, "post");
        const fileObj = new File([processed.blob], "post.webp", { type: "image/webp" });
        newFiles.push(fileObj);
        newPreviews.push(URL.createObjectURL(processed.blob));
      } catch {
        // skip failed image
      }
    }
    setSelectedImages((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeImage(index: number) {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postTitle.trim() || !postBody.trim()) return;
    setPosting(true);
    setErrorMsg(null);

    try {
      let imagePaths: string[] = [];
      if (selectedImages.length > 0) {
        imagePaths = await postsRepo.uploadPostImages(selectedImages);
      }

      const created = await postsRepo.createPost(
        {
          city: activeTopic,
          tag: selectedTag,
          title: postTitle.trim(),
          body: postBody.trim(),
        },
        imagePaths,
        clientId,
      );

      setPosts((prev) => [created, ...prev]);
      setPostTitle("");
      setPostBody("");
      setSelectedImages([]);
      setImagePreviews([]);
      setCreatePostOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  const activeTopicName = CITIES.find((c) => c.slug === activeTopic)?.name ?? "General";

  useEffect(() => {
    if (!createPostOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreatePostOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createPostOpen]);

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 flex-col bg-[var(--canvas)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-white/8 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/home" className="flex min-w-0 items-center gap-2" aria-label="CivicCircle home">
              <Image
                src="/brand/logo.png"
                alt=""
                width={35}
                height={22}
                className="h-[22px] w-auto"
                priority
              />
              <span className="truncate text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
                CivicCircle
              </span>
            </Link>
          </div>

          <div className="flex flex-none items-center gap-1">
            <Link
              href="/nearby"
              aria-label="Nearby"
              className="btn btn-icon btn-secondary text-[var(--accent-blue)]"
            >
              <MapPin className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
            <button
              type="button"
              aria-label={searchOpen ? "Close search" : "Search posts"}
              aria-expanded={searchOpen}
              aria-controls="post-search"
              onClick={() => setSearchOpen((v) => !v)}
              className="btn btn-icon btn-secondary text-[var(--accent-yellow)]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="space-y-3 border-t border-[var(--hairline)] px-3 pb-3 pt-2.5 sm:px-5">
            <label className="sr-only" htmlFor="post-search">
              Search posts
            </label>
            <input
              id="post-search"
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rememberSearch(searchQuery);
              }}
              onBlur={() => rememberSearch(searchQuery)}
              placeholder="Search this board by keyword"
              className="field field-lg"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.35px] text-[var(--mute)]">Filter by tag</p>
                {(searchQuery || postTagFilter !== "all") ? (
                  <button
                    type="button"
                    className="text-[12px] font-medium text-[var(--accent-blue)]"
                    onClick={() => {
                      setSearchQuery("");
                      setPostTagFilter("all");
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setPostTagFilter("all")}
                  className={`topic-chip flex-none ${postTagFilter === "all" ? "topic-chip--active" : "topic-chip--inactive"}`}
                >
                  All tags
                </button>
                {POST_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setPostTagFilter(tag)}
                    className={`topic-chip flex-none ${postTagFilter === tag ? "topic-chip--active" : "topic-chip--inactive"}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.35px] text-[var(--mute)]">Recent searches</p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="inline-flex min-h-[32px] items-center rounded-full border border-white/10 bg-white/6 px-3 text-[12px] text-[var(--body-text)] hover:bg-white/10"
                      onClick={() => setSearchQuery(term)}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </header>

      <div className="flex-1">
        {/* Hero band */}
        <section className="hero-band">
          <div className="hero-stripes" aria-hidden="true" />
          <div className="px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-10">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
              <div className="min-w-0">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1 text-[12px] font-medium text-[var(--mute)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-green)]" />
                  {activeTopic === "general" ? "Happening around you" : `${activeTopicName} board`}
                </p>

                <h1 className="text-display max-w-[18ch] text-balance">
                  <span className="transition-opacity duration-500 ease-out">{heroGreeting}</span>
                </h1>

                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--body-text)] sm:text-base">
                  <span className="transition-opacity duration-500 ease-out">{heroMessage}</span>
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <a href="#community-feed" className="btn btn-primary btn-lg">
                    See what&apos;s new
                  </a>
                  <Link href="/nearby" className="btn btn-tertiary btn-lg">
                    <MapPin className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    Nearby
                  </Link>
                </div>

                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tracking-[0.2px] text-[var(--ash)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                    No account needed
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Approximate area only</span>
                </p>
              </div>

              {/* Quick actions */}
              <div className="min-w-0">
                <div className="card mx-auto w-full max-w-md overflow-hidden p-3 sm:p-4">
                  <p className="px-1 text-[13px] font-medium text-[var(--ink)]">Jump in</p>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setCreatePostOpen(true)}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-3 text-left transition-colors hover:border-[var(--hairline-strong)]"
                    >
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--accent-yellow-soft)] text-[var(--accent-yellow)]">
                        <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--ink)]">Share a post</span>
                        <span className="block text-[12px] text-[var(--mute)]">Ask, update, or recommend something</span>
                      </span>
                    </button>

                    <Link
                      href="/nearby"
                      className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-3 text-left transition-colors hover:border-[var(--hairline-strong)]"
                    >
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]">
                        <Store className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--ink)]">Explore nearby</span>
                        <span className="block text-[12px] text-[var(--mute)]">Shops, chat, and reviews around you</span>
                      </span>
                    </Link>

                    <Link
                      href={`/chat/${activeTopic}`}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-3 text-left transition-colors hover:border-[var(--hairline-strong)]"
                    >
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--accent-green-soft)] text-[var(--accent-green)]">
                        <MessageSquare className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--ink)]">Join the conversation</span>
                        <span className="block text-[12px] text-[var(--mute)]">Drop into {activeTopicName} chat</span>
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hairline-divider" />

        {/* Board controls */}
        <section id="community-feed" className="scroll-mt-24 px-4 pb-2 pt-7 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-label">Explore your city</p>
              <h2 className="mt-1 text-h2">{activeTopicName}</h2>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--body-text)]">
              Latest posts
            </span>
          </div>

          {/* Topic chips */}
          <div className="no-scrollbar -mx-1 mt-4 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {CITIES.map((topic) => {
              const isActive = activeTopic === topic.slug;
              return (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => setActiveTopic(topic.slug)}
                  aria-pressed={isActive}
                  className={`topic-chip flex-none ${isActive ? "topic-chip--active" : "topic-chip--inactive"}`}
                >
                  {topic.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Post feed */}
        <section className="px-4 pb-10 pt-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--mute)]">
              <Flame className="h-3.5 w-3.5 text-[var(--stone)]" strokeWidth={1.8} />
              Community feed
            </span>
            <span className="text-[12px] tabular-nums tracking-[0.3px] text-[var(--ash)]">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"}
            </span>
          </div>

          {loading && filteredPosts.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="feed-card animate-[skeleton-pulse_1.6s_ease-in-out_infinite] space-y-3 p-4">
                  <div className="h-3 w-24 rounded bg-[rgba(255,255,255,0.07)]" />
                  <div className="h-4 w-3/4 rounded bg-[rgba(255,255,255,0.09)]" />
                  <div className="h-3 w-full rounded bg-[rgba(255,255,255,0.07)]" />
                  <div className="h-3 w-1/2 rounded bg-[rgba(255,255,255,0.07)]" />
                </div>
              ))}
            </div>
          ) : postsError && posts.length === 0 ? (
            <div className="feed-card px-5 py-10 text-center">
              <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--accent-red)]">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-medium tracking-[0.2px] text-[var(--ink)]">Couldn&apos;t load posts</p>
              <p className="mt-1 text-[13px] text-[var(--mute)]">{postsError}</p>
              <button
                onClick={() => setFeedVersion((v) => v + 1)}
                className="btn btn-primary mx-auto mt-5"
              >
                Try again
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="feed-card px-5 py-10 text-center">
              <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--mute)]">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-medium tracking-[0.2px] text-[var(--ink)]">
                {searchQuery || postTagFilter !== "all" ? "No posts match your filters" : "No posts here yet"}
              </p>
              <p className="mt-1 text-[13px] text-[var(--mute)]">
                {searchQuery || postTagFilter !== "all"
                  ? "Try a different keyword or tag, or clear filters."
                  : "Be the first to post in this board."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {(searchQuery || postTagFilter !== "all") ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setPostTagFilter("all");
                    }}
                    className="btn btn-tertiary"
                  >
                    Clear filters
                  </button>
                ) : null}
                <button
                  onClick={() => setCreatePostOpen(true)}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Create post
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <article key={post.id} className="feed-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 pt-4">
                    <DefaultAvatar name="Anonymous" size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold tracking-[0.1px] text-[var(--ink)]">
                          Anonymous
                        </span>
                        <span className="text-[11px] text-[var(--ash)]">·</span>
                        <span className="truncate text-[12px] text-[var(--mute)]">{activeTopicName}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] tracking-[0.2px] text-[var(--ash)]">
                        <span className="tag-chip !px-2 !py-0.5">{post.tag || "General"}</span>
                        <span>{relativeTime(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-3">
                    <h3 className="text-[17px] font-semibold leading-snug tracking-[0.1px] text-[var(--ink)]">
                      {post.title}
                    </h3>
                    {post.body && (
                      <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-[var(--body-text)]">
                        {post.body}
                      </p>
                    )}
                  </div>

                  {post.image_paths && post.image_paths.length > 0 && (
                    <div className="border-y border-[var(--hairline)] bg-[var(--surface-elevated)]">
                      <img
                        src={normalizeImageUrl(post.image_paths[0])}
                        alt={post.title || "Post attachment"}
                        className="max-h-[480px] w-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => handleUpvote(post.id, e)}
                      className="action-pill gap-1.5"
                      aria-label={`Like post, ${votes[post.id] ?? post.votes ?? 0} likes`}
                    >
                      <ThumbsUp className="h-[18px] w-[18px] text-[var(--accent-green)]" strokeWidth={1.8} aria-hidden="true" />
                      <span className="tabular-nums text-[13px] font-medium text-[var(--ink)]">
                        {votes[post.id] ?? post.votes ?? 0}
                      </span>
                    </button>

                    <Link
                      href={`/chat/${activeTopic}`}
                      className="action-pill gap-1.5"
                      aria-label={`Discuss in ${activeTopicName} chat`}
                    >
                      <MessageSquare className="h-[18px] w-[18px] text-[var(--accent-blue)]" strokeWidth={1.8} aria-hidden="true" />
                      <span className="text-[13px] font-medium">Discuss</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create Post sheet */}
      {createPostOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setCreatePostOpen(false)}
        >
          <div
            className="sheet-enter max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-[var(--radius-xl)] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-post-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="create-post-title" className="text-h2">Create a post</h2>
                <p className="mt-1 text-[13px] text-[var(--mute)]">
                  Posting to <span className="text-[var(--body-text)]">{activeTopicName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatePostOpen(false)}
                aria-label="Close"
                className="btn btn-icon btn-secondary -mr-1 -mt-1 text-[var(--mute)]"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            {errorMsg && (
              <div
                className="mt-4 rounded-[var(--radius-md)] border border-[rgba(255,97,97,0.28)] bg-[var(--accent-red-soft)] p-3 text-[13px] text-[var(--accent-red)]"
                role="alert"
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="post-tag" className="text-label block">
                  Category tag
                </label>
                <select
                  id="post-tag"
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as PostTag)}
                  className="field"
                >
                  {POST_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="post-title" className="text-label block">
                  Title
                </label>
                <input
                  id="post-title"
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={120}
                  required
                  className="field"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="post-body" className="text-label block">
                  Body
                </label>
                <textarea
                  id="post-body"
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share details, context, or ask a question…"
                  rows={4}
                  required
                  className="field"
                />
              </div>

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {imagePreviews.map((url, index) => (
                    <div
                      key={index}
                      className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] border border-[var(--hairline)]"
                    >
                      <img src={url} alt="Attached preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label="Remove image"
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] pt-4">
                <label
                  className={`btn btn-outline cursor-pointer text-[13px] ${
                    selectedImages.length >= 4 ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <ImageIcon className="h-4 w-4" strokeWidth={1.8} />
                  <span>Add images ({selectedImages.length}/4)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={selectedImages.length >= 4}
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  disabled={posting || !postTitle.trim() || !postBody.trim()}
                  className="btn btn-primary min-w-[132px]"
                >
                  {posting ? "Publishing…" : "Publish post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-1 items-center justify-center bg-[var(--canvas)]">
          <div className="h-7 w-7 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[var(--hairline-strong)] border-t-[var(--ink)]" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
