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
  Bell,
  X,
  Menu,
  Lock,
  MapPin,
  Store,
} from "lucide-react";
import { CITIES } from "@/features/cities/cities";
import { POST_TAGS, type PostTag } from "@/features/posts/schema";
import { postsRepo, type PersistedPost } from "@/features/posts/actions";
import { processImage } from "@/lib/client-image";

type CitySlug = typeof CITIES[number]["slug"];

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
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("civiccircle-onboarded") : null;
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }

    let active = true;
    const start = window.setTimeout(() => {
      if (active) setLoading(true);
    }, 0);
    postsRepo.listPosts(activeTopic === "general" ? undefined : activeTopic)
      .then((data) => {
        if (!active) return;
        setPosts(data);
        const voteMap: Record<string, number> = {};
        for (const p of data) voteMap[p.id] = p.votes || 0;
        setVotes(voteMap);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(start);
    };
  }, [activeTopic, router]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter((p) =>
      p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

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

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 flex-col bg-[var(--canvas)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[rgba(7,8,10,0.85)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Menu"
              className="btn btn-icon btn-secondary text-[var(--mute)]"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <Link href="/home" className="flex min-w-0 items-center gap-2" aria-label="CivicCircle">
              <Image
                src="/brand/logo.png"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-[var(--radius-sm)] border border-[var(--hairline)]"
                priority
              />
              <span className="truncate text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
                CivicCircle
              </span>
            </Link>
          </div>

          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              aria-label="Search posts"
              onClick={() => setSearchOpen((v) => !v)}
              className="btn btn-icon btn-secondary text-[var(--mute)]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="btn btn-icon btn-secondary relative text-[var(--mute)]"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--ink)]" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-[var(--hairline)] px-3 pb-3 pt-2.5 sm:px-5">
            <label className="sr-only" htmlFor="post-search">
              Search posts
            </label>
            <input
              id="post-search"
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this board…"
              className="field field-lg"
            />
          </div>
        )}
      </header>

      <div className="flex-1">
        {/* Hero band — the single striped moment on the page */}
        <section className="hero-band">
          <div className="hero-stripes" aria-hidden="true" />
          <div className="px-4 pb-10 pt-9 sm:px-6 sm:pb-14 sm:pt-12">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <p className="mb-3 inline-flex items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--mute)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                  {activeTopic === "general" ? "Your city, right now" : activeTopicName}
                </p>

                <h1 className="text-display max-w-[18ch] text-balance">
                  Your area. Your people. Your city.
                </h1>

                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--body-text)] sm:text-base">
                  Post anonymously, follow the boards that matter, and drop into the room for your
                  locality — no account required.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <Link href="/home" className="btn btn-primary btn-lg">
                    Join your city
                  </Link>
                  <Link href="/nearby" className="btn btn-tertiary btn-lg">
                    <MapPin className="h-4 w-4" strokeWidth={1.8} />
                    Open nearby
                  </Link>
                </div>

                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tracking-[0.3px] text-[var(--ash)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />
                    No account needed
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Approximate area only</span>
                </p>
              </div>

              {/* Command-palette mockup — the hero's load-bearing visual */}
              <div className="min-w-0">
                <div className="palette-card mx-auto w-full max-w-md">
                  <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-2.5">
                    <span className="flex gap-1.5" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--stone)]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--stone)]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--stone)]" />
                    </span>
                    <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-2 py-1.5">
                      <svg className="h-3.5 w-3.5 flex-none text-[var(--stone)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
                      <span className="truncate text-[13px] text-[var(--stone)]">
                        Search your city…
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 p-2">
                    <div className="palette-row palette-row-active">
                      <span className="app-tile h-8 w-8 min-h-0 border-0 bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]">
                        <Store className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[var(--ink)]">
                          Nearby shops
                        </span>
                        <span className="block truncate text-[11px] text-[var(--mute)]">
                          Grocery, pharmacy, repair…
                        </span>
                      </span>
                      <span className="keycap">↵</span>
                    </div>

                    <div className="palette-row">
                      <span className="app-tile h-8 w-8 min-h-0 border-0 bg-[var(--accent-green-soft)] text-[var(--accent-green)]">
                        <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[var(--ink)]">
                          Locality room
                        </span>
                        <span className="block truncate text-[11px] text-[var(--mute)]">
                          Ward and city rooms
                        </span>
                      </span>
                      <span className="keycap">⌘</span>
                      <span className="keycap">K</span>
                    </div>

                    <div className="palette-row">
                      <span className="app-tile h-8 w-8 min-h-0 border-0 bg-[var(--accent-yellow-soft)] text-[var(--accent-yellow)]">
                        <Plus className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[var(--ink)]">
                          Create a post
                        </span>
                        <span className="block truncate text-[11px] text-[var(--mute)]">
                          Text, tags and up to 4 images
                        </span>
                      </span>
                      <span className="keycap">N</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--hairline)] px-3 py-2 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                    <span>{activeTopicName}</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                      live
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature strip */}
        <section className="grid grid-cols-1 gap-3 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {[
            {
              icon: Flame,
              title: "Local posts",
              copy: "City boards with tags, images and votes.",
            },
            {
              icon: Lock,
              title: "Anonymous by default",
              copy: "A nickname is enough — no signup, no profile photo.",
            },
            {
              icon: MapPin,
              title: "Area rooms",
              copy: "Locality, ward and city chat around your area.",
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="card p-4 sm:p-5">
              <span className="app-tile mb-3 h-9 w-9 min-h-0 text-[var(--ink)]">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <h2 className="text-[15px] font-medium tracking-[0.2px] text-[var(--ink)]">
                {title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--mute)]">{copy}</p>
            </div>
          ))}
        </section>

        <div className="hairline-divider" />

        {/* Board controls */}
        <section className="px-4 pb-2 pt-7 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-label">Explore your city</p>
              <h2 className="mt-1 text-h2">{activeTopicName}</h2>
            </div>

            <div
              className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-1"
              role="tablist"
              aria-label="Feed order"
            >
              <button type="button" role="tab" aria-selected="true" className="pill-tab pill-tab-active">
                Trending
              </button>
              <button type="button" role="tab" aria-selected="false" className="pill-tab">
                New posts
              </button>
            </div>
          </div>

          {/* Topic chips — wrap on every breakpoint so nothing overflows */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {CITIES.map((topic) => {
              const isActive = activeTopic === topic.slug;
              return (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => setActiveTopic(topic.slug)}
                  aria-pressed={isActive}
                  className={`topic-chip ${isActive ? "topic-chip--active" : "topic-chip--inactive"}`}
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
          ) : filteredPosts.length === 0 ? (
            <div className="feed-card px-5 py-10 text-center">
              <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--mute)]">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-medium tracking-[0.2px] text-[var(--ink)]">
                {searchQuery ? "No posts match that search" : "No posts here yet"}
              </p>
              <p className="mt-1 text-[13px] text-[var(--mute)]">
                {searchQuery
                  ? "Try a different word or clear the search."
                  : "Be the first to post in this board."}
              </p>
              <button
                onClick={() => setCreatePostOpen(true)}
                className="btn btn-primary mx-auto mt-5"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Create post
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPosts.map((post) => (
                <article key={post.id} className="feed-card">
                  <div className="p-4">
                    <div className="flex items-center gap-2 pb-2.5">
                      <span className="app-tile h-7 w-7 min-h-0 rounded-[var(--radius-sm)] text-[var(--mute)]">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </span>
                      <span className="text-[13px] font-medium tracking-[0.2px] text-[var(--ink)]">
                        Anonymous
                      </span>
                      <span className="h-3 w-px bg-[var(--hairline)]" aria-hidden="true" />
                      <span className="tag-chip">{post.tag || activeTopic.replace("-", " ")}</span>
                      <span className="ml-auto text-[11px] tracking-[0.3px] text-[var(--ash)]">
                        {relativeTime(post.created_at)}
                      </span>
                    </div>

                    <h3 className="line-clamp-3 text-balance text-[17px] font-medium leading-snug tracking-[0.1px] text-[var(--ink)]">
                      {post.title}
                    </h3>

                    {post.body && (
                      <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[var(--mute)]">
                        {post.body}
                      </p>
                    )}

                    {post.image_paths && post.image_paths.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--hairline)]">
                        <img
                          src={normalizeImageUrl(post.image_paths[0])}
                          alt={post.title || "Post attachment"}
                          className="max-h-[420px] w-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 border-t border-[var(--hairline)] px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => handleUpvote(post.id, e)}
                      className="action-pill"
                      aria-label="Like post"
                      aria-pressed={false}
                    >
                      <ThumbsUp className="h-4 w-4" strokeWidth={1.8} />
                      <span className="tabular-nums">{votes[post.id] ?? post.votes ?? 0}</span>
                    </button>

                    <Link
                      href={`/chat/${activeTopic}`}
                      className="action-pill"
                      aria-label="Discuss post"
                    >
                      <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                      <span>Discuss</span>
                    </Link>

                    <Link
                      href={`/home?topic=${activeTopic}`}
                      className="action-pill ml-auto"
                      aria-label={`Open ${activeTopicName} board`}
                    >
                      <span className="text-[11px] uppercase tracking-[0.4px]">Board</span>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="sheet-enter max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-[var(--radius-xl)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-h2">Create a post</h2>
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
