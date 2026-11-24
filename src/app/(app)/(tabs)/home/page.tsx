"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  ThumbsUp,
  Plus,
  Image as ImageIcon,
  X,
  Lock,
  MapPin,
  Store,
  Bookmark,
  Lightbulb,
  Flag,
} from "lucide-react";
import { DefaultAvatar } from "@/components/ui/default-avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { HighlightsStrip, type HighlightItem } from "@/components/highlights/highlights-strip";
import { SavePostButton } from "@/components/saved/save-post-button";
import { CITIES } from "@/features/cities/cities";
import { POST_TAGS, type PostTag } from "@/features/posts/schema";
import { POST_ALERT_BADGE_CLASS, POST_ALERT_LABELS, POST_ALERT_TYPES, isPostAlertType, type PostAlertType } from "@/features/posts/alerts";
import { suggestTag } from "@/features/posts/tag-suggest";
import type { HighlightsResponse } from "@/features/highlights/types";
import { postsRepo, type PersistedPost } from "@/features/posts/actions";
import type { PollResult } from "@/features/posts/types";
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

const MOHAALLA_PROMPTS = [
  "Need a plumber nearby?",
  "Best chai spot around here?",
  "Is the road open today?",
  "Anyone know a good doctor?",
  "Power cut in your area?",
  "Looking for a PG/room?",
  "Best sabzi mandi nearby?",
  "Auto/cab available?",
];

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
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

function HelpfulButton({
  postId,
  count,
  marked,
  onToggle,
}: {
  postId: string;
  count: number;
  marked: boolean;
  onToggle: (postId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(postId);
      }}
      aria-pressed={marked}
      aria-label={`${marked ? "Remove helpful mark" : "Mark as helpful"}, ${count} helpful marks`}
      className={`action-pill min-h-[38px] touch-manipulation gap-1.5 !px-2.5 ${
        marked
          ? "border-[rgba(214,162,74,0.32)] bg-[var(--accent-yellow-soft)] text-[var(--accent-yellow)]"
          : ""
      }`}
    >
      <Lightbulb
        className="h-[17px] w-[17px]"
        strokeWidth={1.8}
        fill={marked ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span className="text-[13px] font-medium">Helpful</span>
      <span className="tabular-nums text-[12px] opacity-80">({count})</span>
    </button>
  );
}

