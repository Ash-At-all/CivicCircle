"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Flame, MessageSquare, ThumbsUp, Plus, Image as ImageIcon, Bell, X, Menu, Lock } from "lucide-react";
import { CITIES, type City } from "@/lib/cities";

type CitySlug = typeof CITIES[number]["slug"];
import { POST_TAGS, type PostTag } from "@/lib/post-schema";
import { postsRepo, type PersistedPost } from "@/lib/posts-repo";
import { processImage } from "@/lib/client-image";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get("topic") as CitySlug | null;

  const [activeTopic, setActiveTopic] = useState<CitySlug>("general");
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

  const clientId = typeof window !== "undefined" ? localStorage.getItem("vibechat-client-id") || crypto.randomUUID() : "";
  const supabaseUrl = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
  if (typeof window !== "undefined" && !localStorage.getItem("vibechat-client-id")) {
    localStorage.setItem("vibechat-client-id", clientId);
  }

  const normalizeImageUrl = (path: string) => {
    if (!path) return path;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${supabaseUrl}/storage/v1/object/public/post-images/${path}`;
  };

  useEffect(() => {
    if (urlTopic && CITIES.some((c) => c.slug === urlTopic)) {
      setActiveTopic(urlTopic);
    }
  }, [urlTopic]);

  useEffect(() => {
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("vibechat-onboarded") : null;
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }

    let active = true;
    setLoading(true);
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

    return () => { active = false; };
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
    <div className="mobile-container min-h-[100dvh] bg-[#171921] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#FFFFFF]/06 bg-[#171921]/95 px-3 py-3 backdrop-blur-md pt-[max(env(safe-area-inset-top),4px)]">
        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA] hover:bg-[#FFFFFF]/10 transition-all"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Link
          href="/home"
          className="flex items-center gap-2"
          aria-label="VibeChat"
        >
          <Image
            src="/logo.svg"
            alt="VibeChat Logo"
            width={24}
            height={24}
            className="drop-shadow-[0_0_10px_rgba(173,104,245,0.5)]"
            priority
          />
          <span className="text-h2 text-[#F2F0FA]">VibeChat</span>
        </Link>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA] hover:bg-[#FFFFFF]/10 transition-all"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Lavender content surface with notch */}
      <div className="flex-1 relative overflow-hidden bg-[#F2F0FA]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-9 h-[5px] rounded-full bg-[#171921] z-10" />
        <div className="relative z-0 flex flex-col h-full">
          {/* Grain overlay */}
          <div className="grain" />

          {/* Hero Banner */}
          <section className="mx-4 mt-6 rounded-[28px] border border-[#FFFFFF]/12 bg-[#171921] p-5 relative overflow-hidden min-h-[168px]">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_80%_20%,rgba(173,104,245,0.35)_0%,transparent_55%)] pointer-events-none" />
            <div className="flex flex-col lg:flex-row gap-5 items-start lg:items-center">
              <div className="flex-1">
                <h1 className="text-[#FFFFFF] text-h1 leading-tight max-w-[320px]">
                  Your Area. Your People. Your Vibe.
                </h1>
                <Link
                  href="/home"
                  className="inline-flex items-center gap-2 mt-4 rounded-[16px] bg-[#F5B5ED] px-4 py-2 text-[#171921] text-label font-semibold hover:bg-[#FFE7BE] transition-all"
                >
                  <span>JOIN YOUR CITY</span>
                </Link>
              </div>
              <div className="relative flex h-[128px] w-[128px] items-center justify-center shrink-0">
                <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#AD68F5] to-[#7C3AED] p-0.5 drop-shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#171921]">
                    <Image
                      src="/logo.svg"
                      alt="Owl mascot"
                      width={100}
                      height={100}
                      className="drop-shadow-[0_0_16px_rgba(173,104,245,0.6)]"
                      priority
                    />
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#7C83F5] p-1 drop-shadow-[0_3px_10px_rgba(124,131,245,0.5)] animate-[float_4s_ease-in-out_infinite]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F0FA] text-[#7C83F5] text-[10px] font-bold">
                    ...
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature Cards */}
          <section className="mx-4 mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-[20px] border border-[#FFFFFF]/08 bg-[#FFFFFF] p-3 flex flex-col items-center gap-2 text-center">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#171921]">
                <Flame className="h-6 w-6 text-[#FFFFFF]" strokeWidth={1.75} />
              </div>
              <span className="text-[#171921] text-label leading-tight">Local Posts</span>
            </div>
            <div className="rounded-[20px] border border-[#FFFFFF]/08 bg-[#FFFFFF] p-3 flex flex-col items-center gap-2 text-center">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#171921]">
                <Lock className="h-6 w-6 text-[#FFFFFF]" strokeWidth={1.75} />
              </div>
              <span className="text-[#171921] text-label leading-tight">Encrypted Chat</span>
            </div>
            <div className="rounded-[20px] border border-[#FFFFFF]/08 bg-[#FFFFFF] p-3 flex flex-col items-center gap-2 text-center">
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#171921]">
                <Plus className="h-6 w-6 text-[#FFFFFF]" strokeWidth={1.75} />
              </div>
              <span className="text-[#171921] text-label leading-tight">Anonymous Posting</span>
            </div>
          </section>

          {/* Divider Label */}
          <section className="mx-4 mt-6 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-[#FFFFFF]/10" />
              <span className="text-label text-[#8B8FA3]">Explore your city</span>
              <div className="flex-1 h-[1px] bg-[#FFFFFF]/10" />
            </div>
          </section>

          {/* Segmented Control */}
          <section className="mx-4 mt-2 mb-3">
            <div className="flex items-center rounded-[999px] border border-[#FFFFFF]/10 bg-[#FFFFFF] p-[4px]">
              <button
                type="button"
                onClick={() => {}}
                className="flex h-9 items-center justify-center rounded-[999px] bg-[#F8DC47] px-4 py-1 text-[#171921] text-[11px] font-semibold transition-all"
              >
                TRENDING
              </button>
              <button
                type="button"
                onClick={() => {}}
                className="flex h-9 items-center justify-center rounded-[999px] px-4 py-1 text-[#8B8FA3] text-[11px] font-medium hover:text-[#171921] transition-all"
              >
                NEW POSTS
              </button>
            </div>
          </section>

          {/* Topic Chips */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 no-scrollbar md:flex-wrap">
            {CITIES.map((topic) => {
              const isActive = activeTopic === topic.slug;
              return (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => setActiveTopic(topic.slug)}
                  className={`flex items-center justify-center rounded-[999px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-tight transition-all ${
                    isActive
                      ? "bg-[#171921] text-[#FFFFFF] shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
                      : "bg-[#FFF3B8] text-[#171921]/70 hover:bg-[#FFF3B8]/80 hover:text-[#171921]"
                  }`}
                >
                  {topic.name}
                </button>
              );
            })}
          </div>

          {/* Post Card Scroller */}
          <div className="flex-1 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-label text-[#8B8FA3]">
                <Flame className="h-3.5 w-3.5 text-[#AD68F5]" />
                <span>Community Feed</span>
              </div>
              <span className="text-[11px] text-[#8B8FA3]">{filteredPosts.length} posts</span>
            </div>

            {loading ? (
              <div className="space-y-3 pt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-[24px] border border-[#FFFFFF]/08 bg-[#FFFFFF]/04 p-4 animate-pulse space-y-3">
                    <div className="h-4 w-1/3 bg-[#FFFFFF]/10 rounded" />
                    <div className="h-3 w-3/4 bg-[#FFFFFF]/05 rounded" />
                    <div className="h-3 w-1/2 bg-[#FFFFFF]/05 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="rounded-[24px] border border-[#FFFFFF]/08 bg-[#FFFFFF] p-8 text-center space-y-2 mt-4">
                <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#171921] mx-auto mb-3">
                  <svg className="h-6 w-6 text-[#F2F0FA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-[#171921] font-semibold">No posts here yet</p>
                <p className="text-[11px] text-[#8B8FA3]">Be the first to post in this topic</p>
                <button
                  onClick={() => setCreatePostOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-[#F8DC47] px-4 py-2 text-[#171921] font-semibold text-[11px] shadow-lg transition-all press-active"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create post</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory">
                <div className="flex flex-col gap-2">
                  {filteredPosts.map((post) => (
                    <article
                      key={post.id}
                      className="flex flex-col gap-2 snap-start"
                    >
                      <Link
                        href={`/chat/${activeTopic}`}
                        className="flex flex-col gap-2 group"
                      >
                        <div className="relative h-[150px] w-[150px] rounded-[24px] border border-[#FFFFFF]/08 bg-[#FFFFFF] overflow-hidden">
                          <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#171921] mx-auto mt-2">
                            <svg className="h-5 w-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                          </div>
                          <div className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#3DDC84] p-[1px]">
                            <div className="h-3 w-3 rounded-full bg-[#171921]" />
                          </div>
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_100%,rgba(245,181,237,0.45)_0%,transparent_70%)] blur-[12px] -z-10 pointer-events-none" />
                        </div>
                        <h3 className="text-[#171921] text-[14px] font-semibold leading-tight text-center line-clamp-2">{post.title}</h3>
                        <p className="text-[12px] text-[#8B8FA3] text-center">
                          Anonymous <span className="text-[#AD68F5]">•</span> {activeTopic.replace("-", " ")}
                        </p>
                        <div className="mt-2 flex h-[32px] items-center justify-between rounded-b-[24px] bg-[#171921] px-2.5 py-1">
                          <button
                            type="button"
                            onClick={(e) => handleUpvote(post.id, e)}
                            className="flex items-center gap-1 text-[#F8DC47] text-[10px] font-semibold transition-all press-active"
                            aria-label="Like post"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span className="tabular-nums">{votes[post.id] ?? post.votes ?? 0}</span>
                          </button>
                          <span className="flex items-center gap-1 text-[#FFFFFF]/70 text-[10px]">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Discuss</span>
                          </span>
                        </div>
                      </Link>

                      {/* Post Images */}
                      {post.image_paths && post.image_paths.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-1 max-w-[150px] mx-auto">
                          {post.image_paths.map((path) => (
                            <img
                              key={path}
                              src={normalizeImageUrl(path)}
                              alt="Post attachment"
                              className="rounded-[20px] w-full h-24 object-cover border border-[#FFFFFF]/10"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <div className="h-[1px] w-24 flex-shrink-0" /> {/* right peek */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {createPostOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#171921]/80 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-[36px] border border-[#FFFFFF]/10 bg-[#FFFFFF] p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[#171921] text-lg font-semibold">Create a Post</h2>
              <button
                type="button"
                onClick={() => setCreatePostOpen(false)}
                className="rounded-full p-1.5 text-[#8B8FA3] hover:text-[#171921] transition-all"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-[20px] border border-[#F5B5ED]/20 bg-[#F5B5ED]/10 p-3 text-xs text-[#171921] font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <label className="text-label text-[#8B8FA3] block">Category Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as PostTag)}
                  className="mt-1 w-full rounded-[20px] border border-[#FFFFFF]/10 bg-[#171921]/05 px-3 py-2 text-xs text-[#171921] outline-none focus:border-[#AD68F5]"
                >
                  {POST_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label text-[#8B8FA3] block">Title</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={120}
                  required
                  className="mt-1 w-full rounded-[20px] border border-[#FFFFFF]/10 bg-[#171921]/05 px-3.5 py-2.5 text-sm text-[#171921] placeholder-[#8B8FA3] outline-none focus:border-[#AD68F5]"
                />
              </div>

              <div>
                <label className="text-label text-[#8B8FA3] block">Body</label>
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share details, context, or ask a question..."
                  rows={4}
                  required
                  className="mt-1 w-full rounded-[20px] border border-[#FFFFFF]/10 bg-[#171921]/05 px-3.5 py-2.5 text-sm text-[#171921] placeholder-[#8B8FA3] outline-none focus:border-[#AD68F5] resize-none"
                />
              </div>

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {imagePreviews.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-[20px] overflow-hidden border border-[#FFFFFF]/10">
                      <img src={url} alt="Attached" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 rounded-full bg-[#171921]/80 p-1 text-[#FFFFFF] hover:bg-[#AD68F5] transition-all"
                      >
                        <X className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-[20px] border border-[#FFFFFF]/10 bg-[#FFFFFF]/04 px-3 py-2 text-xs font-medium text-[#AD68F5] hover:text-[#FFFFFF] transition-all">
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
                className="flex w-full min-h-[44px] items-center justify-center rounded-[16px] bg-[#F8DC47] px-4 py-2 font-semibold text-[#171921] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all press-active"
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

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[50vh] bg-[#F2F0FA]">
        <div className="h-8 w-8 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[#AD68F5] border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
