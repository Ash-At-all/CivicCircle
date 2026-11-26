"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, RotateCcw, SlidersHorizontal, Store, MessageCircle, X, ChevronDown } from "lucide-react";
import { AreaConsent, PresenceOptIn } from "@/components/area/area-consent";
import { AreaPicker } from "@/components/area/area-picker";
import { AreaChat } from "@/components/area/area-chat";
import { ShopsList } from "@/components/shops/ShopsList";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { HighlightsStrip, type HighlightItem } from "@/components/highlights/highlights-strip";
import type { MapLanguage } from "@/components/map/NearbyMap";
import {
  RADIUS_STEPS_M,
  choosePeopleRadius,
  chooseShopRadius,
  formatRadiusLabel,
  peopleMessage,
  shopRadiusMessage,
} from "@/features/area/radius";
import type { HighlightsResponse } from "@/features/highlights/types";
import type { NearbyResponse } from "@/features/shops/types";
import { findCityForCoords } from "@/features/area/cities";

const NearbyMap = dynamic(() => import("@/components/map/NearbyMap").then((m) => m.NearbyMap), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full animate-pulse bg-[var(--surface)]"
      aria-label="Loading map"
      role="status"
    />
  ),
});

type Mode = "consent" | "pick";
type SheetSnap = "peek" | "mid" | "full";

const SNAP_HEIGHTS: Record<SheetSnap, number> = {
  peek: 22,
  mid: 52,
  full: 90,
};

const NEARBY_PREF_KEYS = {
  radius: "civiccircle-nearby-radius",
  language: "civiccircle-nearby-lang",
  tab: "civiccircle-nearby-tab",
  snap: "civiccircle-nearby-snap",
} as const;

function readStoredRadius(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NEARBY_PREF_KEYS.radius);
    const value = raw ? Number(raw) : NaN;
    return RADIUS_STEPS_M.includes(value as (typeof RADIUS_STEPS_M)[number]) ? value : null;
  } catch {
    return null;
  }
}

function nearestSnap(height: number): SheetSnap {
  const entries = (Object.entries(SNAP_HEIGHTS) as [SheetSnap, number][]).sort(
    (a, b) => Math.abs(a[1] - height) - Math.abs(b[1] - height),
  );
  return entries[0][0];
}

const SNAP_ORDER: readonly SheetSnap[] = ["peek", "mid", "full"];
const FAST_SWIPE_VELOCITY_PX_PER_MS = 0.08;
const AREA_RESOLVE_STEPS = [
  "Setting up your area...",
  "Finding your locality...",
  "Loading nearby places...",
  "Almost there...",
] as const;

function resolveSheetSnap(finalHeight: number, velocityPxPerMs: number, currentSnap: SheetSnap): SheetSnap {
  const fast = Math.abs(velocityPxPerMs) >= FAST_SWIPE_VELOCITY_PX_PER_MS;
  const snapped = nearestSnap(finalHeight);
  if (!fast) return snapped;
  const currentIndex = SNAP_ORDER.indexOf(currentSnap);
  const nextIndex =
    velocityPxPerMs > 0 ? Math.min(currentIndex + 1, SNAP_ORDER.length - 1) : Math.max(currentIndex - 1, 0);
  return SNAP_ORDER[nextIndex];
}