function PollResults({
  question,
  options,
  totalVotes,
  closed,
  votedOptionId,
  onVote,
}: {
  question: string;
  options: PollResult["options"];
  totalVotes: number;
  closed: boolean;
  votedOptionId: string | null;
  onVote: (optionId: string) => void;
}) {
  const voted = Boolean(votedOptionId);
  const sorted = [...options].sort((a, b) => b.votes - a.votes);
  const showResults = closed || voted;

  return (
    <div className="border-t border-[var(--hairline)] px-4 py-4">
      <p className="dateline mb-2">
        <span className="dateline-mark" aria-hidden="true" />
        Ballot
      </p>
      <p className="text-[15px] font-medium leading-snug text-[var(--ink)]">{question}</p>

      {showResults ? (
        <div className="mt-3 space-y-2.5">
          {sorted.map((option, i) => {
            const isMine = votedOptionId === option.id;
            const leads = i === 0 && option.percent > 0;
            return (
              <div key={option.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-[13px] ${
                      isMine
                        ? "font-medium text-[var(--ink)]"
                        : "text-[var(--body-text)]"
                    }`}
                  >
                    {option.text}
                  </span>
                  <span className="flex-none tabular-nums text-[12px] text-[var(--ash)]">
                    {closed
                      ? `${option.percent}%`
                      : `${option.votes} ${option.votes === 1 ? "vote" : "votes"}`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-[var(--surface-card)]">
                  <div
                    className={`h-full ${
                      leads ? "bg-[var(--accent-ember)]" : "bg-[var(--stone)]"
                    }`}
                    style={{ width: `${option.percent}%` }}
                  />
                </div>
                {isMine && !closed ? (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-ember-ink)]">
                    <span
                      className="h-1.5 w-1.5 bg-[var(--accent-ember)]"
                      aria-hidden="true"
                    />
                    Your vote
                  </span>
                ) : null}
              </div>
            );
          })}
          <p className="pt-0.5 text-[12px] text-[var(--ash)]">
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
            {closed ? " · Closed" : " · Open"}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onVote(option.id)}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-left text-[13px] text-[var(--body-text)] transition-colors hover:border-[var(--accent-ember)] hover:text-[var(--ink)]"
            >
              <span
                className="h-3 w-3 flex-none border border-[var(--hairline-strong)]"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">{option.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [helpful, setHelpful] = useState<Record<string, { count: number; marked: boolean }>>({});
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [selectedTag, setSelectedTag] = useState<PostTag>("General");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<PostAlertType | null>(null);
  const [alertOnly, setAlertOnly] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ postId: string; title: string } | null>(null);
  const [reportReason, setReportReason] = useState("other");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const [heroPlace, setHeroPlace] = useState<string | null>(null);
  const [heroTick, setHeroTick] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postTagFilter, setPostTagFilter] = useState<PostTag | "all">("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [feedVersion, setFeedVersion] = useState(0);
  const [activity, setActivity] = useState<HighlightsResponse | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [polls, setPolls] = useState<Record<string, PollResult>>({});
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});

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

  useEffect(() => {
    const id = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/highlights")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setActivity(data as HighlightsResponse);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const datelineLabel = useMemo(() => {
    void heroTick;
    if (!heroReady) return "Today";
    return new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }, [heroReady, heroTick]);

  const heroMessage = useMemo(() => {
    void heroTick;
    if (!heroReady) {
      return "Post anonymously, follow the boards that matter, and drop into the room for your locality, no account required.";
    }
    const now = new Date();
    return HERO_MESSAGES[dailyMessageIndex(daySeed(now), HERO_MESSAGES.length)];
  }, [heroReady, heroTick]);

  const promptChips = useMemo(() => {
    if (!heroReady) return [...MOHAALLA_PROMPTS];
    return seededShuffle(MOHAALLA_PROMPTS, daySeed(new Date()));
  }, [heroReady]);

  function startPromptPost(prompt: string) {
    setErrorMsg(null);
    setPostTitle(prompt);
    setPostBody("");
    setCreatePostOpen(true);
  }

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
        const helpfulMap: Record<string, { count: number; marked: boolean }> = {};
        for (const p of data) {
          helpfulMap[p.id] = {
            count: p.helpful_count || 0,
            marked: Boolean(p.helpful_marked),
          };
        }
        setHelpful(helpfulMap);
        const pollMap: Record<string, PollResult> = {};
        for (const p of data) {
          const poll = p.poll;
          if (!poll) continue;
          pollMap[poll.id] = {
            poll,
            options: (poll.options ?? []).map((o) => ({ id: o.id, text: o.text, votes: 0, percent: 0 })),
            totalVotes: 0,
            closed: Date.parse(poll.expires_at) <= Date.now(),
          };
        }
        setPolls((prev) => ({ ...prev, ...pollMap }));
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
      if (alertOnly && !p.alert_type) return false;
      if (postTagFilter !== "all" && p.tag !== postTagFilter) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    });
  }, [posts, searchQuery, postTagFilter, alertOnly]);

  const activeTopicName = CITIES.find((c) => c.slug === activeTopic)?.name ?? "General";

  const tagSuggestion = useMemo(() => suggestTag(postTitle, postBody), [postTitle, postBody]);
  const showTagSuggestion = tagSuggestion !== null && tagSuggestion.tag !== selectedTag;

  const highlightItems = useMemo<HighlightItem[]>(() => {
    const items: HighlightItem[] = [];
    const recent =
      nowMs > 0
        ? posts.filter((post) => {
            const created = Date.parse(post.created_at);
            return Number.isFinite(created) && nowMs - created <= 48 * 60 * 60 * 1000;
          })
        : [];

    if (recent.length > 0) {
      items.push({
        id: "fresh",
        title: `${recent.length} fresh ${recent.length === 1 ? "post" : "posts"} in ${activeTopicName}`,
        detail: "Posted in the last 48 hours",
        href: "#community-feed",
        icon: "flame",
        accent: "yellow",
      });
    }

    const tagCounts = new Map<string, number>();
    for (const post of recent) {
      const tag = post.tag || "General";
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topTag && topTag[1] > 0) {
      items.push({
        id: "tag",
        title: `#${topTag[0]} is the busiest tag`,
        detail: `${topTag[1]} recent ${topTag[1] === 1 ? "post" : "posts"} in this board`,
        href: "#community-feed",
        icon: "trend",
        accent: "blue",
      });
    }

    if (activity?.chat.busy) {
      items.push({
        id: "chat",
        title: `Chat is live${activity.chat.localityName ? ` in ${activity.chat.localityName}` : " nearby"}`,
        detail: `${activity.chat.recent} messages in the last 30 minutes`,
        href: "/nearby",
        icon: "chat",
        accent: "green",
      });
    }

    const topBoard = activity?.posts.byBoard.find((entry) => entry.slug !== activeTopic);
    if (topBoard) {
      const name = CITIES.find((city) => city.slug === topBoard.slug)?.name ?? topBoard.slug;
      items.push({
        id: "board",
        title: `${name} is buzzing`,
        detail: `${topBoard.count} new ${topBoard.count === 1 ? "post" : "posts"} in 48 hours`,
        href: `/home?topic=${encodeURIComponent(topBoard.slug)}`,
        icon: "trend",
        accent: "red",
      });
    }

    return items.slice(0, 5);
  }, [posts, activity, activeTopic, activeTopicName, nowMs]);

  async function handlePollVote(pollId: string, optionId: string) {
    setVotedPolls((prev) => ({ ...prev, [pollId]: optionId }));
    const result = await postsRepo.votePoll(pollId, optionId);
    if (result) {
      setPolls((prev) => ({ ...prev, [pollId]: result }));
    } else {
      setVotedPolls((prev) => {
        const next = { ...prev };
        delete next[pollId];
        return next;
      });
    }
  }

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

  async function handleHelpful(postId: string) {
    const current = helpful[postId] ?? { count: 0, marked: false };
    const optimistic = {
      count: Math.max(0, current.count + (current.marked ? -1 : 1)),
      marked: !current.marked,
    };
    setHelpful((prev) => ({ ...prev, [postId]: optimistic }));

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/helpful`, {
        method: current.marked ? "DELETE" : "POST",
      });
      if (!response.ok) throw new Error("Helpful update failed.");
      const data = (await response.json()) as {
        helpfulCount?: number | null;
        marked?: boolean;
      };
      setHelpful((prev) => ({
        ...prev,
        [postId]: {
          count: typeof data.helpfulCount === "number" ? data.helpfulCount : optimistic.count,
          marked: typeof data.marked === "boolean" ? data.marked : optimistic.marked,
        },
      }));
    } catch {
      setHelpful((prev) => ({ ...prev, [postId]: current }));
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

  async function submitPostReport() {
    if (!reportTarget) return;
    setReportBusy(true);
    setReportNotice(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "post",
          targetId: reportTarget.postId,
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not submit your report.");
      setReportNotice("Report submitted.");
      setReportTarget(null);
      setReportDetails("");
      setReportReason("other");
    } catch {
      setReportNotice("Could not submit your report. Please try again.");
    } finally {
      setReportBusy(false);
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    const trimmedOptions = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    if (pollEnabled && (pollQuestion.trim().length === 0 || trimmedOptions.length < 2)) return;
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
        alertType,
      );

      if (pollEnabled && pollQuestion.trim().length > 0 && trimmedOptions.length >= 2) {
        const createdPoll = await postsRepo.createPoll({
          postId: created.id,
          question: pollQuestion.trim(),
          options: trimmedOptions,
        });
        setPolls((prev) => ({
          ...prev,
          [createdPoll.poll.id]: {
            poll: createdPoll.poll,
            options: createdPoll.options.map((o) => ({ ...o, votes: 0, percent: 0 })),
            totalVotes: 0,
            closed: Date.parse(createdPoll.poll.expires_at) <= Date.now(),
          },
        }));
      }

      setPosts((prev) => [created, ...prev]);
      setPostTitle("");
      setPostBody("");
      setSelectedImages([]);
      setImagePreviews([]);
      setAlertType(null);
      setCreatePostOpen(false);
      setPollEnabled(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

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
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 pt-[max(env(safe-area-inset-top),12px)] sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/home" className="flex min-w-0 items-center gap-2.5" aria-label="CivicCircle home">
              <span
                className="h-2 w-2 flex-none bg-[var(--accent-ember)]"
                aria-hidden="true"
              />
              <span className="truncate font-display text-[19px] leading-none text-[var(--ink)]">
                CivicCircle
              </span>
            </Link>
          </div>

          <div className="flex flex-none items-center gap-0.5">
            <NotificationBell />
            <Link
              href="/saved"
              aria-label="Saved posts and places"
              className="btn btn-icon btn-secondary text-[var(--mute)]"
            >
              <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </Link>
            <Link
              href="/nearby"
              aria-label="Nearby"
              className="btn btn-icon btn-secondary text-[var(--mute)]"
            >
              <MapPin className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </Link>
            <button
              type="button"
              aria-label={searchOpen ? "Close search" : "Search posts"}
              aria-expanded={searchOpen}
              aria-controls="post-search"
              onClick={() => setSearchOpen((v) => !v)}
              className="btn btn-icon btn-secondary text-[var(--mute)]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="space-y-3 border-t border-[var(--hairline)] px-4 pb-4 pt-3 sm:px-6">
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
                <p className="text-[12px] font-medium text-[var(--mute)]">Filter by tag</p>
                {(searchQuery || postTagFilter !== "all") ? (
                  <button
                    type="button"
                    className="text-[12px] font-medium text-[var(--accent-ember-ink)]"
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
                <p className="text-[12px] font-medium text-[var(--mute)]">Recent searches</p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="inline-flex min-h-8 items-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 text-[12px] text-[var(--body-text)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
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
        {/* Masthead */}
        <section className="hero-band">
          <div className="px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
              <div className="min-w-0">
                <p className="dateline">
                  <span className="dateline-mark" aria-hidden="true" />
                  <span className="truncate">{heroPlace ?? activeTopicName}</span>
                  <span className="dateline-sep" aria-hidden="true">·</span>
                  <span>{datelineLabel}</span>
                </p>

                <h1 className="mt-3 max-w-[17ch] text-balance text-display">
                  {activeTopic === "general"
                    ? "Your mohalla, right now."
                    : `${activeTopicName}, right now.`}
                </h1>

                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--body-text)]">
                  {heroMessage}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <a href="#community-feed" className="btn btn-primary">
                    Read the board
                  </a>
                  <Link href="/nearby" className="btn btn-tertiary">
                    <MapPin className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                    Nearby
                  </Link>
                </div>

                <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--ash)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                    No account needed
                  </span>
                  <span className="dateline-sep" aria-hidden="true">·</span>
                  <span>Approximate area only</span>
                </p>
              </div>

              {/* Start here */}
              <div className="min-w-0">
                <div className="mx-auto w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--ink)]">Start here</p>
                    <span className="text-[12px] text-[var(--ash)]">Three ways in</span>
                  </div>

                  <div className="mt-3 divide-y divide-[var(--hairline)]">
                    <button
                      type="button"
                      onClick={() => setCreatePostOpen(true)}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)]">
                        <Plus className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--ink)]">Share a post</span>
                        <span className="block text-[12px] text-[var(--mute)]">Ask, update, or recommend something</span>
                      </span>
                    </button>

                    <Link
                      href="/nearby"
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)]">
                        <Store className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--ink)]">Explore nearby</span>
                        <span className="block text-[12px] text-[var(--mute)]">Shops, chat, and reviews around you</span>
                      </span>
                    </Link>

                    <Link
                      href={`/chat/${activeTopic}`}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)]">
                        <MessageSquare className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[var(--ink)]">Join the conversation</span>
                        <span className="block text-[12px] text-[var(--mute)]">Drop into {activeTopicName} chat</span>
                      </span>
                    </Link>
                  </div>

                  <div className="mt-3">
                    <p className="text-[12px] font-medium text-[var(--ash)]">Quick ask</p>
                    <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                      {promptChips.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => startPromptPost(prompt)}
                          className="flex-none rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-[12px] text-[var(--body-text)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hairline-divider" />

        {/* Board controls */}
        <section id="community-feed" className="scroll-mt-24 px-4 pb-2 pt-7 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="dateline">
                <span className="dateline-mark" aria-hidden="true" />
                Board
              </p>
              <h2 className="mt-2 font-display text-[30px] leading-none text-[var(--ink)]">
                {activeTopicName}
              </h2>
            </div>

            <span className="pb-1 text-[12px] text-[var(--ash)]">Latest posts</span>
          </div>

          {/* Topic chips */}
          <div className="no-scrollbar -mx-1 mt-4 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <button
              type="button"
              onClick={() => setAlertOnly((v) => !v)}
              aria-pressed={alertOnly}
              className={`topic-chip flex-none ${alertOnly ? "topic-chip--active" : "topic-chip--inactive"}`}
            >
              Alerts
            </button>
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

        <section className="px-4 pt-4 sm:px-6">
          <HighlightsStrip items={highlightItems} />
        </section>

        {/* Post feed */}
        <section className="px-4 pb-10 pt-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="dateline">
              <span className="dateline-mark" aria-hidden="true" />
              Community feed
            </span>
            <span className="text-[12px] tabular-nums text-[var(--ash)]">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"}
            </span>
          </div>

          {loading && filteredPosts.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="feed-card animate-[skeleton-pulse_1.6s_ease-in-out_infinite] space-y-3 p-4">
                  <div className="h-3 w-24 rounded bg-[var(--surface-card)]" />
                  <div className="h-4 w-3/4 rounded bg-[var(--hairline)]" />
                  <div className="h-3 w-full rounded bg-[var(--surface-card)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--surface-card)]" />
                </div>
              ))}
            </div>
          ) : postsError && posts.length === 0 ? (
            <div className="feed-card px-5 py-10 text-center">
              <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--ash)]">
                <MessageSquare className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <p className="text-[15px] font-medium text-[var(--ink)]">Couldn&apos;t load posts</p>
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
              <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--ash)]">
                <MessageSquare className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <p className="text-[15px] font-medium text-[var(--ink)]">
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
                <article key={post.id} className={`feed-card overflow-hidden ${post.alert_type ? "border-[rgba(214,162,74,0.32)]" : ""}`}>
                  <div className="flex items-center gap-3 px-4 pt-4">
                    <DefaultAvatar name="Anonymous" size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                          Anonymous
                        </span>
                        <span className="text-[11px] text-[var(--stone)]" aria-hidden="true">·</span>
                        <span className="truncate text-[12px] text-[var(--mute)]">{activeTopicName}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ash)]">
                        <span className="tag-chip">{post.tag || "General"}</span>
                        {post.alert_type && isPostAlertType(post.alert_type) ? (
                          <span className={`badge ${POST_ALERT_BADGE_CLASS[post.alert_type]}`}>
                            {POST_ALERT_LABELS[post.alert_type]}
                          </span>
                        ) : null}
                        <span>{relativeTime(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-3">
                    <h3 className="font-display text-[23px] leading-[1.18] text-[var(--ink)]">
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

                  {post.poll ? (
                    <PollResults
                      question={post.poll.question}
                      options={
                        polls[post.poll.id]?.options ??
                        (post.poll.options ?? []).map((o) => ({ id: o.id, text: o.text, votes: 0, percent: 0 }))
                      }
                      totalVotes={polls[post.poll.id]?.totalVotes ?? 0}
                      closed={polls[post.poll.id]?.closed ?? false}
                      votedOptionId={votedPolls[post.poll.id] ?? null}
                      onVote={(optionId) => void handlePollVote(post.poll!.id, optionId)}
                    />
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => handleUpvote(post.id, e)}
                      className="action-pill gap-1.5"
                      aria-label={`Like post, ${votes[post.id] ?? post.votes ?? 0} likes`}
                    >
                      <ThumbsUp className="h-[18px] w-[18px] text-[var(--ash)]" strokeWidth={1.7} aria-hidden="true" />
                      <span className="tabular-nums text-[13px] font-medium text-[var(--ink)]">
                        {votes[post.id] ?? post.votes ?? 0}
                      </span>
                    </button>

                    <HelpfulButton
                      postId={post.id}
                      count={helpful[post.id]?.count ?? post.helpful_count ?? 0}
                      marked={helpful[post.id]?.marked ?? Boolean(post.helpful_marked)}
                      onToggle={handleHelpful}
                    />

                    {post.alert_type && isPostAlertType(post.alert_type) ? (
                      <button
                        type="button"
                        onClick={() => setReportTarget({ postId: post.id, title: post.title })}
                        className="action-pill gap-1.5 border-[rgba(217,106,96,0.32)] bg-[var(--accent-red-soft)] text-[var(--accent-red)]"
                        aria-label={`Report ${post.title} as a local alert`}
                      >
                        <Flag className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
                        <span className="text-[13px] font-medium">Report</span>
                      </button>
                    ) : null}

                    <Link
                      href={`/chat/${activeTopic}`}
                      className="action-pill gap-1.5"
                      aria-label={`Discuss in ${activeTopicName} chat`}
                    >
                      <MessageSquare className="h-[18px] w-[18px] text-[var(--ash)]" strokeWidth={1.7} aria-hidden="true" />
                      <span className="text-[13px] font-medium">Discuss</span>
                    </Link>

                    <SavePostButton
                      className="ml-auto"
                      post={{
                        id: post.id,
                        title: post.title,
                        body: post.body,
                        tag: post.tag || "General",
                        citySlug: post.city_slug || activeTopic,
                        imageUrl: post.image_paths?.[0] ? normalizeImageUrl(post.image_paths[0]) : null,
                      }}
                    />
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
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
                className="mt-4 rounded-[var(--radius-md)] border border-[rgba(217,106,96,0.28)] bg-[var(--accent-red-soft)] p-3 text-[13px] text-[var(--accent-red)]"
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
                {showTagSuggestion && tagSuggestion ? (
                  <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[rgba(226,104,63,0.28)] bg-[var(--accent-ember-soft)] p-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-[var(--accent-ember-ink)]" strokeWidth={1.7} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-[var(--ink)]">
                        Suggested tag: {tagSuggestion.tag}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--body-text)]">
                        {tagSuggestion.reason}
                      </p>
                      <button
                        type="button"
                        className="mt-1.5 text-[12px] font-medium text-[var(--accent-ember-ink)] hover:underline"
                        onClick={() => {
                          setSelectedTag(tagSuggestion.tag);
                        }}
                      >
                        Use {tagSuggestion.tag}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] leading-relaxed text-[var(--ash)]">
                    Pick the closest tag so neighbours can find your post.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="post-alert-type" className="text-label block">
                  Alert type
                </label>
                <select
                  id="post-alert-type"
                  value={alertType ?? ""}
                  onChange={(e) => setAlertType((e.target.value || null) as PostAlertType | null)}
                  className="field"
                >
                  <option value="">No alert type</option>
                  {POST_ALERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {POST_ALERT_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] leading-relaxed text-[var(--ash)]">
                  Optional. Use it for local alerts like water cuts or road closures.
                </p>
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

              <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3">
                <button
                  type="button"
                  onClick={() => setPollEnabled((v) => !v)}
                  className="btn btn-outline min-h-[40px] w-full justify-center text-[13px]"
                  aria-pressed={pollEnabled}
                >
                  Add poll
                </button>

                {pollEnabled ? (
                  <div className="space-y-2">
                    <label htmlFor="poll-question" className="text-label block">
                      Poll question
                    </label>
                    <input
                      id="poll-question"
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Ask the community…"
                      maxLength={160}
                      className="field"
                    />

                    {pollOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => setPollOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))}
                          placeholder={`Option ${index + 1}`}
                          maxLength={120}
                          className="field"
                        />
                        {pollOptions.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== index))}
                            aria-label={`Remove option ${index + 1}`}
                            className="btn btn-icon btn-secondary min-h-[40px] min-w-[40px] px-0 text-[var(--mute)]"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                        ) : null}
                      </div>
                    ))}

                    {pollOptions.length < 4 ? (
                      <button
                        type="button"
                        onClick={() => setPollOptions((prev) => [...prev, ""])}
                        className="btn btn-tertiary min-h-[38px] text-[12px]"
                      >
                        Add option
                      </button>
                    ) : null}
                    <p className="text-[11px] leading-relaxed text-[var(--ash)]">
                      Polls stay open for 24 hours and stay anonymous.
                    </p>
                  </div>
                ) : null}
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
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-xs)] bg-black/70 text-[var(--ink)]"
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
                  disabled={
                    posting ||
                    !postTitle.trim() ||
                    !postBody.trim() ||
                    (pollEnabled && (pollQuestion.trim().length === 0 || pollOptions.filter((o) => o.trim().length > 0).length < 2))
                  }
                  className="btn btn-primary min-w-[132px]"
                >
                  {posting ? "Publishing…" : "Publish post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setReportTarget(null)}
        >
          <div
            className="sheet-enter max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-[var(--radius-xl)] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-post-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="report-post-title" className="text-h2">Report this post</h2>
                <p className="mt-1 text-[13px] text-[var(--mute)]">Send it to the moderation team.</p>
              </div>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                aria-label="Close"
                className="btn btn-icon btn-secondary -mr-1 -mt-1 text-[var(--mute)]"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-label" htmlFor="report-reason">
                Reason
              </label>
              <select
                id="report-reason"
                className="field"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="harassment">Harassment</option>
                <option value="hate">Hate</option>
                <option value="spam">Spam</option>
                <option value="personal-information">Personal info</option>
                <option value="violence">Violence</option>
                <option value="other">Other</option>
              </select>

              <label className="block text-label" htmlFor="report-details">
                Details
              </label>
              <textarea
                id="report-details"
                className="field"
                rows={3}
                maxLength={500}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Add context if needed. Keep it short."
              />

              {reportNotice ? (
                <p className="rounded-[var(--radius-md)] border border-[rgba(134,176,141,0.28)] bg-[var(--accent-green-soft)] p-3 text-[13px] text-[var(--accent-green)]" role="status">
                  {reportNotice}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className="btn btn-secondary" onClick={() => setReportTarget(null)} disabled={reportBusy}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void submitPostReport()} disabled={reportBusy}>
                  {reportBusy ? "Submitting..." : "Submit report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
