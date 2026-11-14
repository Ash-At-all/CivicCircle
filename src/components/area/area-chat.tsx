"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AREA_SCOPES,
  roomCountMessage,
  scopeLabel,
  type AreaChatMessage,
  type AreaMessagesPage,
  type AreaScope,
} from "@/features/area/chat";

type Props = {
  areaIds: { locality: string; ward: string; city: string };
  localityName: string;
  showPresence: boolean;
  onPresenceChange: (next: boolean) => Promise<void>;
  onSheetActive: () => void;
  onClearArea: () => void;
};

type PendingMessage = {
  clientId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
};

type RoomState = {
  loaded: boolean;
  loading: boolean;
  loadingOlder: boolean;
  error: string | null;
  notice: string | null;
  rateLimitMessage: string | null;
  messages: AreaChatMessage[];
  nextCursor: string | null;
  roomCount: number;
  muted: boolean;
  pending: PendingMessage[];
};

const EMPTY_ROOM: RoomState = {
  loaded: false,
  loading: false,
  loadingOlder: false,
  error: null,
  notice: null,
  rateLimitMessage: null,
  messages: [],
  nextCursor: null,
  roomCount: 0,
  muted: false,
  pending: [],
};

function mergeServerMessage(state: RoomState, message: AreaChatMessage): RoomState {
  const pending = state.pending.filter((item) => item.clientId !== message.clientId);
  const index = state.messages.findIndex(
    (item) => item.id === message.id || (message.clientId && item.clientId === message.clientId),
  );
  const messages = [...state.messages];
  if (index >= 0) messages[index] = message;
  else messages.push(message);
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { ...state, messages, pending };
}

