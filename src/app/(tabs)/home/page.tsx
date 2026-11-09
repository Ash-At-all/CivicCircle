"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Flame, MessageSquare, ThumbsUp, Plus, Image as ImageIcon, Sparkles, X, ChevronRight } from "lucide-react";
import { CITIES, type City } from "@/lib/cities";
import { POST_TAGS, type PostTag } from "@/lib/post-schema";
import { getAnonId, getDisplayName } from "@/lib/anon-identity";
import { ensureAnonymousSession } from "@/lib/auth";
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

  // Sync active topic from URL if present
  useEffect(() => {
    if (urlTopic && CITIES.some((c) => c.slug === urlTopic)) {
      setActiveTopic(urlTopic);
    }
  }, [urlTopic]);

  useEffect(() => {
    ensureAnonymousSession();
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
      await ensureAnonymousSession();
      let imagePaths: string[] = [];
      if (selectedImages.length > 0) {
        imagePaths = await postsRepo.uploadPostImages(selectedImages);
      }
      const anonId = getAnonId();

      const created = await postsRepo.createPost(
        {
          city: activeTopic,
          tag: selectedTag,
          title: postTitle.trim(),
          body: postBody.trim(),
        },
        imagePaths,
        anonId,
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
    <div className="flex-1 flex flex-col w-full radial-top-glow">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#0B0B14]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30 md:hidden">
            <Image src="/logo.svg" alt="Logo" width={20} height={20} />
          </div>
          <span className="text-base font-bold tracking-tight text-white md:hidden">VibeChat</span>
          <span className="hidden md:inline-block text-base font-bold tracking-tight text-white capitalize">
            {activeTopic.replace("-", " ")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-gray-300 hover:text-white transition"
            aria-label="Search posts"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCreatePostOpen(true)}
            className="gradient-btn flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-white shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Post</span>
          </button>
        </div>
      </header>

      {/* Expandable Search Input */}
      {searchOpen && (
        <div className="border-b border-white/[0.08] bg-[#121220] px-4 py-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts and topics..."
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-[#1A1A2E] py-2 pl-9 pr-8 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-gray-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Scrollable Topic Chips */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 no-scrollbar border-b border-white/[0.04] md:flex-wrap">
        {CITIES.map((topic) => {
          const isActive = activeTopic === topic.slug;
          return (
            <button
              key={topic.slug}
              onClick={() => setActiveTopic(topic.slug)}
              className={`tag-chip flex-none transition-all ${
                isActive
                  ? "bg-white text-[#0B0B14] shadow-[0_2px_10px_rgba(255,255,255,0.2)] font-semibold border-white/30"
                  : "hover:bg-purple-600/20 hover:border-purple-500/40 hover:text-purple-200"
              }`}
            >
              {topic.name}
            </button>
          );
        })}
      </div>

      {/* Topic Room Banner (Direct link to real-time chat) */}
      <div className="px-4 pt-3 pb-1">
        <Link
          href={`/chat/${activeTopic}`}
          className="glass-card flex items-center justify-between rounded-2xl p-3.5 border border-purple-500/20 hover:border-purple-500/40 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-105 transition-transform">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white capitalize">{activeTopic.replace("-", " ")} Chat Room</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11px] text-gray-400">Join real-time encrypted discussion</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Posts Section */}
      <div className="flex-1 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Flame className="h-3.5 w-3.5 text-purple-400" />
            <span>Community Feed</span>
          </div>
          <span className="text-[11px] text-gray-500">{filteredPosts.length} posts</span>
        </div>

        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse space-y-3">
                <div className="h-4 w-1/3 bg-white/10 rounded" />
                <div className="h-3 w-3/4 bg-white/5 rounded" />
                <div className="h-3 w-1/2 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center space-y-2 mt-4">
            <Sparkles className="mx-auto h-8 w-8 text-purple-400/60" />
            <p className="text-sm font-medium text-white">No posts in this topic yet</p>
            <p className="text-xs text-gray-400">Be the first to share something with the community.</p>
            <button
              onClick={() => setCreatePostOpen(true)}
              className="gradient-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-white mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Post</span>
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <article
              key={post.id}
              className="glass-card rounded-2xl p-4 transition hover:border-white/15 space-y-2.5"
            >
              {/* Author & Tag & Time */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-purple-300">
                    {post.author || "Community member"}
                  </span>
                  {post.tag && (
                    <span className="tag-chip">
                      {post.tag}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-gray-500">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Title & Body */}
              <div>
                <h3 className="text-sm font-bold text-white leading-snug">{post.title}</h3>
                <p className="mt-1 text-xs text-gray-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {post.body}
                </p>
              </div>

              {/* Actions: Upvote & Topic link */}
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={(e) => handleUpvote(post.id, e)}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-purple-300 transition"
                >
                  <ThumbsUp className="h-3.5 w-3.5 text-purple-400" />
                  <span>{votes[post.id] ?? post.votes ?? 0}</span>
                </button>

                <Link
                  href={`/chat/${activeTopic}`}
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300"
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Discuss</span>
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Create Post Modal */}
      {createPostOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121220] p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Create a Post</h2>
              <button
                type="button"
                onClick={() => setCreatePostOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-gray-300">Category Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as PostTag)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1A1A2E] px-3 py-2 text-xs text-white outline-none"
                >
                  {POST_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Title</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={120}
                  required
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1A1A2E] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Body</label>
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share details, context, or ask a question..."
                  rows={4}
                  required
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#1A1A2E] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {imagePreviews.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                      <img src={url} alt="Attached" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Attach button */}
              <div className="flex items-center justify-between pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition">
                  <ImageIcon className="h-4 w-4 text-purple-400" />
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
                className="gradient-btn flex w-full min-h-[44px] items-center justify-center rounded-xl font-semibold text-xs text-white shadow-lg disabled:opacity-50"
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
