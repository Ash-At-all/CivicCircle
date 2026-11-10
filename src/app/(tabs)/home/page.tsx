"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Flame, MessageSquare, ThumbsUp, Plus, Image as ImageIcon, X, Lock } from "lucide-react";
import { CITIES, type City } from "@/lib/cities";
import { POST_TAGS, type PostTag } from "@/lib/post-schema";
import { postsRepo, type PersistedPost } from "@/lib/posts-repo";
import { processImage } from "@/lib/client-image";

type CitySlug = typeof CITIES[number]["slug"];

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

  // Form states for creating a post
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

  // Sync active topic from URL if present
  useEffect(() => {
    if (urlTopic && CITIES.some((c) => c.slug === urlTopic)) {
      setActiveTopic(urlTopic);
    }
  }, [urlTopic]);

  useEffect(() => {
    // Check onboarding
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
    <div className="flex-1 flex flex-col w-full bg-[#171921] min-h-[100dvh]">
      {/* Dark Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#FFFFFF]/08 bg-[#171921]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F2F0FA]/10 border border-[#AD68F5]/30 md:hidden">
            <Image src="/logo.svg" alt="Logo" width={20} height={20} />
          </div>
          <span className="text-base font-bold tracking-tight text-[#FFFFFF] md:hidden">VibeChat</span>
          <span className="hidden md:inline-block text-base font-bold tracking-tight text-[#F2F0FA]">
            {activeTopic.replace("-", " ")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F0FA]/10 text-[#AD68F5] hover:text-[#FFFFFF] transition"
            aria-label="Search posts"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCreatePostOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#F8DC47] px-3 py-2 text-[11px] font-bold text-[#171921] shadow-lg transition"
          >
            <Plus className="h-4 w-4" />
            <span>Post</span>
          </button>
        </div>
      </header>

      {/* Expandable Search Input */}
      {searchOpen && (
        <div className="border-b border-[#FFFFFF]/08 bg-[#1A1A2E] px-4 py-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-[#AD68F5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts and topics..."
              autoFocus
              className="w-full rounded-xl border border-[#FFFFFF]/10 bg-[#1A1A2E] py-2 pl-9 pr-8 text-xs text-[#FFFFFF] placeholder-[#6B7280] outline-none focus:border-[#AD68F5]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-[#AD68F5] hover:text-[#FFFFFF]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lavender content area with rounded top corners */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#F2F0FA]/04 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full">
          {/* Hero Banner */}
          <section className="mx-4 mt-4 rounded-3xl border border-[#FFFFFF]/08 bg-[#F2F0FA] px-5 py-6">
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#F5B5ED]/40 bg-[#F5B5ED]/10 px-3 py-1 text-[10px] font-bold uppercase text-[#F5B5ED]">
                <span className="h-2 w-2 rounded-full bg-[#F8DC47]" />
                <span>JOIN YOUR CITY</span>
              </div>
              <h2 className="text-lg font-bold text-[#171921] tracking-tight sm:text-xl">
                Your Area. Your People. Your Vibe.
              </h2>
              <p className="text-sm text-[#6B7280] max-w-[320px]">
                Discover what&rsquo;s happening near you and join the conversation.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#AD68F5]/20 border border-[#AD68F5]/40 text-[#AD68F5]">
                  <Image src="/logo.svg" alt="Owl mascot" width={40} height={40} className="drop-shadow-[0_0_12px_rgba(173,104,245,0.5)]" />
                </div>
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-[#F2F0FA] border border-[#FFFFFF]/30 p-1">
                  <span className="text-[10px] font-bold text-[#171921] leading-tight">Your Neighborhood</span>
                </div>
              </div>
            </div>
          </section>

          {/* Feature Cards */}
          <section className="mx-4 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 px-1">
            <div className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8DC47]/20 mx-auto mb-2 text-[#F8DC47]">
                <Flame className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[#171921]">Local Posts</h3>
              <p className="mt-1 text-[11px] text-[#6B7280] leading-relaxed">
                See what people around you are sharing.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#AD68F5]/20 mx-auto mb-2 text-[#AD68F5]">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[#171921]">Encrypted Chat</h3>
              <p className="mt-1 text-[11px] text-[#6B7280] leading-relaxed">
                Real-time rooms that stay private.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F5B5ED]/20 mx-auto mb-2 text-[#F5B5ED]">
                <Plus className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[#171921]">Anonymous Posting</h3>
              <p className="mt-1 text-[11px] text-[#6B7280] leading-relaxed">
                Share without an account.
              </p>
            </div>
          </section>

          {/* Explore your city divider */}
          <section className="mx-4 mt-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-[#FFFFFF]/08" />
              <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Explore your city
              </span>
              <div className="flex-1 h-[1px] bg-[#FFFFFF]/08" />
            </div>
          </section>

          {/* Segmented Control: TRENDING / NEW POSTS */}
          <section className="mx-4 mt-2 mb-2">
            <div className="flex items-center gap-1 rounded-xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-1">
              <button
                type="button"
                onClick={() => {}}
                className="flex h-9 items-center justify-center rounded-lg bg-[#F8DC47] px-3 py-1 text-[11px] font-bold text-[#171921] transition"
              >
                TRENDING
              </button>
              <button
                type="button"
                onClick={() => {}}
                className="flex h-9 items-center justify-center rounded-lg px-3 py-1 text-[11px] font-medium text-[#9CA3AF] transition"
              >
                NEW POSTS
              </button>
            </div>
          </section>

          {/* Topic Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 no-scrollbar md:flex-wrap">
            {CITIES.map((topic) => {
              const isActive = activeTopic === topic.slug;
              return (
                <button
                  key={topic.slug}
                  onClick={() => setActiveTopic(topic.slug)}
                  className={`tag-chip flex-none transition-all ${
                    isActive
                      ? "bg-[#F8DC47] text-[#171921] font-semibold shadow-lg"
                      : "bg-[#1A1A2E] border border-[#FFFFFF]/10 text-[#F2F0FA]/60 hover:text-[#FFFFFF] hover:border-[#AD68F5]/40"
                  }`}
                >
                  {topic.name}
                </button>
              );
            })}
          </div>

          {/* Posts Section */}
          <div className="flex-1 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                <Flame className="h-3.5 w-3.5 text-[#AD68F5]" />
                <span>Community Feed</span>
              </div>
              <span className="text-[11px] text-[#6B7280]">{filteredPosts.length} posts</span>
            </div>

            {loading ? (
              <div className="space-y-3 pt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-4 animate-pulse space-y-3">
                    <div className="h-4 w-1/3 bg-[#FFFFFF]/10 rounded" />
                    <div className="h-3 w-3/4 bg-[#FFFFFF]/05 rounded" />
                    <div className="h-3 w-1/2 bg-[#FFFFFF]/05 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-8 text-center space-y-2 mt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F2F0FA]/20 mx-auto mb-2 text-[#AD68F5]">
                  <Flame className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-[#171921]">No posts in this topic yet</p>
                <p className="text-xs text-[#6B7280]">Be the first to share something with the community.</p>
                <button
                  onClick={() => setCreatePostOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#F8DC47] px-4 py-2 text-[11px] font-bold text-[#171921] shadow-lg transition mt-2"
                >
                  <Plus className="h-3 w-3" />
                  <span>Create Post</span>
                </button>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-3.5 transition hover:border-[#FFFFFF]/15 space-y-2"
                >
                  {/* Horizontal scrolling card header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#AD68F5]/20 text-[#AD68F5] font-bold text-[10px]">
                        {(post.author || "A").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[#F2F0FA] text-[10px]">{post.author || "Anonymous"}</span>
                        {post.tag && (
                          <span className="rounded-full border border-[#FFFFFF]/10 bg-[#171921] px-2 py-0.5 text-[9px] text-[#F2F0FA]/70">
                            {post.tag}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#6B7280]">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <div>
                    <h3 className="text-sm font-bold text-[#171921] leading-snug">{post.title}</h3>
                    <p className="mt-1 text-sm text-[#4B5563] line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {post.body}
                    </p>
                  </div>

                  {/* Post Images */}
                  {post.image_paths && post.image_paths.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 max-w-[calc(100vw-2rem)]">
                      {post.image_paths.map((path) => (
                        <img
                          key={path}
                          src={normalizeImageUrl(path)}
                          alt="Post attachment"
                          className="rounded-xl w-full h-32 object-cover border border-[#FFFFFF]/10"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Actions Footer Strip */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#FFFFFF]/06">
                    <button
                      type="button"
                      onClick={(e) => handleUpvote(post.id, e)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#F2F0FA]/10 px-2.5 py-1 text-[10px] font-medium text-[#AD68F5] hover:text-[#FFFFFF] transition"
                    >
                      <ThumbsUp className="h-3 w-3 text-[#F8DC47]" />
                      <span className="text-[#AD68F5]">{votes[post.id] ?? post.votes ?? 0}</span>
                    </button>

                    <Link
                      href={`/chat/${activeTopic}`}
                      className="flex items-center gap-1 text-[10px] font-medium text-[#F5B5ED] hover:text-[#FFFFFF]"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Discuss</span>
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {createPostOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#171921]/80 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#FFFFFF]/10 bg-[#1A1A2E] p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F2F0FA]">Create a Post</h2>
              <button
                type="button"
                onClick={() => setCreatePostOpen(false)}
                className="rounded-full p-1 text-[#9CA3AF] hover:text-[#FFFFFF] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-[#F8DC47]/20 bg-[#F8DC47]/10 p-3 text-xs text-[#F8DC47]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-[#9CA3AF]">Category Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as PostTag)}
                  className="mt-1 w-full rounded-xl border border-[#FFFFFF]/10 bg-[#171921]/80 px-3 py-2 text-xs text-[#FFFFFF] outline-none focus:border-[#AD68F5]"
                >
                  {POST_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#9CA3AF]">Title</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={120}
                  required
                  className="mt-1 w-full rounded-xl border border-[#FFFFFF]/10 bg-[#171921]/80 px-3.5 py-2.5 text-xs text-[#FFFFFF] placeholder-[#6B7280] outline-none focus:border-[#AD68F5]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#9CA3AF]">Body</label>
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share details, context, or ask a question..."
                  rows={4}
                  required
                  className="mt-1 w-full rounded-xl border border-[#FFFFFF]/10 bg-[#171921]/80 px-3.5 py-2.5 text-xs text-[#FFFFFF] placeholder-[#6B7280] outline-none focus:border-[#AD68F5] resize-none"
                />
              </div>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {imagePreviews.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-[#FFFFFF]/10">
                      <img src={url} alt="Attached" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 rounded-full bg-[#171921]/80 p-1 text-[#FFFFFF] hover:bg-[#AD68F5] transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Attach button */}
              <div className="flex items-center justify-between pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[#FFFFFF]/10 bg-[#FFFFFF]/04 px-3 py-2 text-xs font-medium text-[#AD68F5] hover:text-[#FFFFFF] transition">
                  <ImageIcon className="h-4 w-4 text-[#F8DC47]" />
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
                className="flex w-full min-h-[44px] items-center justify-center rounded-full bg-[#F8DC47] px-4 py-2 font-bold text-[#171921] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
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
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