function mergeIncoming(messages: AreaChatMessage[], incoming: AreaChatMessage) {
  const index = messages.findIndex(
    (item) => item.id === incoming.id || (incoming.clientId && item.clientId === incoming.clientId),
  );
  if (index >= 0) {
    const next = [...messages];
    next[index] = incoming;
    return next;
  }
  return [...messages, incoming].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AreaChat({
  areaIds,
  localityName,
  showPresence,
  onPresenceChange,
  onSheetActive,
  onClearArea,
}: Props) {
  const [scope, setScope] = useState<AreaScope>("locality");
  const [rooms, setRooms] = useState<Record<AreaScope, RoomState>>({
    locality: { ...EMPTY_ROOM },
    ward: { ...EMPTY_ROOM },
    city: { ...EMPTY_ROOM },
  });
  const [draft, setDraft] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<AreaChatMessage | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [viewerId, setViewerId] = useState<string | null>(null);

  const roomsRef = useRef(rooms);
  const scopeRef = useRef(scope);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const seenIdsRef = useRef<Record<AreaScope, Set<string>>>({
    locality: new Set(),
    ward: new Set(),
    city: new Set(),
  });
  const lastPresenceRoomRef = useRef<string | null>(null);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  const currentAreaId = areaIds[scope];
  const room = rooms[scope];

  const updateRoom = useCallback(
    (targetScope: AreaScope, updater: (state: RoomState) => RoomState) => {
      setRooms((prev) => ({ ...prev, [targetScope]: updater(prev[targetScope]) }));
    },
    [],
  );

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  }, []);

  const fetchMessages = useCallback(
    async (targetScope: AreaScope, cursor?: string | null, mode: "initial" | "older" | "poll" = "initial") => {
      if (mode === "initial" && roomsRef.current[targetScope].loading) return;
      if (mode === "older" && roomsRef.current[targetScope].loadingOlder) return;
      if (mode === "poll" && (roomsRef.current[targetScope].loading || roomsRef.current[targetScope].loadingOlder)) return;

      updateRoom(targetScope, (state) => ({
        ...state,
        loading: mode === "initial",
        loadingOlder: mode === "older",
        error: mode === "poll" ? state.error : null,
        notice: mode === "poll" ? state.notice : null,
      }));

      try {
        const params = new URLSearchParams({ scope: targetScope });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/area/messages?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as Partial<AreaMessagesPage> & {
          error?: string;
          retry_after?: number;
        };

        if (!res.ok) {
          const message =
            typeof json.error === "string" ? json.error : "Could not load messages.";
          updateRoom(targetScope, (state) => ({
            ...state,
            loading: false,
            loadingOlder: false,
            error: mode === "poll" ? state.error : message,
            rateLimitMessage:
              res.status === 429 && mode === "initial" ? message : state.rateLimitMessage,
          }));
          return;
        }

        const page = json as AreaMessagesPage;
        if (page.viewer?.id) setViewerId(page.viewer.id);

        updateRoom(targetScope, (state) => {
          const incoming = page.messages ?? [];
          incoming.forEach((m) => seenIdsRef.current[targetScope].add(m.id));

          if (mode === "older") {
            const existingIds = new Set(state.messages.map((m) => m.id));
            const merged = [
              ...incoming.filter((m) => !existingIds.has(m.id)),
              ...state.messages,
            ];
            return {
              ...state,
              loaded: true,
              loading: false,
              loadingOlder: false,
              error: null,
              messages: merged,
              nextCursor: page.nextCursor,
              roomCount: page.roomCount,
              muted: page.muted,
            };
          }

          if (mode === "poll") {
            let messages = state.messages;
            for (const msg of incoming) messages = mergeIncoming(messages, msg);
            return {
              ...state,
              loaded: true,
              loading: false,
              loadingOlder: false,
              messages,
              nextCursor: state.nextCursor ?? page.nextCursor,
              roomCount: page.roomCount,
              muted: page.muted,
            };
          }

          const existingIds = new Set(incoming.map((m) => m.id));
          const pending = state.pending.filter((p) => !existingIds.has(p.clientId));
          return {
            ...state,
            loaded: true,
            loading: false,
            loadingOlder: false,
            error: null,
            messages: incoming,
            nextCursor: page.nextCursor,
            roomCount: page.roomCount,
            muted: page.muted,
            pending,
          };
        });

        if (mode === "initial") {
          stickToBottomRef.current = true;
          scrollToBottom(false);
        }
      } catch {
        updateRoom(targetScope, (state) => ({
          ...state,
          loading: false,
          loadingOlder: false,
          error:
            mode === "poll"
              ? state.error
              : "Could not load messages. Check your connection and try again.",
        }));
      }
    },
    [scrollToBottom, updateRoom],
  );

  useEffect(() => {
    if (room.loaded || room.loading) return;
    const id = window.setTimeout(() => {
      void fetchMessages(scope, null, "initial");
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchMessages, room.loaded, room.loading, scope]);

  useEffect(() => {
    onSheetActive();
  }, [onSheetActive, scope]);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(false);
  }, [room.messages.length, room.pending.length, scope, scrollToBottom]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      updateRoom(scopeRef.current, (s) => ({ ...s, notice: null, error: null }));
      void fetchMessages(scopeRef.current, null, "poll");
    };
    const onOffline = () => {
      setOnline(false);
      updateRoom(scopeRef.current, (s) => ({
        ...s,
        notice: "You are offline. New messages will load when you reconnect.",
      }));
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [fetchMessages, updateRoom]);

  // Polling fallback and room-count refresh.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!online) return;
      void fetchMessages(scopeRef.current, null, "poll");
    }, 12000);
    return () => window.clearInterval(id);
  }, [fetchMessages, online]);

  // Realtime subscription per room.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !currentAreaId) return;

    const channel = supabase
      .channel(`area-messages-${currentAreaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `area_id=eq.${currentAreaId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = (payload.new || payload.old) as Record<string, unknown> | null;
          if (!row) return;
          const message: AreaChatMessage = {
            id: String(row.id ?? ""),
            clientId: (row.client_id as string | null) ?? null,
            body: row.deleted_at ? "" : String(row.body ?? ""),
            authorId: String(row.author_id ?? ""),
            authorHandle: String(row.author_handle ?? "Ghost"),
            createdAt: String(row.created_at ?? new Date().toISOString()),
            deleted: Boolean(row.deleted_at),
          };
          if (!message.id) return;
          seenIdsRef.current[scope].add(message.id);
          updateRoom(scope, (state) => ({
            ...state,
            messages: mergeIncoming(state.messages, message),
            pending: state.pending.filter((p) => p.clientId !== message.clientId),
          }));
          if (scopeRef.current === scope && stickToBottomRef.current) scrollToBottom(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentAreaId, scope, scrollToBottom, updateRoom]);

  // Presence heartbeat: only when opted in and online. Leaving a room removes
  // that room's presence row without changing the preference.
  useEffect(() => {
    let cancelled = false;

    async function sendHeartbeat() {
      if (!showPresence || !online || document.visibilityState !== "visible") return;
      try {
        await fetch("/api/area/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope }),
          keepalive: true,
        });
        if (!cancelled) lastPresenceRoomRef.current = scope;
      } catch {
        // Presence is best-effort and should not interrupt chat.
      }
    }

    async function leavePrevious(previous: string | null) {
      if (!previous || previous === scope) return;
      try {
        await fetch(`/api/area/presence?scope=${encodeURIComponent(previous)}`, {
          method: "DELETE",
          keepalive: true,
        });
      } catch {
        // Best-effort cleanup.
      }
    }

    void leavePrevious(lastPresenceRoomRef.current);
    void sendHeartbeat();
    const id = window.setInterval(() => void sendHeartbeat(), 60000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sendHeartbeat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      const leaving = scope;
      void fetch(`/api/area/presence?scope=${encodeURIComponent(leaving)}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [online, scope, showPresence]);

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function sendMessage(bodyOverride?: string, retryClientId?: string) {
    const body = (bodyOverride ?? draft).trim();
    if (!body) return;
    if (!online) {
      updateRoom(scope, (s) => ({ ...s, notice: "You are offline. Connect to send messages." }));
      return;
    }

    const clientId = retryClientId ?? crypto.randomUUID();
    const optimistic: PendingMessage = {
      clientId,
      body,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    if (!retryClientId) setDraft("");
    stickToBottomRef.current = true;
    updateRoom(scope, (state) => ({
      ...state,
      notice: null,
      rateLimitMessage: null,
      pending: [
        ...state.pending.filter((p) => p.clientId !== clientId),
        optimistic,
      ],
    }));
    scrollToBottom(true);

    try {
      const res = await fetch("/api/area/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, body, clientId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: AreaChatMessage;
        error?: string;
      };

      if (!res.ok) {
        const message = json.error || "Could not send your message.";
        updateRoom(scope, (state) => ({
          ...state,
          rateLimitMessage: res.status === 429 ? message : state.rateLimitMessage,
          pending: state.pending.map((p) =>
            p.clientId === clientId
              ? { ...p, status: "failed", error: message }
              : p,
          ),
        }));
        return;
      }

      if (json.message) {
        updateRoom(scope, (state) => mergeServerMessage(state, json.message as AreaChatMessage));
      } else {
        updateRoom(scope, (state) => ({
          ...state,
          pending: state.pending.filter((p) => p.clientId !== clientId),
        }));
        void fetchMessages(scope, null, "poll");
      }
    } catch {
      updateRoom(scope, (state) => ({
        ...state,
        pending: state.pending.map((p) =>
          p.clientId === clientId
            ? {
                ...p,
                status: "failed",
                error: "Could not send your message. Check your connection and try again.",
              }
            : p,
        ),
      }));
    }
  }

  async function toggleMute() {
    setBusyAction("mute");
    try {
      const method = room.muted ? "DELETE" : "POST";
      const res = await fetch("/api/area/mute", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        updateRoom(scope, (s) => ({
          ...s,
          notice: typeof json.error === "string" ? json.error : "Could not update mute setting.",
        }));
        return;
      }
      updateRoom(scope, (s) => ({ ...s, muted: !s.muted, notice: null }));
    } finally {
      setBusyAction(null);
    }
  }

  async function blockUser(authorId: string) {
    setBusyAction(`block:${authorId}`);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authorId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        updateRoom(scope, (s) => ({
          ...s,
          notice: typeof json.error === "string" ? json.error : "Could not block this person.",
        }));
        return;
      }
      setMenuFor(null);
      updateRoom(scope, (s) => ({
        ...s,
        notice: "Account blocked. Their messages are hidden from your rooms.",
        messages: s.messages.filter((m) => m.authorId !== authorId),
      }));
    } finally {
      setBusyAction(null);
    }
  }

  async function submitReport() {
    if (!reportTarget) return;
    setBusyAction("report");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          targetId: reportTarget.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        updateRoom(scope, (s) => ({
          ...s,
          notice: typeof json.error === "string" ? json.error : "Could not submit the report.",
        }));
        return;
      }
      setReportTarget(null);
      setReportDetails("");
      setReportReason("harassment");
      updateRoom(scope, (s) => ({ ...s, notice: "Report submitted." }));
    } finally {
      setBusyAction(null);
    }
  }

  const scopeTabs = useMemo(
    () =>
      AREA_SCOPES.map((value) => ({
        value,
        label: scopeLabel(value, localityName),
      })),
    [localityName],
  );

  const orderedMessages = room.messages;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <div role="tablist" aria-label="Area rooms" className="flex flex-1 gap-1">
          {scopeTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={scope === tab.value}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                scope === tab.value
                  ? "bg-[var(--yellow)] text-[#171921]"
                  : "border border-[var(--border)] text-[var(--text)]"
              }`}
              onClick={() => {
                setScope(tab.value);
                setMenuFor(null);
                stickToBottomRef.current = true;
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)] disabled:opacity-60"
          onClick={() => void toggleMute()}
          disabled={busyAction === "mute"}
          aria-pressed={room.muted}
        >
          {room.muted ? "Unmute room" : "Mute room"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <p aria-live="polite">{roomCountMessage(room.roomCount)}</p>
        {!showPresence ? (
          <p>
            Presence is off.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void onPresenceChange(true)}
            >
              Turn it on
            </button>{" "}
            to appear in room counts.
          </p>
        ) : null}
      </div>

      {!online ? (
        <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" role="status">
          You are offline. Messages cannot be sent until you reconnect.
        </p>
      ) : null}
      {room.notice ? (
        <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" role="status">
          {room.notice}
        </p>
      ) : null}
      {room.rateLimitMessage ? (
        <p className="mt-2 rounded-lg border border-[#5c3a3a] bg-[#2a1d1d] px-3 py-2 text-sm text-[#f3d6d6]" role="alert">
          {room.rateLimitMessage}
        </p>
      ) : null}
      {room.error ? (
        <div className="mt-2 rounded-lg border border-[#5c3a3a] bg-[#2a1d1d] px-3 py-2 text-sm text-[#f3d6d6]" role="alert">
          <p>{room.error}</p>
          <button
            type="button"
            className="mt-2 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)]"
            onClick={() => void fetchMessages(scope, null, "initial")}
          >
            Try again
          </button>
        </div>
      ) : null}

      {room.nextCursor ? (
        <button
          type="button"
          className="mt-2 self-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] disabled:opacity-60"
          onClick={() => void fetchMessages(scope, room.nextCursor, "older")}
          disabled={room.loadingOlder}
        >
          {room.loadingOlder ? "Loading older messages..." : "Load older messages"}
        </button>
      ) : null}

      <div
        ref={listRef}
        className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
        onScroll={onListScroll}
        aria-live="polite"
      >
        {room.loading && !room.loaded ? (
          <p className="text-sm text-[var(--text-muted)]">Loading messages...</p>
        ) : null}
        {!room.loading && room.loaded && orderedMessages.length === 0 && room.pending.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)]">
            <p>No messages in this room yet.</p>
            <p className="mt-1">Start the conversation for your area.</p>
          </div>
        ) : null}

        <ul className="space-y-3">
          {orderedMessages.map((message) => {
            const mine = viewerId != null && message.authorId === viewerId;
            return (
              <li key={message.id} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text)]">
                        {message.authorHandle || "Ghost"}
                      </span>
                      {mine ? " (you)" : ""} · {formatTime(message.createdAt)}
                    </p>
                    <p className={`mt-0.5 whitespace-pre-wrap break-words ${message.deleted ? "italic text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                      {message.deleted ? "Message removed." : message.body}
                    </p>
                  </div>
                  {!mine && !message.deleted ? (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]"
                        aria-label="Message actions"
                        onClick={() =>
                          setMenuFor((current) => (current === message.id ? null : message.id))
                        }
                      >
                        More
                      </button>
                      {menuFor === message.id ? (
                        <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-[var(--border)] bg-[var(--charcoal)] p-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--surface)]"
                            onClick={() => {
                              setReportTarget(message);
                              setMenuFor(null);
                            }}
                          >
                            Report message
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-60"
                            disabled={busyAction === `block:${message.authorId}`}
                            onClick={() => void blockUser(message.authorId)}
                          >
                            Block person
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}

          {room.pending.map((pending) => (
            <li key={pending.clientId} className="text-sm">
              <p className="text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)]">You</span> ·{" "}
                {pending.status === "sending" ? "Sending..." : "Not sent"}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[var(--text)]">
                {pending.body}
              </p>
              {pending.status === "failed" ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[#f3d6d6]" role="alert">
                    {pending.error || "Could not send this message."}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-[var(--text)]"
                    onClick={() => void sendMessage(pending.body, pending.clientId)}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {room.muted ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          This room is muted. Unmute it to send messages.
        </p>
      ) : (
        <form
          className="mt-2 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <label className="sr-only" htmlFor="area-chat-input">
            Message
          </label>
          <textarea
            id="area-chat-input"
            className="min-h-[44px] max-h-28 flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--charcoal)] px-3 py-2 text-sm text-[var(--text)]"
            placeholder="Write a message for this room"
            value={draft}
            maxLength={500}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            disabled={!online}
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--yellow)] px-4 py-2 text-sm font-semibold text-[#171921] disabled:opacity-60"
            disabled={!draft.trim() || !online}
          >
            Send
          </button>
        </form>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
        <button type="button" className="underline underline-offset-2" onClick={() => void onClearArea()}>
          Clear my area
        </button>
        <span>
          {showPresence ? "Presence is on for room counts." : "Presence is off."}
        </span>
      </div>

      {reportTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Report message"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--charcoal)] p-4">
            <h3 className="text-base font-semibold text-[var(--text)]">Report message</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Reports help keep area rooms safe. Only include details needed to review this message.
            </p>
            <label className="mt-3 block text-sm text-[var(--text)]">
              Reason
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="harassment">Harassment</option>
                <option value="hate">Hate</option>
                <option value="spam">Spam</option>
                <option value="personal-information">Personal information</option>
                <option value="violence">Violence</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="mt-3 block text-sm text-[var(--text)]">
              Details (optional)
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                rows={3}
                maxLength={500}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                onClick={() => setReportTarget(null)}
                disabled={busyAction === "report"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--yellow)] px-3 py-2 text-sm font-semibold text-[#171921] disabled:opacity-60"
                onClick={() => void submitReport()}
                disabled={busyAction === "report"}
              >
                {busyAction === "report" ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
