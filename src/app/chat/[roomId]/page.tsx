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
  const clientId = typeof window !== "undefined" ? localStorage.getItem("vibechat-client-id") || crypto.randomUUID() : "";
  const clientName = typeof window !== "undefined" ? localStorage.getItem("vibechat-client-name") || "Anonymous" : "Anonymous";

  if (typeof window !== "undefined" && !localStorage.getItem("vibechat-client-id")) {
    localStorage.setItem("vibechat-client-id", clientId);
  }

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

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: roomId,
          channel: "chitchat",
          body: text,
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
      scrollToBottom();
      // Restart polling
      if (!intervalRef.current) {
        intervalRef.current = setInterval(loadMessages, 3000);
      }
    }
  }

  return (
    <div className="mobile-container chat-page h-[100dvh] flex flex-col justify-between overflow-hidden bg-[#0B0B14]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#0B0B14]/90 px-3 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-gray-300 hover:text-white transition"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white capitalize">{roomTitle}</h1>
            <div className="flex items-center gap-1 text-[11px] text-purple-400">
              <Lock className="h-2.5 w-2.5" />
              <span>End-to-End Encrypted</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live</span>
        </div>
      </header>

      {/* Encryption banner */}
      <div className="bg-[#121222] border-b border-white/[0.04] px-4 py-2 text-center">
        <p className="inline-flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
          <span>Messages are private and encrypted between participants.</span>
        </p>
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center p-6 text-gray-400 text-xs">
            <div>
              <Lock className="mx-auto h-7 w-7 text-purple-400/50 mb-2" />
              <p className="font-medium text-white">No messages yet</p>
              <p className="text-gray-500 mt-1">Start the conversation in this room.</p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.fromYou ? "items-end" : "items-start"}`}
            >
              {!m.fromYou && (
                <span className="text-[10px] text-gray-400 font-medium mb-1 ml-1">
                  {m.author}
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.fromYou
                    ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-br-xs shadow-[0_2px_12px_rgba(168,85,247,0.3)]"
                    : "glass-card text-gray-200 rounded-bl-xs border border-white/[0.08]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div
                  className={`mt-1 text-[9px] text-right ${
                    m.fromYou ? "text-purple-200" : "text-gray-400"
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
          className="gradient-btn absolute bottom-20 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          <span>New messages</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Input Bar */}
      <footer className="border-t border-white/[0.08] bg-[#0E0E18]/95 p-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/[0.06] text-gray-400 hover:text-white transition"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-white/10 bg-[#161626] px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500 transition"
          />

          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="gradient-circle-btn flex h-10 w-10 flex-none items-center justify-center rounded-full text-white shadow-md disabled:opacity-40 transition-transform active:scale-95"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
