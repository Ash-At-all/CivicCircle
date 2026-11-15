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
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--canvas)] p-4">
        <p className="text-sm text-[var(--mute)]">Loading your area...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mobile-container">
        <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[rgba(7,8,10,0.85)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 pt-[max(env(safe-area-inset-top),10px)]">
            <div>
              <h1 className="text-sm font-medium tracking-[0.2px] text-[var(--ink)]">Nearby</h1>
              <p className="text-[11px] tracking-[0.3px] text-[var(--ash)]">
                Chhatrapati Sambhajinagar
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 py-6">
          <div className="mb-2">
            <p className="text-label">Local discovery</p>
            <h2 className="mt-1 text-h2">Shops and rooms around you</h2>
            <p className="mt-1.5 text-body-sm text-[var(--mute)]">
              Approximate area only. Set your location or pick an area to start.
            </p>
          </div>

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
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--canvas)]">
      <div className="nearby-map absolute inset-0">
        <NearbyMap
          centroid={data.centroid}
          radiusM={effectiveRadius}
          shops={displayedShops}
          language={language}
          onSelectShop={selectShopFromMap}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-[rgba(7,8,10,0.92)] to-transparent p-3 pb-10">
        <div className="pointer-events-auto rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[rgba(13,13,13,0.9)] px-3 py-2 backdrop-blur-md">
          <h1 className="text-[13px] font-medium tracking-[0.2px] text-[var(--ink)]">Nearby</h1>
          <p className="text-[11px] tracking-[0.3px] text-[var(--mute)]">
            {data.localityName || "Your area"} · Chhatrapati Sambhajinagar
          </p>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-[var(--hairline)] bg-[rgba(13,13,13,0.9)] p-1 backdrop-blur-md"
            role="group"
            aria-label="Map label language"
          >
            <button
              type="button"
              className={`pill-tab ${language === "en" ? "pill-tab-active" : ""}`}
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
            <button
              type="button"
              className={`pill-tab ${language === "hi" ? "pill-tab-active" : ""}`}
              aria-pressed={language === "hi"}
              onClick={() => setLanguage("hi")}
            >
              हिंदी
            </button>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-tertiary backdrop-blur-md"
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
            className="btn btn-sm btn-tertiary backdrop-blur-md"
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
        className={`absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-3xl flex-col rounded-t-[var(--radius-xl)] border border-b-0 border-[var(--hairline)] bg-[var(--surface)] transition-[height] duration-200 ${
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
          <span className="h-1.5 w-12 rounded-full bg-[var(--stone)]" aria-hidden="true" />
          <span className="sr-only">{sheetExpanded ? "Collapse panel" : "Expand panel"}</span>
        </button>

        <div className="px-4">
          <div
            role="tablist"
            aria-label="Nearby sections"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface-elevated)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shops"}
              className={`pill-tab ${tab === "shops" ? "pill-tab-active" : ""}`}
              onClick={() => setTab("shops")}
            >
              Shops
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "chat"}
              className={`pill-tab ${tab === "chat" ? "pill-tab-active" : ""}`}
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
                <p className="text-[13px] text-[var(--body-text)]">
                  {shopResult ? shopRadiusMessage(shopResult) : "Loading shops..."}
                </p>
                <label className="flex items-center gap-2 text-[12px] tracking-[0.3px] text-[var(--mute)]">
                  Radius
                  <select
                    className="field w-auto min-h-[32px] py-1 pl-2.5 text-[13px]"
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
              <p className="mt-1 text-[12px] tracking-[0.3px] text-[var(--mute)]">
                {peopleChoice ? peopleMessage(peopleChoice, Boolean(data.showPresence)) : "Checking nearby activity..."}
              </p>

              <div className="card-elevated mt-3 p-3">
                <PresenceOptIn
                  checked={Boolean(data.showPresence)}
                  onChange={(next) => void togglePresence(next)}
                  disabled={busy}
                />
                <p className="mt-2 text-[11px] leading-relaxed tracking-[0.2px] text-[var(--ash)]">
                  Distances are approximate from your area centre. Map data © OpenStreetMap contributors.
                  Boundaries shown by the base map are not a legal claim.
                </p>
                {error ? (
                  <p className="mt-2 text-[13px] text-[var(--accent-red)]" role="alert">
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
            <p className="mt-4 text-[13px] text-[var(--mute)]">Set your area to use chat.</p>
          )}
        </div>
      </section>
    </main>
  );
}
