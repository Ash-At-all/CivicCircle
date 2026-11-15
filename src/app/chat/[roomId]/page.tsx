"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Send, Paperclip, ShieldCheck, ChevronDown } from "lucide-react";

type Message = {
  id: string;
  body: string;
  time: string;
  fromYou: boolean;
  author: string;
  author_username: string | null;
  initials: string;
  delivery?: "sending" | "failed";
};

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);

const scrollRef = useRef<HTMLDivElement>(null);
const isNearBottomRef = useRef(true);
const activeRef = useRef(true);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const attachRef = useRef<HTMLInputElement>(null);
const clientId = typeof window !== "undefined" ? localStorage.getItem("civiccircle-client-id") || crypto.randomUUID() : "";
const clientName = typeof window !== "undefined" ? localStorage.getItem("civiccircle-client-name") || "Anonymous" : "Anonymous";

if (typeof window !== "undefined" && !localStorage.getItem("civiccircle-client-id")) {
  localStorage.setItem("civiccircle-client-id", clientId);
}

const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  const roomTitle = roomId.replace(/-/g, " ");

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/messages?city=${encodeURIComponent(roomId)}&channel=chitchat&anon=${encodeURIComponent(clientId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!activeRef.current || !data.messages) return;

      setMessages((prev) => {
        if (prev.length > 0 && data.messages.length > prev.length && !isNearBottomRef.current) {
          setHasNewMessages(true);
        }
        return data.messages;
      });
    } catch {
      // silent
    }
  };

  useEffect(() => {
    activeRef.current = true;

    loadMessages();
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => {
      activeRef.current = false;
      clearInterval(intervalRef.current ?? 0);
      intervalRef.current = null;
    };
  }, [roomId, clientId]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 80;
    isNearBottomRef.current = isBottom;
    if (isBottom) setHasNewMessages(false);
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      setHasNewMessages(false);
    }
  }

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // Stop polling while sending to avoid overwriting optimistic messages
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      body: text,
      time: "Just now",
      fromYou: true,
      author: clientName,
      author_username: null,
      initials: clientName.slice(0, 2).toUpperCase(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");
    setSending(true);
    isNearBottomRef.current = true;

    const fullBody = pendingImageUrl ? `${pendingImageUrl}\n${text}` : text;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: roomId,
          channel: "chitchat",
          body: fullBody,
          anonId: clientId,
          authorName: clientName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message, fromYou: true } : m))
        );
      }
    } catch {
      // optimistic keeps message
    } finally {
      setSending(false);
      setPendingImageUrl(null);
      scrollToBottom();
      // Restart polling
      if (!intervalRef.current) {
        intervalRef.current = setInterval(loadMessages, 3000);
      }
    }
  }

  return (
    <div className="mobile-container chat-page relative h-[100dvh] overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[rgba(7,8,10,0.88)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)]">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/home"
              className="btn btn-icon btn-secondary text-[var(--mute)]"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium capitalize tracking-[0.2px] text-[var(--ink)]">
                {roomTitle}
              </h1>
              <p className="text-[11px] tracking-[0.3px] text-[var(--ash)]">Community chat</p>
            </div>
          </div>

          <span className="badge badge-success flex-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
            Live
          </span>
        </div>
      </header>

      {/* Encryption banner */}
      <div className="border-b border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-center">
        <p className="inline-flex items-center justify-center gap-1.5 text-[11px] tracking-[0.3px] text-[var(--mute)]">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--ash)]" strokeWidth={1.8} />
          <span>Messages are shared with others in this city.</span>
        </p>
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="flex flex-col items-center">
              <span className="app-tile mb-3 h-11 w-11 text-[var(--mute)]">
                <Lock className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-medium text-[var(--ink)]">No messages yet</p>
              <p className="mt-1 text-[12px] text-[var(--mute)]">
                Start the conversation in this room.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.fromYou ? "items-end" : "items-start"}`}
            >
              {!m.fromYou && (
                <span className="mb-1 ml-1 text-[11px] font-medium tracking-[0.3px] text-[var(--mute)]">
                  {m.author}
                </span>
              )}
              <div
                className={`max-w-[82%] rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  m.fromYou
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "border border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--body-text)]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div
                  className={`mt-1 text-right text-[10px] tracking-[0.2px] ${
                    m.fromYou ? "text-black/55" : "text-[var(--ash)]"
                  }`}
                >
                  {m.time}
                </div>
              </div>
            </div>
          ))
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
      <footer className="border-t border-[var(--hairline)] bg-[rgba(7,8,10,0.94)] p-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => attachRef.current?.click()}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" strokeWidth={1.8} />
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

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="field h-10 min-h-0 flex-1 rounded-full px-4"
          />

          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)] disabled:cursor-not-allowed disabled:bg-[var(--surface-elevated)] disabled:text-[var(--ash)] active:scale-95"
            aria-label="Send message"
          >
            <Send className="ml-0.5 h-4 w-4" strokeWidth={2} />
          </button>
        </form>
      </footer>
    </div>
  );
}
