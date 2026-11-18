"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { processImage } from "@/lib/client-image";
import {
  AREA_SCOPES,
  roomCountMessage,
  scopeLabel,
  type AreaChatMessage,
  type AreaMessagesPage,
  type AreaScope,
} from "@/features/area/chat";
import { DefaultAvatar } from "@/components/ui/default-avatar";

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
  photoPreview?: string;
  hasPhoto?: boolean;
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
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; handle: string } | null>(null);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<Set<string>>(new Set());

  const markPhotoFailed = useCallback((url: string) => {
    setFailedPhotoUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }, []);

  const roomsRef = useRef(rooms);
  const scopeRef = useRef(scope);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoPreviewRef = useRef<string | null>(null);
  const pendingPhotoBlobsRef = useRef<Record<string, Blob>>({});
  const pendingPhotoUrlsRef = useRef<Record<string, string>>({});
  const photoPollRef = useRef<number | null>(null);
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

  const releasePendingPhoto = useCallback((clientId: string) => {
    delete pendingPhotoBlobsRef.current[clientId];
    const url = pendingPhotoUrlsRef.current[clientId];
    if (url) {
      URL.revokeObjectURL(url);
      delete pendingPhotoUrlsRef.current[clientId];
    }
  }, []);

  const clearAttachedPhoto = useCallback(() => {
    if (photoPreviewRef.current) {
      URL.revokeObjectURL(photoPreviewRef.current);
      photoPreviewRef.current = null;
    }
    setPhoto(null);
  }, []);

  // Hands the preview URL to the pending message so it stays valid for retry.
  const detachAttachedPhoto = useCallback(() => {
    photoPreviewRef.current = null;
    setPhoto(null);
  }, []);

  useEffect(() => {
    return () => {
      if (photoPollRef.current) window.clearTimeout(photoPollRef.current);
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
      Object.values(pendingPhotoUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      pendingPhotoBlobsRef.current = {};
      pendingPhotoUrlsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function selectPhoto(file: File | null) {
    if (!file) return;
    setComposerError(null);
    setPhotoBusy(true);
    try {
      const processed = await processImage(file, "chat");
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
      const preview = URL.createObjectURL(processed.blob);
      photoPreviewRef.current = preview;
      setPhoto({ blob: processed.blob, preview });
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : "Could not prepare that image. Try another one.",
      );
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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

  const schedulePhotoRefresh = useCallback(
    (targetScope: AreaScope) => {
      if (photoPollRef.current) window.clearTimeout(photoPollRef.current);
      photoPollRef.current = window.setTimeout(() => {
        photoPollRef.current = null;
        void fetchMessages(targetScope, null, "poll");
      }, 1500);
    },
    [fetchMessages],
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
            photoUrl: null,
            photoPending: Boolean(row.photo_path) && !row.deleted_at,
          };
          if (!message.id) return;
          seenIdsRef.current[scope].add(message.id);
          updateRoom(scope, (state) => ({
            ...state,
            messages: mergeIncoming(state.messages, message),
            pending: state.pending.filter((p) => p.clientId !== message.clientId),
          }));
          if (message.clientId) releasePendingPhoto(message.clientId);
          if (message.photoPending) schedulePhotoRefresh(scope);
          if (scopeRef.current === scope && stickToBottomRef.current) scrollToBottom(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentAreaId, releasePendingPhoto, schedulePhotoRefresh, scope, scrollToBottom, updateRoom]);

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
    const retryBlob = retryClientId ? pendingPhotoBlobsRef.current[retryClientId] : undefined;
    const retryPreview = retryClientId ? pendingPhotoUrlsRef.current[retryClientId] : undefined;
    const attached = retryClientId ? retryBlob ?? null : photo?.blob ?? null;
    const previewUrl = retryClientId ? retryPreview ?? null : photo?.preview ?? null;

    if (!body && !attached) return;
    if (!online) {
      updateRoom(scope, (s) => ({ ...s, notice: "You are offline. Connect to send messages." }));
      return;
    }

    const clientId = retryClientId ?? crypto.randomUUID();
    if (!retryClientId && attached && previewUrl) {
      pendingPhotoBlobsRef.current[clientId] = attached;
      pendingPhotoUrlsRef.current[clientId] = previewUrl;
    }
    const optimistic: PendingMessage = {
      clientId,
      body,
      createdAt: new Date().toISOString(),
      status: "sending",
      photoPreview: previewUrl ?? undefined,
      hasPhoto: Boolean(attached),
    };

    if (!retryClientId) {
      setDraft("");
      if (attached) detachAttachedPhoto();
      setComposerError(null);
    }
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
      let res: Response;
      if (attached) {
        const form = new FormData();
        form.append("scope", scope);
        form.append("body", body);
        form.append("clientId", clientId);
        form.append("photo", attached, "chat-photo.webp");
        res = await fetch("/api/area/messages", { method: "POST", body: form });
      } else {
        res = await fetch("/api/area/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, body, clientId }),
        });
      }
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
      releasePendingPhoto(clientId);
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
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] pb-2">
        <div
          role="tablist"
          aria-label="Area rooms"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar"
        >
          {scopeTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={scope === tab.value}
              className={`pill-tab flex-none ${scope === tab.value ? "pill-tab-active" : ""}`}
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
          className="btn btn-sm btn-tertiary flex-none"
          onClick={() => void toggleMute()}
          disabled={busyAction === "mute"}
          aria-pressed={room.muted}
        >
          {room.muted ? "Unmute room" : "Mute room"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] tracking-[0.3px] text-[var(--mute)]">
        <p aria-live="polite">{roomCountMessage(room.roomCount)}</p>
        {!showPresence ? (
          <p>
            Presence is off.{" "}
            <button
              type="button"
              className="text-[var(--body-text)] underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
              onClick={() => void onPresenceChange(true)}
            >
              Turn it on
            </button>{" "}
            to appear in room counts.
          </p>
        ) : null}
      </div>

      {!online ? (
        <p className="mt-2 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] text-[var(--body-text)]" role="status">
          You are offline. Messages cannot be sent until you reconnect.
        </p>
      ) : null}
      {room.notice ? (
        <p className="mt-2 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] text-[var(--body-text)]" role="status">
          {room.notice}
        </p>
      ) : null}
      {room.rateLimitMessage ? (
        <p className="mt-2 rounded-[var(--radius-md)] border border-[rgba(255,97,97,0.28)] bg-[var(--accent-red-soft)] px-3 py-2 text-[13px] text-[var(--accent-red)]" role="alert">
          {room.rateLimitMessage}
        </p>
      ) : null}
      {room.error ? (
        <div className="mt-2 rounded-[var(--radius-md)] border border-[rgba(255,97,97,0.28)] bg-[var(--accent-red-soft)] px-3 py-2 text-[13px] text-[var(--accent-red)]" role="alert">
          <p>{room.error}</p>
          <button
            type="button"
            className="btn btn-sm btn-tertiary mt-2"
            onClick={() => void fetchMessages(scope, null, "initial")}
          >
            Try again
          </button>
        </div>
      ) : null}

      {room.nextCursor ? (
        <button
          type="button"
          className="btn btn-sm btn-secondary mt-2 self-center text-[var(--mute)]"
          onClick={() => void fetchMessages(scope, room.nextCursor, "older")}
          disabled={room.loadingOlder}
        >
          {room.loadingOlder ? "Loading older messages..." : "Load older messages"}
        </button>
      ) : null}

      <div
        ref={listRef}
        className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3"
        onScroll={onListScroll}
        aria-live="polite"
      >
        {room.loading && !room.loaded ? (
          <p className="text-[13px] text-[var(--mute)]">Loading messages...</p>
        ) : null}
        {!room.loading && room.loaded && orderedMessages.length === 0 && room.pending.length === 0 ? (
          <div className="px-1 py-6 text-center text-[13px] text-[var(--mute)]">
            <p>No messages in this room yet.</p>
            <p className="mt-1">Start the conversation for your area.</p>
          </div>
        ) : null}

        <ul className="space-y-2.5">
          {orderedMessages.map((message) => {
            const mine = viewerId != null && message.authorId === viewerId;
            return (
              <li key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[86%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                    <DefaultAvatar
                      name={message.authorHandle || "Ghost"}
                      seed={message.authorId || message.authorHandle || "Ghost"}
                      size="xs"
                      className="h-5 w-5 text-[9px]"
                    />
                    <span className="font-medium text-[var(--mute)]">
                      {message.authorHandle || "Ghost"}
                    </span>
                    {mine ? <span>· you</span> : null}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatTime(message.createdAt)}</span>
                  </p>
                  <div className="flex items-start gap-1.5">
                    <div
                      className={`overflow-hidden rounded-[var(--radius-lg)] ${
                        mine
                          ? "bg-[var(--primary)] text-[var(--on-primary)]"
                          : "border border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--body-text)]"
                      } ${message.deleted ? "italic opacity-70" : ""}`}
                    >
                      {!message.deleted && (message.photoUrl || message.photoPending) ? (
                        message.photoUrl ? (
                          failedPhotoUrls.has(message.photoUrl) ? (
                            <div
                              className="flex h-32 w-48 items-center justify-center bg-[var(--surface-elevated)] px-2 text-center text-[12px] tracking-[0.2px] text-[var(--mute)]"
                              role="img"
                              aria-label={`Photo from ${message.authorHandle || "Ghost"} unavailable`}
                            >
                              Photo unavailable
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="block w-full cursor-zoom-in"
                              aria-label={`Open photo from ${message.authorHandle || "Ghost"} full size`}
                              onClick={() =>
                                setLightbox({
                                  url: message.photoUrl as string,
                                  handle: message.authorHandle || "Ghost",
                                })
                              }
                            >
                              <img
                                src={message.photoUrl}
                                alt={`Photo shared by ${message.authorHandle || "Ghost"}`}
                                className="block max-h-56 w-auto max-w-full object-cover"
                                loading="lazy"
                                onError={() => markPhotoFailed(message.photoUrl as string)}
                              />
                            </button>
                          )
                        ) : (
                          <div
                            className="flex h-32 w-48 items-center justify-center bg-[var(--surface-elevated)] text-[12px] tracking-[0.2px] text-[var(--mute)]"
                            role="status"
                            aria-label="Loading shared photo"
                          >
                            Loading photo...
                          </div>
                        )
                      ) : null}
                      {message.deleted ? (
                        <div className="whitespace-pre-wrap break-words px-3 py-2 text-[14px] leading-relaxed">
                          Message removed.
                        </div>
                      ) : message.body ? (
                        <div className="whitespace-pre-wrap break-words px-3 py-2 text-[14px] leading-relaxed">
                          {message.body}
                        </div>
                      ) : null}
                    </div>
                    {!mine && !message.deleted ? (
                      <div className="relative shrink-0 pt-1">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ash)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
                          aria-label="Message actions"
                          onClick={() =>
                            setMenuFor((current) => (current === message.id ? null : message.id))
                          }
                        >
                          <span aria-hidden="true" className="text-[15px] leading-none">···</span>
                        </button>
                        {menuFor === message.id ? (
                          <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface)] p-1">
                            <button
                              type="button"
                              className="block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--body-text)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink)]"
                              onClick={() => {
                                setReportTarget(message);
                                setMenuFor(null);
                              }}
                            >
                              Report message
                            </button>
                            <button
                              type="button"
                              className="block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--body-text)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink)] disabled:opacity-60"
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
                </div>
              </li>
            );
          })}

          {room.pending.map((pending) => (
            <li key={pending.clientId} className="flex justify-end">
              <div className="flex max-w-[86%] flex-col items-end">
                <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                  <DefaultAvatar name="You" seed="you" size="xs" className="h-5 w-5 text-[9px]" />
                  <span className="font-medium text-[var(--mute)]">You</span>
                  <span aria-hidden="true">·</span>
                  <span>{pending.status === "sending" ? "Sending..." : "Not sent"}</span>
                </p>
                <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--primary)] text-[var(--on-primary)] opacity-80">
                  {pending.photoPreview ? (
                    <img
                      src={pending.photoPreview}
                      alt="Your photo attachment"
                      className="block max-h-56 w-auto max-w-full object-cover"
                    />
                  ) : null}
                  {pending.body ? (
                    <div className="whitespace-pre-wrap break-words px-3 py-2 text-[14px] leading-relaxed">
                      {pending.body}
                    </div>
                  ) : null}
                </div>
                {pending.status === "failed" ? (
                  <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 text-[11px]">
                    <span className="text-[var(--accent-red)]" role="alert">
                      {pending.error || "Could not send this message."}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-tertiary"
                      onClick={() => void sendMessage(pending.body, pending.clientId)}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {room.muted ? (
        <p className="mt-2 text-[12px] tracking-[0.3px] text-[var(--mute)]">
          This room is muted. Unmute it to send messages.
        </p>
      ) : (
        <form
          className="mt-2 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          {photo || composerError ? (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              {photo ? (
                <>
                  <img
                    src={photo.preview}
                    alt="Photo ready to send"
                    className="h-12 w-12 flex-none rounded-[var(--radius-sm)] border border-[var(--hairline)] object-cover"
                  />
                  <span className="text-[12px] tracking-[0.2px] text-[var(--mute)]">Photo attached</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-tertiary ml-auto"
                    onClick={clearAttachedPhoto}
                  >
                    Remove
                  </button>
                </>
              ) : null}
              {composerError ? (
                <p className="text-[12px] text-[var(--accent-red)]" role="alert">
                  {composerError}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="area-chat-photo"
              onChange={(e) => void selectPhoto(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--mute)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={!online || photoBusy || Boolean(photo)}
              aria-label="Attach a photo"
              title="Attach a photo"
            >
              {photoBusy ? (
                <span className="text-[10px]">...</span>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                  <circle cx="12" cy="13.5" r="3.2" />
                </svg>
              )}
            </button>
            <label className="sr-only" htmlFor="area-chat-input">
              Message
            </label>
            <textarea
              id="area-chat-input"
              className="max-h-28 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)] focus:outline-none"
              placeholder="Write a message for this room"
              value={draft}
              maxLength={500}
              rows={1}
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
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)] disabled:cursor-not-allowed disabled:bg-[var(--surface-elevated)] disabled:text-[var(--ash)]"
              disabled={(!draft.trim() && !photo) || !online || photoBusy}
              aria-label="Send message"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </form>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] tracking-[0.3px] text-[var(--ash)]">
        <button
          type="button"
          className="underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
          onClick={() => void onClearArea()}
        >
          Clear my area
        </button>
        <span>
          {showPresence ? "Presence is on for room counts." : "Presence is off."}
        </span>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Photo full size"
          onClick={() => setLightbox(null)}
        >
          {failedPhotoUrls.has(lightbox.url) ? (
            <div
              className="flex h-[40dvh] w-[min(90vw,28rem)] max-h-[82dvh] items-center justify-center rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-4 text-center text-[13px] tracking-[0.2px] text-[var(--mute)]"
              role="img"
              aria-label={`Photo from ${lightbox.handle} unavailable`}
              onClick={(event) => event.stopPropagation()}
            >
              Photo unavailable
            </div>
          ) : (
            <img
              src={lightbox.url}
              alt={`Photo shared by ${lightbox.handle}`}
              className="max-h-[82dvh] w-auto max-w-full rounded-[var(--radius-lg)] object-contain"
              onClick={(event) => event.stopPropagation()}
              onError={() => markPhotoFailed(lightbox.url)}
            />
          )}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLightbox(null)}>
            Close
          </button>
        </div>
      ) : null}

      {reportTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report message"
        >
          <div className="w-full max-w-md rounded-t-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-[var(--radius-xl)]">
            <h3 className="text-h3">Report message</h3>
            <p className="mt-1 text-[13px] text-[var(--mute)]">
              Reports help keep area rooms safe. Only include details needed to review this message.
            </p>
            <label className="mt-3 block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
              Reason
              <select
                className="field mt-1"
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
            <label className="mt-3 block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
              Details (optional)
              <textarea
                className="field mt-1"
                rows={3}
                maxLength={500}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReportTarget(null)}
                disabled={busyAction === "report"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
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
