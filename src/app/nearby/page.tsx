"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaConsent, PresenceOptIn } from "@/components/area/area-consent";
import { AreaPicker } from "@/components/area/area-picker";
import { AreaChat } from "@/components/area/area-chat";
import { ShopsList } from "@/components/shops/ShopsList";
import type { MapLanguage } from "@/components/map/NearbyMap";
import {
  RADIUS_STEPS_M,
  choosePeopleRadius,
  chooseShopRadius,
  formatRadiusLabel,
  peopleMessage,
  shopRadiusMessage,
} from "@/features/area/radius";
import type { NearbyResponse } from "@/features/shops/types";

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

export default function NearbyPage() {
  const [data, setData] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("consent");
  const [selectedRadius, setSelectedRadius] = useState<number | null>(null);
  const [language, setLanguage] = useState<MapLanguage>("en");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [tab, setTab] = useState<"shops" | "chat">("shops");

  const loadNearby = useCallback(async () => {
    const res = await fetch("/api/area/nearby");
    if (!res.ok) {
      setData(null);
      setSelectedRadius(null);
      return null;
    }
    const json = (await res.json()) as NearbyResponse;
    setData(json);
    setSelectedRadius(chooseShopRadius(json.shops).radius);
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
          setSelectedRadius(chooseShopRadius(json.shops).radius);
        } else {
          setData(null);
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

  const shopResult = useMemo(() => {
    if (!data) return null;
    return chooseShopRadius(data.shops);
  }, [data]);

  const effectiveRadius = selectedRadius ?? shopResult?.radius ?? 500;

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

  async function resolveFromCoords(lat: number, lng: number) {
    const h3 = await import("h3-js");
    const h3r8 = h3.latLngToCell(lat, lng, 8);
    const h3r7 = h3.cellToParent(h3r8, 7);
    const h3r5 = h3.cellToParent(h3r8, 5);
    const res = await fetch("/api/area/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ h3r8, h3r7, h3r5 }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not set your area.");
    await loadNearby();
  }

  async function useLocation() {
    setBusy(true);
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
      await resolveFromCoords(position.coords.latitude, position.coords.longitude);
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
    }
  }

  async function clearArea() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/area/location", { method: "DELETE" });
      setData(null);
      setSelectedRadius(null);
      setSelectedShopId(null);
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
    setTab("shops");
    setSheetExpanded(true);
    window.setTimeout(() => {
      document.getElementById(`shop-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`shop-${id}`)?.focus({ preventScroll: true });
    }, 80);
  }

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--charcoal)] p-4">
        <p className="text-sm text-[var(--text-muted)]">Loading your area...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-xl font-semibold text-[var(--text)]">Nearby</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Local shops and area rooms for Chhatrapati Sambhajinagar.
        </p>
        <div className="mt-4">
          {mode === "consent" ? (
            <AreaConsent
              onUseLocation={useLocation}
              onChooseManually={() => setMode("pick")}
              busy={busy}
              error={error}
            />
          ) : (
            <AreaPicker
              onCancel={() => setMode("consent")}
              onPick={async (result) => {
                setBusy(true);
                setError(null);
                try {
                  await resolveFromCoords(result.lat, result.lng);
                  setMode("consent");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not set your area.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--charcoal)]">
      <div className="nearby-map absolute inset-0">
        <NearbyMap
          centroid={data.centroid}
          radiusM={effectiveRadius}
          shops={displayedShops}
          language={language}
          onSelectShop={selectShopFromMap}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-[#171921]/95 to-transparent p-3 pb-8">
        <div className="pointer-events-auto rounded-lg bg-[var(--charcoal)]/85 px-3 py-2 backdrop-blur-sm">
          <h1 className="text-base font-semibold text-[var(--text)]">Nearby</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {data.localityName || "Your area"} · Chhatrapati Sambhajinagar
          </p>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <div
            className="flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--charcoal)]/90"
            role="group"
            aria-label="Map label language"
          >
            <button
              type="button"
              className={`px-2.5 py-1.5 text-xs ${
                language === "en" ? "bg-[var(--yellow)] text-[#171921]" : "text-[var(--text)]"
              }`}
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
            <button
              type="button"
              className={`px-2.5 py-1.5 text-xs ${
                language === "hi" ? "bg-[var(--yellow)] text-[#171921]" : "text-[var(--text)]"
              }`}
              aria-pressed={language === "hi"}
              onClick={() => setLanguage("hi")}
            >
              हिंदी
            </button>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--charcoal)]/90 px-2.5 py-1.5 text-xs text-[var(--text)]"
            onClick={() => {
              setData(null);
              setSelectedRadius(null);
              setSelectedShopId(null);
              setMode("consent");
            }}
          >
            Change area
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--charcoal)]/90 px-2.5 py-1.5 text-xs text-[var(--text)]"
            onClick={() => void clearArea()}
            disabled={busy}
          >
            Clear
          </button>
        </div>
      </header>

      <section
        id="nearby-sheet"
        aria-label="Nearby area"
        className={`absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-3xl flex-col rounded-t-2xl border border-b-0 border-[var(--border)] bg-[var(--charcoal)] shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-[height] duration-200 ${
          sheetExpanded ? "h-[82dvh]" : "h-[46dvh]"
        }`}
      >
        <button
          type="button"
          className="mx-auto mt-2 flex h-8 w-full items-center justify-center"
          aria-expanded={sheetExpanded}
          aria-controls="nearby-sheet-content"
          onClick={() => setSheetExpanded((v) => !v)}
        >
          <span className="h-1.5 w-12 rounded-full bg-[var(--muted)]" aria-hidden="true" />
          <span className="sr-only">{sheetExpanded ? "Collapse panel" : "Expand panel"}</span>
        </button>

        <div className="px-4">
          <div role="tablist" aria-label="Nearby sections" className="flex gap-2 border-b border-[var(--border)] pb-2">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shops"}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === "shops"
                  ? "bg-[var(--yellow)] text-[#171921]"
                  : "border border-[var(--border)] text-[var(--text)]"
              }`}
              onClick={() => setTab("shops")}
            >
              Shops
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "chat"}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === "chat"
                  ? "bg-[var(--yellow)] text-[#171921]"
                  : "border border-[var(--border)] text-[var(--text)]"
              }`}
              onClick={() => {
                setTab("chat");
                setSheetExpanded(true);
              }}
            >
              Chat
            </button>
          </div>
        </div>

        <div
          id="nearby-sheet-content"
          className={`flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            tab === "chat" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {tab === "shops" ? (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[var(--text)]">
                  {shopResult ? shopRadiusMessage(shopResult) : "Loading shops..."}
                </p>
                <label className="text-sm text-[var(--text-muted)]">
                  Radius
                  <select
                    className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--charcoal-2)] px-2 py-1 text-sm text-[var(--text)]"
                    value={effectiveRadius}
                    onChange={(e) => setSelectedRadius(Number(e.target.value))}
                  >
                    {RADIUS_STEPS_M.map((r) => (
                      <option key={r} value={r}>
                        {formatRadiusLabel(r)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {peopleChoice ? peopleMessage(peopleChoice, Boolean(data.showPresence)) : "Checking nearby activity..."}
              </p>

              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <PresenceOptIn
                  checked={Boolean(data.showPresence)}
                  onChange={(next) => void togglePresence(next)}
                  disabled={busy}
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Distances are approximate from your area centre. Map data © OpenStreetMap contributors.
                  Boundaries shown by the base map are not a legal claim.
                </p>
                {error ? (
                  <p className="mt-2 text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="mt-4">
                <ShopsList
                  shops={displayedShops}
                  language={language}
                  selectedShopId={selectedShopId}
                />
              </div>
            </>
          ) : data.areaIds ? (
            <div className="mt-3 h-full min-h-0 pb-2">
              <AreaChat
                areaIds={data.areaIds}
                localityName={data.localityName || "Your area"}
                showPresence={Boolean(data.showPresence)}
                onPresenceChange={async (next) => {
                  await togglePresence(next);
                }}
                onSheetActive={() => setSheetExpanded(true)}
                onClearArea={() => void clearArea()}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Set your area to use chat.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
