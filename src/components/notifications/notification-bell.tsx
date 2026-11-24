"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, BellRing, CheckCheck, MapPin, MessageSquare, ShieldCheck, X } from "lucide-react";

type Digest = {
  authRequired: boolean;
  replies: number;
  chatNew: number;
  chatRecent: number;
  chatBusy: boolean;
  localityName: string | null;
  serverTime: string | null;
};

const EMPTY_DIGEST: Digest = {
  authRequired: false,
  replies: 0,
  chatNew: 0,
  chatRecent: 0,
  chatBusy: false,
  localityName: null,
  serverTime: null,
};

const ENABLED_KEY = "civiccircle-notify-enabled";
const SEEN_KEY = "civiccircle-notify-seen";
const POLL_MS = 60000;

export function NotificationBell({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [digest, setDigest] = useState<Digest>(EMPTY_DIGEST);
  const [unseen, setUnseen] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);

  const openRef = useRef(false);
  const lastSeenRef = useRef<string | null>(null);
  const serverTimeRef = useRef<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches,
  );
  const [desktopPos, setDesktopPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSupported(typeof window !== "undefined" && "Notification" in window);
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermission(Notification.permission);
      }
      try {
        setEnabled(window.localStorage.getItem(ENABLED_KEY) === "1");
        lastSeenRef.current = window.localStorage.getItem(SEEN_KEY);
      } catch {
        // Storage can be unavailable in private modes.
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const placePanel = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(336, window.innerWidth - 24);
    // Keep the desktop dropdown inside the viewport even though the bell is
    // not the rightmost header control.
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    setDesktopPos({ top: rect.bottom + 8, left });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const syncViewport = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      // Re-anchor when growing to desktop while the panel is open.
      if (desktop && openRef.current) placePanel();
    };
    mq.addEventListener("change", syncViewport);
    return () => mq.removeEventListener("change", syncViewport);
  }, [placePanel]);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onReflow = () => placePanel();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, isDesktop, placePanel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchDigest = useCallback(
    async (options?: { notify?: boolean }) => {
      if (!hydrated) return;
      setFetching(true);
      try {
        const since =
          lastSeenRef.current ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`/api/notifications?since=${encodeURIComponent(since)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Could not check activity.");
        const json = (await res.json()) as {
          authRequired?: boolean;
          replies?: { new?: number };
          chat?: { new?: number; recent?: number; busy?: boolean; localityName?: string | null };
          serverTime?: string;
        };

        const next: Digest = {
          authRequired: Boolean(json.authRequired),
          replies: json.replies?.new ?? 0,
          chatNew: json.chat?.new ?? 0,
          chatRecent: json.chat?.recent ?? 0,
          chatBusy: Boolean(json.chat?.busy),
          localityName: json.chat?.localityName ?? null,
          serverTime: json.serverTime ?? null,
        };
        setDigest(next);
        serverTimeRef.current = next.serverTime;
        setStatus(next.authRequired ? "Alerts need an active session. Reload the page and try again." : null);

        const totalNew = next.replies + next.chatNew;
        if (!openRef.current) setUnseen(totalNew);

        if (
          options?.notify &&
          totalNew > 0 &&
          typeof document !== "undefined" &&
          document.visibilityState === "hidden" &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          const parts: string[] = [];
          if (next.replies > 0) {
            parts.push(`${next.replies} new ${next.replies === 1 ? "reply" : "replies"} on your posts`);
          }
          if (next.chatNew > 0) {
            parts.push(`${next.chatNew} new area chat ${next.chatNew === 1 ? "message" : "messages"}`);
          }
          try {
            new Notification("CivicCircle", {
              body: parts.join(". "),
              icon: "/icons/icon-192.png",
              tag: "civiccircle-activity",
            });
            // Avoid re-alerting the same activity on the next poll.
            const stamp = next.serverTime;
            if (stamp) {
              lastSeenRef.current = stamp;
              try {
                window.localStorage.setItem(SEEN_KEY, stamp);
              } catch {
                // Storage can be unavailable in private modes.
              }
            }
          } catch {
            // Some browsers block page-created notifications.
          }
        }
      } catch {
        setStatus("Could not check activity right now. We will try again shortly.");
      } finally {
        setFetching(false);
      }
    },
    [hydrated],
  );

  useEffect(() => {
    if (!enabled || !hydrated) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) void fetchDigest({ notify: true });
    };
    const initial = window.setTimeout(run, 0);
    const interval = window.setInterval(run, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, hydrated, fetchDigest]);

  function rememberSeen() {
    const stamp = serverTimeRef.current ?? new Date().toISOString();
    lastSeenRef.current = stamp;
    try {
      window.localStorage.setItem(SEEN_KEY, stamp);
    } catch {
      // Storage can be unavailable in private modes.
    }
    setUnseen(0);
  }

  function openPanel() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      placePanel();
    }
    setOpen(true);
    setStatus(null);
    if (enabled) void fetchDigest();
  }

  function closePanel() {
    setOpen(false);
    rememberSeen();
  }

  async function enableNotifications() {
    setBusy(true);
    setStatus(null);
    try {
      if (!("Notification" in window)) {
        setSupported(false);
        setStatus("This browser does not support notifications.");
        return;
      }
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setStatus("Notifications are blocked. You can allow them in your browser settings.");
        return;
      }
      setEnabled(true);
      try {
        window.localStorage.setItem(ENABLED_KEY, "1");
        window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
      } catch {
        // Storage can be unavailable in private modes.
      }
      lastSeenRef.current = new Date().toISOString();
      setUnseen(0);
      await fetchDigest();
    } catch {
      setStatus("Could not turn on notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function disableNotifications() {
    setEnabled(false);
    setDigest(EMPTY_DIGEST);
    setUnseen(0);
    setStatus(null);
    try {
      window.localStorage.setItem(ENABLED_KEY, "0");
    } catch {
      // Storage can be unavailable in private modes.
    }
  }

  const totalNew = digest.replies + digest.chatNew;
  const badge = open ? 0 : unseen;
  const BellIcon = enabled ? BellRing : Bell;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={enabled ? `Notifications, ${badge} new` : "Notification settings"}
        aria-expanded={open}
        onClick={() => (open ? closePanel() : openPanel())}
        className={`relative btn btn-icon btn-secondary ${
          enabled ? "text-[var(--accent-green)]" : "text-[var(--mute)]"
        } ${className}`}
      >
        <BellIcon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
        {badge > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-[var(--accent-red)] px-1 text-[12px] font-semibold leading-[18px] text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined" && (!isDesktop || desktopPos)
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-[55] cursor-default bg-black/40 backdrop-blur-[2px] sm:bg-black/20"
                onClick={closePanel}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                style={
                  isDesktop && desktopPos
                    ? { top: desktopPos.top, left: desktopPos.left }
                    : undefined
                }
                className="fixed inset-x-4 bottom-4 z-[60] max-h-[85dvh] overflow-y-auto overscroll-contain rounded-[22px] border border-white/12 bg-[rgba(18,18,20,0.97)] px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:inset-x-auto sm:bottom-auto sm:max-h-[min(80dvh,calc(100dvh-96px))] sm:w-[21rem] sm:rounded-[22px] sm:p-3.5 sm:pb-3.5 sm:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              >
                <span
                  className="mx-auto mb-2 block h-1 w-10 rounded-full bg-white/20 sm:hidden"
                  aria-hidden="true"
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--accent-green-soft)] text-[var(--accent-green)]">
                      <BellRing className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white">Notifications</p>
                      <p className="break-words text-[11px] leading-snug text-white/55">
                        {enabled ? (fetching ? "Checking activity..." : "Lightweight activity alerts") : "Opt in any time"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                    onClick={closePanel}
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 p-3">
                  <div className="min-w-0">
                    <p className="break-words text-[13px] font-medium text-white">Alerts on this device</p>
                    <p className="mt-0.5 break-words text-[11px] leading-relaxed text-white/55">
                      Replies and area chat spikes. No message contents.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={enabled ? "Turn off notifications" : "Turn on notifications"}
                    disabled={!hydrated || busy}
                    onClick={() => (enabled ? disableNotifications() : void enableNotifications())}
                    className={`relative h-6 w-11 flex-none rounded-full border transition-colors ${
                      enabled ? "border-[var(--accent-green)]/50 bg-[var(--accent-green)]/35" : "border-white/15 bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        enabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {!hydrated ? (
                  <p className="mt-3 break-words text-[12px] text-white/55">Loading preferences...</p>
                ) : !supported ? (
                  <p className="mt-3 break-words text-[12px] leading-relaxed text-white/60">
                    This browser does not support notifications. You can still check activity on Home and Nearby.
                  </p>
                ) : !enabled ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      className="btn btn-primary min-h-[42px] w-full justify-center rounded-xl"
                      disabled={busy}
                      onClick={() => void enableNotifications()}
                    >
                      {busy ? "Turning on..." : "Turn on alerts"}
                    </button>
                    {permission === "denied" ? (
                      <p className="break-words text-[11px] leading-relaxed text-[var(--accent-yellow)]">
                        Notifications are blocked. Allow them in your browser settings, then try again.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    <ActivityRow
                      icon={<MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      label="Replies to your posts"
                      count={digest.replies}
                    />
                    <ActivityRow
                      icon={<MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      label={
                        digest.chatBusy
                          ? `Area chat is busy${digest.localityName ? ` in ${digest.localityName}` : ""}`
                          : "Area chat"
                      }
                      count={digest.chatNew}
                      detail={digest.chatRecent > 0 ? `${digest.chatRecent} messages in the last 30 minutes` : undefined}
                    />

                    {totalNew > 0 ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-tertiary mt-2 w-full justify-center"
                        onClick={() => {
                          rememberSeen();
                          setStatus("Marked as seen.");
                        }}
                      >
                        <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Mark all seen
                      </button>
                    ) : (
                      <p className="break-words pt-1 text-center text-[12px] text-white/55">You are all caught up.</p>
                    )}
                  </div>
                )}

                {status ? (
                  <p className="mt-2 break-words text-[11px] leading-relaxed text-[var(--accent-yellow)]" role="status">
                    {status}
                  </p>
                ) : null}

                <p className="mt-3 flex items-start gap-1.5 break-words border-t border-white/8 pt-2.5 text-[12px] leading-relaxed text-white/45">
                  <ShieldCheck className="mt-0.5 h-3 w-3 flex-none" strokeWidth={1.8} aria-hidden="true" />
                  Alerts stay on this device and only work while CivicCircle is open. No accounts, no exact location, no message contents.
                </p>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function ActivityRow({
  icon,
  label,
  count,
  detail,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-1.5 py-2">
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/8 text-white/70">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-white/85">{label}</p>
        {detail ? <p className="mt-0.5 text-[12px] text-white/45">{detail}</p> : null}
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
          count > 0 ? "bg-[var(--accent-green-soft)] text-[var(--accent-green)]" : "bg-white/6 text-white/40"
        }`}
      >
        {count}
      </span>
    </div>
  );
}