export default function NearbyPage() {
  const [data, setData] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isResolvingArea, setIsResolvingArea] = useState(false);
  const [areaProgressStep, setAreaProgressStep] = useState(-1);
  const areaProgressTimers = useRef<number[]>([]);
  const [mode, setMode] = useState<Mode>("consent");
  const [selectedRadius, setSelectedRadius] = useState<number | null>(1000);
  const [language, setLanguage] = useState<MapLanguage>("en");
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [shopReviewSignal, setShopReviewSignal] = useState(0);
  const [tab, setTab] = useState<"shops" | "chat">("shops");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRadiusPrompt, setShowRadiusPrompt] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [activity, setActivity] = useState<HighlightsResponse | null>(null);
  const dragRef = useRef<{
    startY: number;
    startHeight: number;
    pointerId: number;
    moved: boolean;
    velocityPxPerMs: number;
    lastMoveTs: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const effectiveSnap: SheetSnap = tab === "chat" && snap === "peek" ? "mid" : snap;
  const handleSheetActive = useCallback(() => {
    setSnap("full");
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const storedRadius = readStoredRadius();
        if (storedRadius != null) setSelectedRadius(storedRadius);

        const storedLang = window.localStorage.getItem(NEARBY_PREF_KEYS.language);
        if (storedLang === "en" || storedLang === "hi") setLanguage(storedLang);

        const storedTab = window.localStorage.getItem(NEARBY_PREF_KEYS.tab);
        if (storedTab === "shops" || storedTab === "chat") setTab(storedTab);

        const storedSnap = window.localStorage.getItem(NEARBY_PREF_KEYS.snap);
        if (storedSnap === "peek" || storedSnap === "mid" || storedSnap === "full") setSnap(storedSnap);
      } catch {
        // ignore storage errors
      }
      setPrefsHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(NEARBY_PREF_KEYS.radius, String(selectedRadius ?? 1000));
    } catch {}
  }, [selectedRadius, prefsHydrated]);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(NEARBY_PREF_KEYS.language, language);
    } catch {}
  }, [language, prefsHydrated]);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(NEARBY_PREF_KEYS.tab, tab);
    } catch {}
  }, [tab, prefsHydrated]);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(NEARBY_PREF_KEYS.snap, snap);
    } catch {}
  }, [snap, prefsHydrated]);

  const loadNearby = useCallback(async () => {
    const res = await fetch("/api/area/nearby");
    if (!res.ok) {
      setData(null);
      setSelectedRadius((prev) => prev ?? readStoredRadius() ?? 1000);
      return null;
    }
    const json = (await res.json()) as NearbyResponse;
    setData(json);
    setSelectedRadius((prev) => prev ?? readStoredRadius() ?? 1000);
    return json;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/area/nearby");
        if (!active) return;
        if (res.ok) {
          const json = (await res.json()) as NearbyResponse;
          setData(json);
          setSelectedRadius((prev) => prev ?? readStoredRadius() ?? 1000);
        } else {
          setData(null);
          setSelectedRadius((prev) => prev ?? readStoredRadius() ?? 1000);
        }
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/highlights")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json) setActivity(json as HighlightsResponse);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const shopResult = useMemo(() => {
    if (!data) return null;
    return chooseShopRadius(data.shops);
  }, [data]);

  const effectiveRadius = selectedRadius ?? 1000;

  const displayedShops = useMemo(() => {
    if (!data) return [];
    return [...data.shops]
      .filter((s) => s.distance_m <= effectiveRadius)
      .sort((a, b) => a.distance_m - b.distance_m);
  }, [data, effectiveRadius]);

  const peopleChoice = useMemo(() => {
    if (!data) return null;
    return choosePeopleRadius(data.people || []);
  }, [data]);

  const nearbyHighlights = useMemo<HighlightItem[]>(() => {
    const items: HighlightItem[] = [];

    if (displayedShops.length > 0) {
      items.push({
        id: "places",
        title: `${displayedShops.length} ${displayedShops.length === 1 ? "place" : "places"} nearby`,
        detail: `Within ${formatRadiusLabel(effectiveRadius)} of your area centre`,
        icon: "store",
        accent: "blue",
        href: undefined,
      });
    }

    if (activity?.chat.busy) {
      items.push({
        id: "chat",
        title: `Chat is live${data?.localityName ? ` in ${data.localityName}` : " nearby"}`,
        detail: `${activity.chat.recent} messages in the last 30 minutes`,
        icon: "chat",
        accent: "green",
      });
    }

    if (activity?.posts.topTag) {
      items.push({
        id: "tag",
        title: `#${activity.posts.topTag.tag} is trending`,
        detail: `${activity.posts.topTag.count} recent ${activity.posts.topTag.count === 1 ? "post" : "posts"} citywide`,
        icon: "trend",
        accent: "yellow",
      });
    }

    return items;
  }, [displayedShops, effectiveRadius, activity, data]);

  function clearAreaProgress() {
    for (const t of areaProgressTimers.current) window.clearTimeout(t);
    areaProgressTimers.current = [];
  }

  function runAreaProgress() {
    clearAreaProgress();
    AREA_RESOLVE_STEPS.forEach((_, i) => {
      areaProgressTimers.current.push(window.setTimeout(() => setAreaProgressStep(i), 900 * i));
    });
  }

  function finishAreaProgress() {
    clearAreaProgress();
    setAreaProgressStep(-1);
    setIsResolvingArea(false);
  }

  async function resolveFromCoords(lat: number, lng: number, citySlug: string) {
    const h3 = await import("h3-js");
    const h3r8 = h3.latLngToCell(lat, lng, 8);
    const h3r7 = h3.cellToParent(h3r8, 7);
    const res = await fetch("/api/area/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ h3r8, h3r7, city: citySlug }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not set your area.");
    await loadNearby();
  }

  async function locateFromGeolocation() {
    setBusy(true);
    setIsResolvingArea(true);
    setError(null);
    try {
      if (!("geolocation" in navigator)) throw new Error("Location is not available in this browser.");
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        }),
      );
      const city = findCityForCoords(position.coords.latitude, position.coords.longitude);
      if (!city) {
        throw new Error("CivicCircle is not available in this city yet.");
      }
      await resolveFromCoords(position.coords.latitude, position.coords.longitude, city.slug);
      setShowRadiusPrompt(true);
    } catch (e) {
      const message =
        e instanceof GeolocationPositionError
          ? "Could not access your location. You can choose an area manually."
          : e instanceof Error
            ? e.message
            : "Could not set your area.";
      setError(message);
    } finally {
      setBusy(false);
      finishAreaProgress();
    }
  }

  function handleNearbyLocate() {
    void locateFromGeolocation();
  }

  async function clearArea() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/area/location", { method: "DELETE" });
      setData(null);
      setSelectedRadius(1000);
      setSelectedShopId(null);
      setShowRadiusPrompt(false);
      setSettingsOpen(false);
      setMode("consent");
    } catch {
      setError("Could not clear your area.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePresence(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/area/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showPresence: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not update presence preference.");
      setData((prev) => (prev ? { ...prev, showPresence: next } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update presence preference.");
    } finally {
      setBusy(false);
    }
  }

  function selectShopFromMap(id: string) {
    setSelectedShopId(id);
    setShopReviewSignal((n) => n + 1);
    setTab("shops");
    setSnap("mid");
    window.setTimeout(() => {
      document.getElementById(`shop-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`shop-${id}`)?.focus({ preventScroll: true });
    }, 120);
  }

  function onTabChange(next: "shops" | "chat") {
    setTab(next);
    if (next === "chat") setSnap("full");
    else if (snap === "peek") setSnap("mid");
  }

  function beginSheetDrag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[role="tablist"]')) return;
    const currentHeight = dragHeight ?? SNAP_HEIGHTS[effectiveSnap];
    dragRef.current = {
      startY: e.clientY,
      startHeight: currentHeight,
      pointerId: e.pointerId,
      moved: false,
      velocityPxPerMs: 0,
      lastMoveTs: 0,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    suppressClickRef.current = false;
  }

  function moveSheetDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaPx = drag.startY - e.clientY;
    if (!drag.moved && Math.abs(deltaPx) < 6) return;
    drag.moved = true;
    const now = e.timeStamp;
    const deltaMs = now - drag.lastMoveTs;
    if (deltaMs > 0) drag.velocityPxPerMs = deltaPx / deltaMs;
    drag.lastMoveTs = now;
    const deltaVh = (deltaPx / window.innerHeight) * 100;
    const next = Math.max(16, Math.min(94, drag.startHeight + deltaVh));
    setDragHeight(next);
  }

  function endSheetDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) {
      setDragHeight(null);
      return;
    }
    // Compute from the drag ref, not from render-scoped state, so a stale
    // render cannot resolve the snap from an old height.
    const finalHeight = Math.max(16, Math.min(94, drag.startHeight + ((drag.startY - e.clientY) / window.innerHeight) * 100));
    setDragHeight(null);
    const nextSnap = resolveSheetSnap(finalHeight, drag.velocityPxPerMs, effectiveSnap);
    setSnap(tab === "chat" && nextSnap === "peek" ? "mid" : nextSnap);
    // A swipe that moved should not also fire a click on the grabber toggle.
    suppressClickRef.current = true;
  }

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--canvas)] p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface)]">
            <MapPin className="h-6 w-6 text-[var(--mute)]" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-[var(--ink)]">Loading area…</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--canvas)]">
        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),16px)]">
          <header className="flex items-center gap-3 py-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface)]">
              <MapPin className="h-5 w-5 text-[var(--ink)]" strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-[15px] font-medium text-[var(--ink)]">Nearby</h1>
              <p className="text-[12px] text-[var(--mute)]">Maharashtra</p>
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center py-6">
            <div className="mb-5">
              <p className="dateline mb-3">
                <span className="dateline-mark" aria-hidden="true" />
                Around you
              </p>
              <h2 className="max-w-[16ch] text-balance font-display text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.06] text-[var(--ink)]">
                Shops, chat, and reviews nearby
              </h2>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--body-text)]">
                Set an approximate area. Your exact location isn&apos;t stored.
              </p>
            </div>

            {mode === "consent" ? (
              <AreaConsent
                onUseLocation={locateFromGeolocation}
                onChooseManually={() => setMode("pick")}
                busy={busy}
                error={error}
              />
            ) : (
              <AreaPicker
                onCancel={() => setMode("consent")}
                onPick={async (result) => {
                  setBusy(true);
                  setIsResolvingArea(true);
                  setError(null);
                  runAreaProgress();
                  try {
                    await resolveFromCoords(result.lat, result.lng, result.city);
                    setMode("consent");
                    setShowRadiusPrompt(true);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not set your area.");
                  } finally {
                    setBusy(false);
                    finishAreaProgress();
                  }
                }}
              />
            )}
          </div>
        </div>
      </main>
    );
  }

  const sheetHeight = dragHeight ?? SNAP_HEIGHTS[effectiveSnap];
  const isPeek = effectiveSnap === "peek" && !dragHeight;

  const peekSummary =
    tab === "shops"
      ? `${displayedShops.length} ${displayedShops.length === 1 ? "place" : "places"} within ${formatRadiusLabel(effectiveRadius)}`
      : `Chat in ${data.localityName || "your area"}`;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--canvas)]">
      <div className="nearby-map absolute inset-0">
        <NearbyMap
          centroid={data.centroid}
          citySlug={data.citySlug}
          radiusM={effectiveRadius}
          shops={displayedShops}
          language={language}
          onSelectShop={selectShopFromMap}
          onLocate={handleNearbyLocate}
          onMapStatusChange={(status) => setIsMapLoading(status !== "ready")}
        />

        {isResolvingArea ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/40"
            role="status"
            aria-live="polite"
          >
            <div className="w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)]">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--hairline-strong)] border-t-[var(--accent-ember)]" />
              </span>
              <p className="mt-2.5 text-[13px] font-medium text-[var(--ink)]">{AREA_RESOLVE_STEPS[areaProgressStep] ?? "Setting up your area..."}</p>
            </div>
          </div>
        ) : null}

        {isMapLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--canvas)]" role="status" aria-label="Loading map tiles">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--hairline)] border-t-[var(--accent-ember)]" />
          </div>
        ) : null}
      </div>

      {/* Floating top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 via-black/20 to-transparent px-3 pb-16 pt-[max(env(safe-area-inset-top),12px)]">
        <button
          type="button"
          className="pointer-events-auto flex min-w-0 max-w-[68%] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-1.5 pr-3 text-left transition-transform active:scale-[0.99]"
          onClick={() => setSnap((s) => (s === "peek" ? "mid" : s))}
          aria-label={`Area ${data.localityName || "Your area"}. ${displayedShops.length} places nearby. Tap to show details.`}
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--ink)]">
            <MapPin className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-[var(--ink)]">
              {data.localityName || "Your area"}
            </span>
            <span className="block truncate text-[12px] text-[var(--mute)]">
              {data.cityName} · {displayedShops.length} places nearby
            </span>
          </span>
        </button>

        <div className="pointer-events-auto relative flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] transition-colors ${settingsOpen ? "bg-[var(--surface-elevated)]" : "hover:bg-[var(--surface-elevated)]"}`}
            aria-label={settingsOpen ? "Close map settings" : "Map and area settings"}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
          </button>

          {settingsOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[min(19rem,calc(100vw-1.5rem))] rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-[13px] font-medium text-[var(--ink)]">Map settings</p>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--mute)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--ink)]"
                  aria-label="Close settings"
                  onClick={() => setSettingsOpen(false)}
                >
                  <X className="h-4 w-4" strokeWidth={1.9} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-2.5">
                  <p className="mb-2 text-[12px] font-medium text-[var(--mute)]">Map labels</p>
                  <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] bg-[var(--surface)] p-1" role="group" aria-label="Map label language">
                    <button
                      type="button"
                      className={`min-h-[38px] rounded-[var(--radius-sm)] px-3 text-[13px] font-medium transition-colors ${language === "en" ? "bg-[var(--surface-card)] text-[var(--ink)]" : "text-[var(--mute)]"}`}
                      aria-pressed={language === "en"}
                      onClick={() => setLanguage("en")}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      className={`min-h-[38px] rounded-[var(--radius-sm)] px-3 text-[13px] font-medium transition-colors ${language === "hi" ? "bg-[var(--surface-card)] text-[var(--ink)]" : "text-[var(--mute)]"}`}
                      aria-pressed={language === "hi"}
                      onClick={() => setLanguage("hi")}
                    >
                      हिंदी
                    </button>
                  </div>
                </div>

                <label className="block rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-2.5">
                  <span className="mb-2 block text-[12px] font-medium text-[var(--mute)]">Search radius</span>
                  <select
                    className="field min-h-[42px] w-full text-[14px] text-[var(--ink)]"
                    value={effectiveRadius}
                    onChange={(e) => setSelectedRadius(Number(e.target.value))}
                  >
                    {RADIUS_STEPS_M.map((r) => (
                      <option key={r} value={r} className="bg-[var(--surface-elevated)] text-[var(--ink)]">
                        {formatRadiusLabel(r)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-2.5">
                  <PresenceOptIn
                    checked={Boolean(data.showPresence)}
                    onChange={(next) => void togglePresence(next)}
                    disabled={busy}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn btn-tertiary min-h-[42px] justify-center text-[13px]"
                    onClick={() => {
                      setSettingsOpen(false);
                      setData(null);
                      setSelectedRadius(1000);
                      setSelectedShopId(null);
                      setShowRadiusPrompt(false);
                      setSnap("peek");
                      setMode("consent");
                    }}
                  >
                    Change area
                  </button>
                  <button
                    type="button"
                    className="btn btn-tertiary min-h-[42px] justify-center text-[13px] text-[var(--accent-red)]"
                    onClick={() => {
                      setSettingsOpen(false);
                      void clearArea();
                    }}
                    disabled={busy}
                  >
                    <RotateCcw className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                    Clear
                  </button>
                </div>

                {error ? (
                  <p className="px-1 text-[12px] text-[var(--accent-red)]" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {settingsOpen ? (
        <button
          type="button"
          aria-label="Close settings"
          className="absolute inset-0 z-[15] cursor-default bg-transparent"
          onClick={() => setSettingsOpen(false)}
        />
      ) : null}

      <section
        id="nearby-sheet"
        aria-label="Nearby area"
        className="absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-3xl flex-col rounded-t-[var(--radius-2xl)] border border-b-0 border-[var(--hairline)] bg-[var(--surface)]"
        style={{
          height: `${sheetHeight}dvh`,
          transition: dragHeight != null ? "none" : "height 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="touch-none select-none px-4 pb-1 pt-2"
          onPointerDown={beginSheetDrag}
          onPointerMove={moveSheetDrag}
          onPointerUp={endSheetDrag}
          onPointerCancel={endSheetDrag}
        >
          <button
            type="button"
            className="mx-auto flex h-7 w-full items-center justify-center"
            aria-expanded={!isPeek}
            aria-controls="nearby-sheet-content"
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              setSnap((s) => {
                if (s === "peek") return "mid";
                if (s === "mid") return tab === "chat" ? "full" : "full";
                return "mid";
              });
            }}
          >
            <span className="h-1.5 w-12 rounded-full bg-[var(--hairline-strong)]" aria-hidden="true" />
            <span className="sr-only">{isPeek ? "Expand panel" : "Change panel size"}</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-1 pb-2 pt-1 text-left"
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              setSnap((s) => (s === "peek" ? "mid" : s));
            }}
          >
            <span className="min-w-0">
              <span className="block truncate font-display text-[21px] leading-tight text-[var(--ink)]">
                {tab === "shops" ? "Nearby places" : "Area chat"}
              </span>
              <span className="block truncate text-[12px] text-[var(--mute)]">{peekSummary}</span>
            </span>
            <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] text-[var(--mute)] transition-transform ${isPeek ? "" : "rotate-180"}`}>
              <ChevronDown className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
            </span>
          </button>

          <div
            role="tablist"
            aria-label="Nearby sections"
            className="grid grid-cols-2 gap-1.5 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shops"}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[13px] font-medium transition-colors ${tab === "shops" ? "bg-[var(--surface-card)] text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--ink)]"}`}
              onClick={() => onTabChange("shops")}
            >
              <Store className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              Shops
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "chat"}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[13px] font-medium transition-colors ${tab === "chat" ? "bg-[var(--surface-card)] text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--ink)]"}`}
              onClick={() => onTabChange("chat")}
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              Chat
            </button>
          </div>
        </div>

        <div
          id="nearby-sheet-content"
          className={`flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            isPeek ? "overflow-hidden" : tab === "chat" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {isPeek ? (
            <div className="pt-2">
              <p className="text-[13px] text-[var(--mute)]">
                {tab === "shops"
                  ? "Swipe up to browse places and details."
                  : "Open chat to talk with people in this area."}
              </p>
            </div>
          ) : tab === "shops" && !isResolvingArea ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[12px] text-[var(--body-text)]">
                  {shopResult ? shopRadiusMessage(shopResult) : "Loading shops..."}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-strong)]"
                  onClick={() => setSettingsOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                  Radius &amp; area
                </button>
              </div>
              <p className="mt-2 text-[12px] tracking-[0.2px] text-[var(--mute)]">
                {peopleChoice ? peopleMessage(peopleChoice, Boolean(data.showPresence)) : "Checking nearby activity..."}
              </p>

              <div className="mt-4">
                <HighlightsStrip items={nearbyHighlights} glass />
              </div>

              <div className="mt-4">
                <ShopsList
                  shops={displayedShops}
                  language={language}
                  selectedShopId={selectedShopId}
                  reviewsSignal={shopReviewSignal}
                />
              </div>

              <p className="mt-4 pb-2 text-[11px] leading-relaxed tracking-[0.2px] text-[var(--ash)]">
                Distances are approximate from your area centre. Map data © OpenStreetMap contributors.
              </p>
            </>
          ) : tab === "shops" && isResolvingArea ? (
            <div className="space-y-3" role="status" aria-label="Loading nearby places">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-4">
                  <div className="h-3 w-2/3 rounded-full bg-[var(--surface-card)] shimmer" />
                  <div className="mt-2 h-3 w-1/3 rounded-full bg-[var(--surface-card)] shimmer" />
                  <div className="mt-3 h-3 w-full rounded-full bg-[var(--surface-elevated)] shimmer" />
                </div>
              ))}
            </div>
          ) : data.areaIds ? (
            <div className="mt-2 h-full min-h-0 pb-2">
              <AreaChat
                areaIds={data.areaIds}
                localityName={data.localityName || "Your area"}
                showPresence={Boolean(data.showPresence)}
                onPresenceChange={async (next) => {
                  await togglePresence(next);
                }}
                onSheetActive={handleSheetActive}
                onClearArea={() => {
                  setSettingsOpen(false);
                  void clearArea();
                }}
              />
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-[var(--mute)]">Set your area to use chat.</p>
          )}
        </div>
      </section>

      {showRadiusPrompt ? (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]  sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="radius-prompt-title"
        >
          <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-4">
            <h2 id="radius-prompt-title" className="font-display text-[22px] leading-tight text-[var(--ink)]">
              Area set
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--body-text)]">
              Want to change the search radius? Default is 1 km.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-tertiary min-h-[44px] justify-center"
                onClick={() => setShowRadiusPrompt(false)}
              >
                Keep 1 km
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-[44px] justify-center"
                onClick={() => {
                  setShowRadiusPrompt(false);
                  setSettingsOpen(true);
                }}
              >
                Change radius
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
