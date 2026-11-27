"use client";

import { Fragment, useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Lock,
  Send,
  Paperclip,
  ShieldCheck,
  ChevronDown,
  Film,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  body: string;
  time: string;
  fromYou: boolean;
  author: string;
  author_username: string | null;
  initials: string;
  delivery?: "sending" | "failed";
  createdAt?: string;
  clientId?: string;
};

type GifResult = {
  id: string;
  title: string;
  preview: string;
  url: string;
  width: number;
  height: number;
};

const POLL_MS = 3000;
const GIF_PREFIX = "gif::";
const GIPHY_MEDIA_HOST = /^media\d*\.giphy\.com$/;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮"] as const;
const REACTION_PICKER_WIDTH = 208;
const REACTION_PICKER_HEIGHT = 56;

// GIF messages store the media URL in the body behind a prefix. Only Giphy
// media hosts are rendered, so a hand-crafted body cannot load another site.
function parseGifUrl(body: string): string | null {
  if (!body.startsWith(GIF_PREFIX)) return null;
  const raw = body.slice(GIF_PREFIX.length).trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (!GIPHY_MEDIA_HOST.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function messageTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString();
}

function formatClock(message: Pick<Message, "createdAt" | "time">): string {
  if (!message.createdAt) return message.time;
  const date = new Date(message.createdAt);
  if (Number.isNaN(date.getTime())) return message.time;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function messageDayKey(createdAt?: string): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return String(startOfDay(date));
}

function messageDayLabel(createdAt?: string): string {
  if (!createdAt) return "Today";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Today";
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Merge by id so a poll or a realtime event never wipes older messages, and
// drop the optimistic placeholder once its saved row arrives.
function mergeMessages(base: Message[], incoming: Message[]): Message[] {
  const byId = new Map(base.map((message) => [message.id, message]));
  for (const next of incoming) {
    if (next.clientId) {
      for (const [id, existing] of byId) {
        if (id.startsWith("temp-") && existing.clientId === next.clientId) {
          byId.delete(id);
        }
      }
    }
    byId.set(next.id, next);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
    return at - bt;
  });
}

function mapRealtimeRow(
  row: Record<string, unknown>,
  currentUserId: string | null,
): Message | null {
  const id = String(row.id ?? "");
  if (!id) return null;
  const createdAt = String(row.created_at ?? new Date().toISOString());
  const isMine = Boolean(currentUserId) && String(row.author_id ?? "") === currentUserId;
  const handle = String(row.author_handle ?? "").trim() || "Community member";
  return {
    id,
    body: row.deleted_at ? "" : String(row.body ?? ""),
    time: messageTime(createdAt),
    fromYou: isMine,
    author: isMine ? "You" : handle,
    author_username: isMine ? null : String(row.author_handle ?? "") || null,
    initials: isMine ? "YO" : handle.slice(0, 2).toUpperCase(),
    createdAt,
    clientId: row.client_id ? String(row.client_id) : undefined,
  };
}

function readClientName(): string {
  try {
    if (typeof window === "undefined") return "Anonymous";
    return localStorage.getItem("civiccircle-client-name") || "Anonymous";
  } catch {
    return "Anonymous";
  }
}

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [chatError, setChatError] = useState<{ message: string; code?: string } | null>(null);

const scrollRef = useRef<HTMLDivElement>(null);
const isNearBottomRef = useRef(true);
const activeRef = useRef(true);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const attachRef = useRef<HTMLInputElement>(null);
const lastMessageAtRef = useRef<string | null>(null);
const didInitialLoadRef = useRef(false);
const [areaId, setAreaId] = useState<string | null>(null);
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
const [clientName] = useState(readClientName);
const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
const [gifOpen, setGifOpen] = useState(false);
const [gifQuery, setGifQuery] = useState("");
const [gifs, setGifs] = useState<GifResult[]>([]);
const [gifLoading, setGifLoading] = useState(false);
const [gifError, setGifError] = useState<string | null>(null);
const gifRequestRef = useRef(0);
const lastGifQueryRef = useRef<string | null>(null);

const [reactions, setReactions] = useState<Record<string, string[]>>(() => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`civiccircle-chat-reactions:${roomId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
});
const [reactionTarget, setReactionTarget] = useState<{
  messageId: string;
  x: number;
  y: number;
} | null>(null);
const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const roomTitle = roomId.replace(/-/g, " ");
  const isGlobal = roomId === "general";

  const pollMessages = useCallback(async () => {
    // Only ask for messages newer than the last one we have. This keeps the
    // list append-only so polling can never wipe earlier messages.
    const since = lastMessageAtRef.current;
    const params = new URLSearchParams({ room: roomId });
    if (since) params.set("since", since);
    const url = `/api/messages?${params.toString()}`;
    console.log("[poll] fetching messages...", since ? `since=${since}` : "initial");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        if (activeRef.current) {
          setChatError({
            message: err?.error || "Could not load messages.",
            code: err?.code,
          });
        }
        console.log("[poll] failed:", res.status, err?.code ?? "");
        return;
      }
      const data = await res.json();
      if (!activeRef.current) return;

      const incoming = Array.isArray(data.messages) ? (data.messages as Message[]) : [];
      console.log("[poll] new messages:", incoming.length, "area:", data.areaId ?? null);

      if (typeof data.areaId === "string") setAreaId(data.areaId);
      if (typeof data.currentUserId === "string") setCurrentUserId(data.currentUserId);

      setChatError(null);

      const newest = incoming.reduce(
        (max, message) =>
          message.createdAt && message.createdAt > max ? message.createdAt : max,
        lastMessageAtRef.current ?? "",
      );
      if (newest) lastMessageAtRef.current = newest;

      setMessages((prev) => {
        const merged = mergeMessages(prev, incoming);
        if (prev.length > 0 && merged.length > prev.length && !isNearBottomRef.current) {
          setHasNewMessages(true);
        }
        // First load keeps only the latest couple of messages on screen. Earlier
        // history is lazy-loaded when the reader scrolls up to the top.
        if (since === null && !didInitialLoadRef.current) {
          didInitialLoadRef.current = true;
          setHasOlder(true);
          return merged.length > 2 ? merged.slice(-2) : merged;
        }
        return merged;
      });
    } catch (error) {
      console.log("[poll] error:", error);
    }
  }, [roomId]);

  useEffect(() => {
    activeRef.current = true;
    lastMessageAtRef.current = null;

    const initial = setTimeout(() => { void pollMessages(); }, 0);
    // Always poll while the room is mounted. No visibility pause.
    intervalRef.current = setInterval(() => { void pollMessages(); }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void pollMessages();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      activeRef.current = false;
      clearTimeout(initial);
      clearInterval(intervalRef.current ?? 0);
      intervalRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollMessages]);

  // Realtime is the fast path; polling stays as the fallback.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      console.log("[realtime] browser client unavailable");
      return;
    }
    if (!isGlobal && !areaId) return;

    const filter = isGlobal ? "scope=eq.global" : `area_id=eq.${areaId}`;
    const channelName = isGlobal ? "global-chat" : `city-chat-${areaId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const message = mapRealtimeRow(
            payload.new as Record<string, unknown>,
            currentUserId,
          );
          if (!message) return;
          console.log("[realtime] message:", message.id);
          // Do not move the poll cursor here. Only the ordered poll response
          // advances it, otherwise a message from another device could be
          // skipped between polls.
          setMessages((prev) => {
            const merged = mergeMessages(prev, [message]);
            if (merged.length > prev.length && !isNearBottomRef.current) {
              setHasNewMessages(true);
            }
            return merged;
          });
        },
      )
      .subscribe((status: string) => {
        console.log("[realtime] status:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isGlobal, areaId, currentUserId]);

  const loadGifs = useCallback(async (query: string) => {
    const requestId = ++gifRequestRef.current;
    setGifLoading(true);
    setGifError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const search = params.toString();
      const res = await fetch(`/api/giphy${search ? `?${search}` : ""}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { gifs?: GifResult[]; error?: string }
        | null;
      if (requestId !== gifRequestRef.current) return;
      if (!res.ok) {
        setGifError(data?.error || "Could not load GIFs.");
        setGifs([]);
        return;
      }
      setGifs(Array.isArray(data?.gifs) ? data.gifs : []);
      lastGifQueryRef.current = query;
    } catch {
      if (requestId !== gifRequestRef.current) return;
      setGifError("Could not load GIFs. Check your connection and try again.");
      setGifs([]);
    } finally {
      if (requestId === gifRequestRef.current) setGifLoading(false);
    }
  }, []);

  // Load trending GIFs when the sheet opens, then debounce typed searches.
  useEffect(() => {
    if (!gifOpen) return;
    const term = gifQuery.trim();
    if (term.length === 1) return;
    if (lastGifQueryRef.current === term) return;
    const handle = setTimeout(() => {
      void loadGifs(term);
    }, term ? 450 : 0);
    return () => clearTimeout(handle);
  }, [gifOpen, gifQuery, loadGifs]);

  // Reactions are per-device for now. They persist across reloads but are not
  // shared with other people in the room.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        `civiccircle-chat-reactions:${roomId}`,
        JSON.stringify(reactions),
      );
    } catch {
      // Storage can be unavailable in private mode; reactions still work in memory.
    }
  }, [reactions, roomId]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function openReactionPicker(messageId: string, clientX: number, clientY: number) {
    const maxLeft = Math.max(8, window.innerWidth - REACTION_PICKER_WIDTH - 8);
    const left = Math.min(Math.max(8, clientX - REACTION_PICKER_WIDTH / 2), maxLeft);
    const top = Math.max(
      8,
      Math.min(clientY - REACTION_PICKER_HEIGHT - 10, window.innerHeight - REACTION_PICKER_HEIGHT - 8),
    );
    setReactionTarget({ messageId, x: left, y: top });
  }

  function openReactionPickerForRow(messageId: string, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    openReactionPicker(
      messageId,
      rect.left + Math.min(rect.width / 2, 120),
      rect.top + 8,
    );
  }

  function startLongPress(event: React.PointerEvent<HTMLElement>, messageId: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    const x = event.clientX;
    const y = event.clientY;
    longPressOriginRef.current = { x, y };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      openReactionPicker(messageId, x, y);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
    }, 450);
  }

  function moveLongPress(event: React.PointerEvent<HTMLElement>) {
    const origin = longPressOriginRef.current;
    if (!origin) return;
    if (Math.abs(event.clientX - origin.x) > 8 || Math.abs(event.clientY - origin.y) > 8) {
      clearLongPress();
      longPressOriginRef.current = null;
    }
  }

  function endLongPress() {
    clearLongPress();
    longPressOriginRef.current = null;
  }

  function toggleReaction(messageId: string, emoji: string) {
    setReactions((prev) => {
      const current = prev[messageId] ?? [];
      const next = current.includes(emoji)
        ? current.filter((item) => item !== emoji)
        : [...current, emoji];
      const updated = { ...prev };
      if (next.length > 0) updated[messageId] = next;
      else delete updated[messageId];
      return updated;
    });
    setReactionTarget(null);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isBottom = scrollHeight - scrollTop - clientHeight < 80;
    isNearBottomRef.current = isBottom;
    if (isBottom) setHasNewMessages(false);
    if (scrollTop < 48 && hasOlder && !loadingOlder) void handleLoadOlder();
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      setHasNewMessages(false);
    }
  }

  async function handleLoadOlder() {
    if (loadingOlder || !hasOlder || !messages.length) return;
    const before = messages[0]?.createdAt;
    if (!before) {
      setHasOlder(false);
      return;
    }
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/messages?room=${roomId}&before=${encodeURIComponent(before)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        if (activeRef.current) {
          setChatError({
            message: err?.error || "Could not load earlier messages.",
            code: err?.code,
          });
        }
        return;
      }
      const data = (await res.json()) as { messages?: Message[] };
      const older = Array.isArray(data.messages) ? data.messages : [];
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setHasOlder(older.length >= 50);
      } else {
        setHasOlder(false);
      }
      const el = scrollRef.current;
      if (el) el.scrollTop = 0;
    } catch {
      if (activeRef.current) {
        setChatError({ message: "Could not load earlier messages. Check your connection and try again." });
      }
    } finally {
      if (activeRef.current) setLoadingOlder(false);
    }
  }

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function deliver(body: string) {
    if (!body || sending) return;

    // A fresh id per message keeps retries idempotent without collapsing every
    // message from this device into the first one via the unique index.
    const messageClientId = crypto.randomUUID();
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: tempId,
      body,
      time: "Just now",
      fromYou: true,
      author: clientName,
      author_username: null,
      initials: clientName.slice(0, 2).toUpperCase(),
      delivery: "sending",
      createdAt: new Date().toISOString(),
      clientId: messageClientId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setSending(true);
    isNearBottomRef.current = true;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: roomId,
          channel: "chitchat",
          room: roomId,
          body,
          clientId: messageClientId,
          authorName: clientName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = { ...data.message, fromYou: true, delivery: undefined } as Message;
        setChatError(null);
        // Keep the cursor where it is; the next ordered poll advances it and
        // also picks up messages from other devices that came before this one.
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), [saved]));
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setChatError({
          message: err?.error || "Could not send your message.",
          code: err?.code,
        });
      }
    } catch {
      // Roll back on network failure so the UI never shows a message that was
      // not saved.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setChatError({ message: "Could not send your message. Check your connection and try again." });
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // Photo sharing stays in area chat only. General chat is text and GIFs.
    const fullBody = !isGlobal && pendingImageUrl ? `${pendingImageUrl}\n${text}` : text;
    setInput("");
    setPendingImageUrl(null);
    await deliver(fullBody);
  }

  async function handleGifSelect(gif: GifResult) {
    if (sending) return;
    setGifOpen(false);
    await deliver(`${GIF_PREFIX}${gif.url}`);
  }

  return (
    <div className="mobile-container chat-page relative h-[100dvh] overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="relative px-4 pb-3 pt-[max(env(safe-area-inset-top),16px)] text-center">
          <Link
            href="/home"
            aria-label="Back to home"
            className="btn btn-icon btn-secondary absolute left-2 top-[max(env(safe-area-inset-top),16px)] text-[var(--mute)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <h1 className="truncate text-[30px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)] sm:text-[38px]">
            {isGlobal ? "General" : roomTitle}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[var(--mute)]">
            <span>Community chat</span>
            <span className="h-1 w-1 rounded-full bg-[var(--ash)]" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              Live
            </span>
          </p>
        </div>
      </header>

      {chatError ? (
        <div className="flex flex-col items-center gap-1.5 border-b border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-center">
          <p className="flex items-center gap-2 text-[13px] text-[var(--body-text)]">
            <span className="h-1.5 w-1.5 flex-none bg-[var(--accent-red)]" aria-hidden="true" />
            {chatError.message}
          </p>
          {chatError.code === "invalid_area" ? (
            <Link href="/nearby" className="text-[12px] font-medium text-[var(--accent-ember-ink)] underline-offset-2 hover:underline">
              Set your area in Nearby
            </Link>
          ) : chatError.code === "auth_required" ? (
            <Link href="/profile" className="text-[12px] font-medium text-[var(--accent-ember-ink)] underline-offset-2 hover:underline">
              Sign in to continue
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Message List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-1 sm:px-6"
      >
        <div className="flex items-center justify-center gap-1.5 py-2 text-center text-[11px] text-[var(--ash)]">
          <ShieldCheck className="h-3 w-3 flex-none" strokeWidth={1.7} aria-hidden="true" />
          <span>
            {isGlobal
              ? "Messages are shared with everyone on CivicCircle."
              : "Messages are shared with others in this city."}
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="flex flex-col items-center">
              <span className="app-tile mb-3 h-11 w-11 text-[var(--mute)]">
                <Lock className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-medium text-[var(--ink)]">
                {chatError ? "Chat unavailable" : "No messages yet"}
              </p>
              <p className="mt-1 text-[12px] text-[var(--mute)]">
                {chatError ? "Set your area or sign in to see this room." : "Start the conversation in this room."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {loadingOlder ? (
              <div className="space-y-4 py-2" aria-label="Loading earlier messages">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-elevated)]" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-elevated)]" />
                  </div>
                ))}
              </div>
            ) : null}
            {messages.map((m, index) => {
              const gifUrl = parseGifUrl(m.body);
              const day = messageDayKey(m.createdAt);
              const previousDay = messageDayKey(messages[index - 1]?.createdAt);
              const showDay = day !== "" && day !== previousDay;
              const selectedReactions = reactions[m.id] ?? [];

              return (
                <Fragment key={m.id}>
                  {showDay ? (
                    <div
                      className="flex items-center gap-3 py-3"
                      role="separator"
                      aria-label={messageDayLabel(m.createdAt)}
                    >
                      <span className="h-px flex-1 bg-[var(--hairline)]" />
                      <span className="text-[12px] font-medium text-[var(--ash)]">
                        {messageDayLabel(m.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-[var(--hairline)]" />
                    </div>
                  ) : null}

                  <div
                    className="chat-message -mx-2 rounded-[12px] px-2 py-1.5 outline-none focus-visible:bg-[var(--surface-elevated)]"
                    tabIndex={0}
                    role="article"
                    aria-label={`Message from ${m.fromYou ? "you" : m.author}`}
                    onPointerDown={(event) => startLongPress(event, m.id)}
                    onPointerMove={moveLongPress}
                    onPointerUp={endLongPress}
                    onPointerCancel={endLongPress}
                    onPointerLeave={endLongPress}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openReactionPicker(m.id, event.clientX, event.clientY);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openReactionPickerForRow(m.id, event.currentTarget);
                      }
                    }}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-[13px] font-semibold ${
                          m.fromYou ? "text-[var(--accent-ink)]" : "text-[var(--ink)]"
                        }`}
                      >
                        {m.fromYou ? "You" : m.author}
                      </span>
                      <span className="text-[11px] tabular-nums text-[var(--ash)]">
                        {m.delivery === "sending" ? "Sending..." : formatClock(m)}
                      </span>
                    </div>

                    {gifUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={gifUrl}
                        alt="GIF"
                        loading="lazy"
                        draggable={false}
                        className="mt-1.5 max-h-60 w-auto max-w-[240px] rounded-[10px] border border-[var(--hairline)] object-cover"
                      />
                    ) : (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--body-text)]">
                        {m.body}
                      </p>
                    )}

                    {selectedReactions.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {selectedReactions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, emoji)}
                            className="chat-react-pill"
                            aria-label={`Remove ${emoji} reaction`}
                          >
                            <span aria-hidden="true">{emoji}</span>
                            <span className="text-[10px] font-medium">1</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* New messages floating indicator */}
      {hasNewMessages && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="btn btn-primary btn-sm absolute bottom-24 left-1/2 -translate-x-1/2"
        >
          <span>New messages</span>
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}

      {/* Input Bar */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--canvas)] px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
        <form
          onSubmit={handleSend}
          className="chat-composer flex items-center gap-1 rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1.5"
        >
          {!isGlobal ? (
            <>
              <button
                type="button"
                onClick={() => attachRef.current?.click()}
                className="btn btn-icon btn-secondary flex-none text-[var(--mute)]"
                aria-label="Attach file"
              >
                <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <input
                ref={attachRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSending(true);
                  try {
                    const formData = new FormData();
                    formData.append("imagePaths", file);
                    const res = await fetch("/api/posts/images", {
                      method: "POST",
                      body: formData,
                    });
                    if (res.ok) {
                      const data = await res.json();
                      const url = Array.isArray(data.imagePaths) ? data.imagePaths[0] : data.imagePaths;
                      if (url) {
                        setPendingImageUrl(url);
                      }
                    }
                  } catch {
                    // silent
                  } finally {
                    setSending(false);
                    e.target.value = "";
                  }
                }}
              />
            </>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setReactionTarget(null);
              setGifOpen(true);
            }}
            className="btn btn-icon btn-secondary flex-none text-[var(--mute)]"
            aria-label="Search GIFs"
          >
            <Film className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setReactionTarget(null)}
            placeholder={`Message #${isGlobal ? "General" : roomTitle}`}
            className="chat-composer-input h-10"
            aria-label={`Message #${isGlobal ? "General" : roomTitle}`}
          />

          {input.trim() ? (
            <button
              type="submit"
              disabled={sending}
              className="btn btn-icon btn-primary flex-none"
              aria-label="Send message"
            >
              <Send className="ml-0.5 h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </form>
      </footer>

      {reactionTarget && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close reactions"
                className="fixed inset-0 z-[90] cursor-default bg-transparent"
                onClick={() => setReactionTarget(null)}
              />
              <div
                role="dialog"
                aria-label="React to message"
                className="chat-react-picker fixed z-[91] flex items-center gap-0.5 rounded-full border border-[rgba(29,185,84,0.35)] bg-[var(--surface)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
                style={{ left: reactionTarget.x, top: reactionTarget.y }}
              >
                {REACTION_EMOJIS.map((emoji) => {
                  const active = (reactions[reactionTarget.messageId] ?? []).includes(emoji);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React with ${emoji}`}
                      aria-pressed={active}
                      className={`chat-react-emoji ${active ? "is-active" : ""}`}
                      onClick={() => toggleReaction(reactionTarget.messageId, emoji)}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )
        : null}

      {gifOpen && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close GIF search"
                className="fixed inset-0 z-[80] cursor-default bg-black/60 "
                onClick={() => setGifOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Search GIFs"
                className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[78dvh] w-full max-w-[820px] flex-col rounded-t-[var(--radius-2xl)] border-t border-[var(--hairline)] bg-[var(--surface)] pb-[max(env(safe-area-inset-bottom),12px)]"
              >
                <span
                  className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--hairline-strong)]"
                  aria-hidden="true"
                />

                <div className="flex items-center gap-2 px-4 pb-2 pt-3">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ash)]"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={gifQuery}
                      onChange={(e) => setGifQuery(e.target.value)}
                      placeholder="Search GIFs"
                      className="field h-10 min-h-0 w-full has-icon-left has-icon-right"
                      aria-label="Search GIFs"
                    />
                    {gifLoading ? (
                      <Loader2
                        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--ash)]"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGifOpen(false)}
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
                  {gifError ? (
                    <p className="py-8 text-center text-[13px] text-[var(--mute)]">{gifError}</p>
                  ) : gifLoading && gifs.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-[var(--mute)]">
                      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                    </div>
                  ) : gifs.length === 0 ? (
                    <p className="py-8 text-center text-[13px] text-[var(--mute)]">
                      No GIFs found.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {gifs.map((gif) => (
                        <button
                          key={gif.id}
                          type="button"
                          disabled={sending}
                          onClick={() => void handleGifSelect(gif)}
                          className="relative overflow-hidden rounded-[12px] border border-[var(--hairline)] bg-[var(--surface-card)] transition-opacity hover:opacity-90 disabled:opacity-60"
                          aria-label={`Send ${gif.title}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={gif.preview}
                            alt={gif.title}
                            loading="lazy"
                            className="h-32 w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p className="px-4 pb-1 pt-2 text-center text-[12px] tracking-[0.3px] text-[var(--ash)]">
                  Powered by GIPHY
                </p>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
