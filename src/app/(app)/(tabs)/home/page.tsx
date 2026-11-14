"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, MessageSquare, ThumbsUp, Plus, Image as ImageIcon, Bell, X, Menu, Lock } from "lucide-react";
import { CITIES, type City } from "@/features/cities/cities";
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

  return (
    <div className="mobile-container min-h-[100dvh] bg-[#0B1530] flex flex-col">
      {/* Blue glow blobs behind content */}
      <div className="blue-glow">
        <div className="blue-glow__blob blue-glow__blob--blue" />
        <div className="blue-glow__blob blue-glow__blob--purple" />
      </div>

      {/* Header — blue family */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[rgba(120,150,255,0.16)] bg-[rgba(11,21,48,0.85)] px-3 py-3 backdrop-blur-12 pt-[max(env(safe-area-inset-top),4px)]">
        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F4FF]/06 text-[#F1F4FF] hover:bg-[#F1F4FF]/10 transition-all"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Link
          href="/home"
          className="flex items-center gap-2"
          aria-label="CivicCircle"
        >
          <Image
            src="/brand/logo.png"
            alt="CivicCircle Logo"
            width={24}
            height={24}
            className="drop-shadow-[0_0_10px_rgba(79,124,255,0.5)]"
            priority
          />
          <span className="text-h2 text-[#F1F4FF]">CivicCircle</span>
        </Link>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F4FF]/06 text-[#F1F4FF] hover:bg-[#F1F4FF]/10 transition-all"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Main content — deep blue base */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#0F1D45] to-[#0B1530]">
        <div className="relative z-0 flex flex-col h-full">
          {/* Grain overlay */}
          <div className="grain" />

          {/* Hero Banner — dark blue */}
          <section className="mx-4 mt-6 rounded-[28px] border border-[rgba(120,150,255,0.16)] bg-[#0B1530] p-5 relative overflow-hidden min-h-[168px]">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_80%_20%,rgba(79,124,255,0.28)_0%,transparent_55%)] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-5 items-start lg:items-center">
              <div className="flex-1">
                <h1 className="text-[#F1F4FF] text-h1 leading-tight max-w-[320px]">
                  Your Area. Your People. Your Vibe.
                </h1>
                <Link
                  href="/home"
                  className="inline-flex items-center gap-2 mt-4 rounded-[16px] bg-[#F5B5ED] px-4 py-2 text-[#0B1530] text-label font-semibold hover:bg-[#FFE7BE] transition-all"
                >
                  <span>JOIN YOUR CITY</span>
                </Link>
              </div>
              <div className="relative flex h-[128px] w-[128px] items-center justify-center shrink-0">
                <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#AD68F5] to-[#7C3AED] p-0.5 drop-shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0B1530]">
                    <Image
                      src="/brand/logo.png"
                      alt="Owl mascot"
                      width={100}
                      height={100}
                      className="drop-shadow-[0_0_16px_rgba(79,124,255,0.6)]"
                      priority
                    />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#7C83F5] p-1 drop-shadow-[0_3px_10px_rgba(124,131,245,0.5)] animate-[float_4s_ease-in-out_infinite]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F4FF] text-[#7C83F5] text-[10px] font-bold">
                    ...
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature Cards — raised blue */}
          <section className="mx-4 mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-[20px] border border-[rgba(120,150,255,0.16)] bg-[#111F44] p-3 flex flex-col items-center gap-2 text-center">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#0B1530]">
                <Flame className="h-6 w-6 text-[#F1F4FF]" strokeWidth={1.75} />
              </div>
              <span className="text-[#F1F4FF] text-label leading-tight">Local Posts</span>
            </div>
            <div className="rounded-[20px] border border-[rgba(120,150,255,0.16)] bg-[#111F44] p-3 flex flex-col items-center gap-2 text-center">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#0B1530]">
                <Lock className="h-6 w-6 text-[#F1F4FF]" strokeWidth={1.75} />
              </div>
              <span className="text-[#F1F4FF] text-label leading-tight">Encrypted Chat</span>
            </div>
            <div className="rounded-[20px] border border-[rgba(120,150,255,0.16)] bg-[#111F44] p-3 flex flex-col items-center gap-2 text-center">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#0B1530]">
                <Plus className="h-6 w-6 text-[#F1F4FF]" strokeWidth={1.75} />
              </div>
              <span className="text-[#F1F4FF] text-label leading-tight">Anonymous Posting</span>
            </div>
          </section>

          {/* Divider Label */}
          <section className="mx-4 mt-6 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-[#F1F4FF]/08" />
              <span className="text-label text-[#9AA8CF]">Explore your city</span>
              <div className="flex-1 h-[1px] bg-[#F1F4FF]/08" />
            </div>
          </section>

          {/* Segmented Control */}
          <section className="mx-4 mt-2 mb-3">
            <div className="flex items-center rounded-[999px] border border-[#F1F4FF]/10 bg-[#111F44] p-[4px]">
              <button
                type="button"
                onClick={() => {}}
                className="flex h-9 items-center justify-center rounded-[999px] bg-[#F8DC47] px-4 py-1 text-[#0B1530] text-[11px] font-semibold transition-all"
              >
                TRENDING
              </button>
              <button
                type="button"
                onClick={() => {}}
                className="flex h-9 items-center justify-center rounded-[999px] px-4 py-1 text-[#9AA8CF] text-[11px] font-medium hover:text-[#F1F4FF] transition-all"
              >
                NEW POSTS
              </button>
            </div>
          </section>

          {/* Topic Chips — visible on blue */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 no-scrollbar md:flex-wrap">
            {CITIES.map((topic) => {
              const isActive = activeTopic === topic.slug;
              return (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => setActiveTopic(topic.slug)}
                  className={`topic-chip transition-all ${
                    isActive
                      ? "topic-chip--active shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
                      : "topic-chip--inactive"
                  }`}
                >
                  {topic.name}
                </button>
              );
            })}
          </div>

          {/* Post Feed — Reddit-style full-width vertical list */}
          <div className="flex-1 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-label text-[#9AA8CF]">
                <Flame className="h-3.5 w-3.5 text-[#AD68F5]" />
                <span>Community Feed</span>
              </div>
              <span className="text-[11px] text-[#9AA8CF] tabular-nums">{filteredPosts.length} posts</span>
            </div>

            {loading && filteredPosts.length === 0 ? (
              <div className="feed-card p-8 text-center space-y-2 mt-4">
                <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#0B1530] mx-auto mb-3">
                  <svg className="h-6 w-6 text-[#F1F4FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-[#F1F4FF] font-semibold">No posts here yet</p>
                <p className="text-[11px] text-[#9AA8CF]">Be the first to post in this topic</p>
                <button
                  onClick={() => setCreatePostOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-[#F8DC47] px-4 py-2 text-[#0B1530] font-semibold text-[11px] shadow-lg transition-all press-active"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create post</span>
                </button>
              </div>
            ) : loading ? (
              <div className="space-y-3 pt-2">
                {[1, 2].map((i) => (
                  <div key={i} className="feed-card p-4 animate-pulse space-y-3">
                    <div className="h-4 w-1/3 bg-[#F1F4FF]/06 rounded" />
                    <div className="h-3 w-3/4 bg-[#F1F4FF]/04 rounded" />
                    <div className="h-3 w-1/2 bg-[#F1F4FF]/04 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="feed-card p-8 text-center space-y-2 mt-4">
                <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#0B1530] mx-auto mb-3">
                  <svg className="h-6 w-6 text-[#F1F4FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-[#F1F4FF] font-semibold">No posts here yet</p>
                <p className="text-[11px] text-[#9AA8CF]">Be the first to post in this topic</p>
                <button
                  onClick={() => setCreatePostOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-[#F8DC47] px-4 py-2 text-[#0B1530] font-semibold text-[11px] shadow-lg transition-all press-active"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create post</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => (
                  <article
                    key={post.id}
                    className="feed-card"
                  >
                    <div className="p-4">
                      {/* Meta row */}
                      <div className="flex items-center gap-2 pb-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1530]">
                          <svg className="h-4 w-4 text-[#F1F4FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <span className="text-[#F1F4FF] text-sm font-semibold">Anonymous</span>
                        <span className="h-[1px] w-[4px] bg-[#F1F4FF]/20" />
                        <button
                          type="button"
                          className="topic-chip--inactive text-[10px] px-2 py-0.5"
                          disabled
                          aria-label={topicLabel(activeTopic)}
                        >
                          {activeTopic.replace("-", " ")}
                        </button>
                        <span className="h-[1px] w-[4px] bg-[#F1F4FF]/20" />
                        <span className="text-[11px] text-[#9AA8CF]">{relativeTime(post.created_at)}</span>
                        <div className="ml-auto flex items-center gap-1 text-[#9AA8CF]">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </div>
                      </div>

                      {/* Title */}
                      <h2
                        className="text-[#F1F4FF] text-[18px] font-bold leading-[1.3] text-balance line-clamp-3"
                        style={{ WebkitLineClamp: 3 }}
                      >
                        {post.title}
                      </h2>

                      {/* Body preview */}
                      {post.body && (
                        <p className="mt-2 text-[#9AA8CF] text-sm leading-[1.5] line-clamp-3">
                          {post.body}
                        </p>
                      )}

                      {/* Post Image — inside card */}
                      {post.image_paths && post.image_paths.length > 0 && (
                        <div className="mt-4 rounded-[12px] overflow-hidden border border-[#F1F4FF]/08">
                          <img
                            src={normalizeImageUrl(post.image_paths[0])}
                            alt={post.title || "Post attachment"}
                            className="w-full aspect-[16/10] object-cover max-h-[420px]"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[#F1F4FF]/06">
                      <button
                        type="button"
                        onClick={(e) => handleUpvote(post.id, e)}
                        className="action-pill action-pill--flex"
                        aria-label="Like post"
                        aria-pressed={false}
                      >
                        <ThumbsUp className="h-4 w-4" strokeWidth={1.75} />
                        <span className="tabular-nums">{votes[post.id] ?? post.votes ?? 0}</span>
                      </button>

                      <Link
                        href={`/chat/${activeTopic}`}
                        className="action-pill action-pill--flex"
                        aria-label="Discuss post"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>Discuss</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Post Modal — blue theme */}
      {createPostOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1530]/80 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-[36px] border border-[#F1F4FF]/10 bg-[#111F44] p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[#F1F4FF] text-lg font-semibold">Create a Post</h2>
              <button
                type="button"
                onClick={() => setCreatePostOpen(false)}
                className="rounded-full p-1.5 text-[#9AA8CF] hover:text-[#F1F4FF] transition-all"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-[20px] border border-[#F5B5ED]/20 bg-[#F5B5ED]/10 p-3 text-xs text-[#0B1530] font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <label className="text-label text-[#9AA8CF] block">Category Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as PostTag)}
                  className="mt-1 w-full rounded-[20px] border border-[#F1F4FF]/10 bg-[#0B1530]/05 px-3 py-2 text-xs text-[#F1F4FF] outline-none focus:border-[#AD68F5]"
                >
                  {POST_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label text-[#9AA8CF] block">Title</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={120}
                  required
                  className="mt-1 w-full rounded-[20px] border border-[#F1F4FF]/10 bg-[#0B1530]/05 px-3.5 py-2.5 text-sm text-[#F1F4FF] placeholder-[#9AA8CF] outline-none focus:border-[#AD68F5]"
                />
              </div>

              <div>
                <label className="text-label text-[#9AA8CF] block">Body</label>
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share details, context, or ask a question..."
                  rows={4}
                  required
                  className="mt-1 w-full rounded-[20px] border border-[#F1F4FF]/10 bg-[#0B1530]/05 px-3.5 py-2.5 text-sm text-[#F1F4FF] placeholder-[#9AA8CF] outline-none focus:border-[#AD68F5] resize-none"
                />
              </div>

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {imagePreviews.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-[20px] overflow-hidden border border-[#F1F4FF]/10">
                      <img src={url} alt="Attached" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 rounded-full bg-[#0B1530]/80 p-1 text-[#F1F4FF] hover:bg-[#AD68F5] transition-all"
                      >
                        <X className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-[20px] border border-[#F1F4FF]/10 bg-[#F1F4FF]/04 px-3 py-2 text-xs font-medium text-[#AD68F5] hover:text-[#F1F4FF] transition-all">
                  <ImageIcon className="h-4 w-4 text-[#F8DC47]" strokeWidth={1.75} />
                  <span>Add Images ({selectedImages.length}/4)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={selectedImages.length >= 4}
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={posting || !postTitle.trim() || !postBody.trim()}
                className="flex w-full min-h-[44px] items-center justify-center rounded-[16px] bg-[#F8DC47] px-4 py-2 font-semibold text-[#0B1530] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all press-active"
              >
                {posting ? "Publishing..." : "Publish Post"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function topicLabel(slug: string) {
  return slug;
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[50vh] bg-[#0B1530]">
        <div className="h-8 w-8 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[#AD68F5] border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
