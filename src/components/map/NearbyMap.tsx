"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import type { NearbyShop } from "@/features/shops/types";

export type MapLanguage = "en" | "hi";

// Kept in sync with src/features/area/h3.ts CITY_BOUNDS.
// The map is city-constrained: no national boundary layer is added or claimed.
const CITY_BOUNDS: [[number, number], [number, number]] = [
  [75.1, 19.7],
  [75.6, 20.1],
];

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const MAP_BACKGROUND_COLOR = "#121212";
const WATER_COLOR = "#1a2330";

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Raster fallbacks for browsers that drop the primary vector tiles
// (Brave Shields, ad blockers, corporate proxies). Both are keyless.
const CARTO_DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: `${OSM_ATTRIBUTION}, © <a href="https://carto.com/attributions">CARTO</a>`,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": MAP_BACKGROUND_COLOR },
    },
    {
      id: "carto-dark-tiles",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": MAP_BACKGROUND_COLOR },
    },
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
      paint: { "raster-saturation": -0.7, "raster-brightness-max": 0.72 },
    },
  ],
};

type MapStyleOption = {
  id: "openfreemap" | "carto" | "osm";
  style: string | StyleSpecification;
};

const MAP_STYLE_CHAIN: MapStyleOption[] = [
  { id: "openfreemap", style: STYLE_URL },
  { id: "carto", style: CARTO_DARK_STYLE },
  { id: "osm", style: OSM_RASTER_STYLE },
];

const STYLE_TIMEOUT_MS = 8000;

function mapBlockedMessage(language: MapLanguage) {
  return language === "hi"
    ? "Map tiles browser ne block kar di hain. Is site ke liye Brave Shields ya ad blocker band karo, phir retry karo."
    : "Map tiles are blocked by your browser. Turn off Brave Shields or any ad blocker for this site, then retry.";
}

const SHOP_CATEGORY_INDEX: Record<string, number> = {
  food: 0,
  grocery: 1,
  pharmacy: 2,
  health: 3,
  education: 4,
  services: 5,
  repair: 6,
  salon: 7,
  hardware: 8,
  clothing: 9,
  electronics: 10,
  transport: 11,
  other: 12,
};

function toFeatureCollection(shops: NearbyShop[]) {
  return {
    type: "FeatureCollection" as const,
    features: shops.map((shop) => ({
      type: "Feature" as const,
      properties: {
        id: shop.id,
        name: shop.name,
        name_hi: shop.name_hi || shop.name,
        category: shop.category,
        categoryIndex: SHOP_CATEGORY_INDEX[shop.category] ?? 0,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [shop.lng, shop.lat],
      },
    })),
  };
}

function circleGeoJSON(center: { lat: number; lng: number }, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const earth = 6371008.8;
  const lat = (center.lat * Math.PI) / 180;
  const lng = (center.lng * Math.PI) / 180;
  const d = radiusM / earth;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * Math.PI * 2;
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(bearing),
    );
    const lng2 =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(lat2),
      );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [coords] },
      },
    ],
  };
}

function labelExpression(language: MapLanguage) {
  return language === "hi"
    ? ["coalesce", ["get", "name_hi"], ["get", "name"]]
    : ["get", "name"];
}

const CLUSTER_RADIUS_M = 48;

const CATEGORY_MARKER_STYLES: Record<string, { color: string; emoji: string }> = {
  food: { color: "#FF8C00", emoji: "🍽️" },
  grocery: { color: "#44BB44", emoji: "🛒" },
  pharmacy: { color: "#FF69B4", emoji: "💊" },
  health: { color: "#FF4444", emoji: "🏥" },
  education: { color: "#4488FF", emoji: "🎓" },
  services: { color: "#FFD700", emoji: "🏦" },
  transport: { color: "#9B59B6", emoji: "⛽" },
  repair: { color: "#888888", emoji: "🔧" },
  salon: { color: "#00CED1", emoji: "✂️" },
  clothing: { color: "#00BFFF", emoji: "👕" },
  electronics: { color: "#6610F2", emoji: "📱" },
  hardware: { color: "#8B4513", emoji: "🔨" },
  other: { color: "#FFFFFF", emoji: "📍" },
};

const DEFAULT_MARKER_STYLE = CATEGORY_MARKER_STYLES.other;

function getCategoryMarkerStyle(category: string): { color: string; emoji: string } {
  return CATEGORY_MARKER_STYLES[category] ?? DEFAULT_MARKER_STYLE;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earth = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earth * c;
}

function groupShopsIntoClusters(shops: NearbyShop[]): NearbyShop[][] {
  const clusters: NearbyShop[][] = [];
  const reps: { lat: number; lng: number }[] = [];
  for (const shop of shops) {
    let index = -1;
    for (let i = 0; i < clusters.length; i++) {
      const rep = reps[i];
      if (distanceMeters(rep, shop) < CLUSTER_RADIUS_M) {
        index = i;
        break;
      }
    }
    if (index >= 0) clusters[index].push(shop);
    else {
      clusters.push([shop]);
      reps.push({ lat: shop.lat, lng: shop.lng });
    }
  }
  return clusters;
}

function createShopMarkerElement(style: { color: string; emoji: string }): HTMLDivElement {
  const el = document.createElement("div");
  const dot = document.createElement("div");
  dot.style.width = "28px";
  dot.style.height = "28px";
  dot.style.borderRadius = "50%";
  dot.style.backgroundColor = `${style.color}2e`;
  dot.style.border = `2px solid ${style.color}`;
  dot.style.boxShadow = `0 0 12px ${style.color}59, 0 2px 6px rgba(0, 0, 0, 0.55)`;
  dot.style.display = "flex";
  dot.style.alignItems = "center";
  dot.style.justifyContent = "center";
  dot.style.fontSize = "13px";
  dot.style.lineHeight = "28px";
  dot.textContent = style.emoji;
  el.appendChild(dot);
  el.style.position = "absolute";
  el.style.transform = "translate(-50%, -50%)";
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.willChange = "transform";
  el.addEventListener("mouseenter", () => {
    el.style.transform = "translate(-50%, -50%) scale(1.14)";
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "translate(-50%, -50%) scale(1)";
  });
  return el;
}

function createClusterMarkerElement(style: { color: string; emoji: string }, count: number): HTMLDivElement {
  const el = document.createElement("div");
  const dot = document.createElement("div");
  dot.style.width = "44px";
  dot.style.height = "44px";
  dot.style.borderRadius = "50%";
  dot.style.backgroundColor = style.color;
  dot.style.border = "2px solid rgba(18, 18, 18, 0.9)";
  dot.style.boxShadow = `0 0 16px ${style.color}80, 0 4px 10px rgba(0, 0, 0, 0.6)`;
  dot.style.display = "flex";
  dot.style.alignItems = "center";
  dot.style.justifyContent = "center";
  dot.style.fontSize = "13px";
  dot.style.fontWeight = "700";
  dot.style.color = "#000000";
  dot.style.textAlign = "center";
  dot.style.padding = "0 6px";
  dot.textContent = String(count);
  el.appendChild(dot);
  el.style.position = "absolute";
  el.style.transform = "translate(-50%, -50%)";
  el.style.width = "44px";
  el.style.height = "44px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.willChange = "transform";
  el.addEventListener("mouseenter", () => {
    el.style.transform = "translate(-50%, -50%) scale(1.14)";
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "translate(-50%, -50%) scale(1)";
  });
  return el;
}

class MapFloatControl implements maplibregl.IControl {
  private containerEl: HTMLDivElement | null = null;

  constructor(private readonly onLocate: (() => void) | null) {}

  onAdd(map: maplibregl.Map): HTMLElement {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "12px";
    el.style.right = "12px";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "8px";
    el.style.zIndex = "4";

    const button = (ariaLabel: string, onPress: () => void) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", ariaLabel);
      btn.style.width = "38px";
      btn.style.height = "38px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(242,236,225,0.14)";
      btn.style.backgroundColor = "#282828";
      
      btn.style.color = "#f2ece1";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.cursor = "pointer";
      btn.style.padding = "0";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("strokeLinecap", "round");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = '<path d="M12 5v14M5 12h14"></path>';
      btn.appendChild(svg);
      btn.addEventListener("click", onPress);
      el.appendChild(btn);
    };

    button("Zoom in", () => {
      map.easeTo({ zoom: Math.min(map.getMaxZoom(), map.getZoom() + 1), duration: 180 });
    });
    button("Zoom out", () => {
      map.easeTo({ zoom: Math.max(map.getMinZoom(), map.getZoom() - 1), duration: 180 });
    });
    button("Center map on your area", () => {
      this.onLocate?.();
    });

    this.containerEl = el;
    return el;
  }

  onRemove(): void {
    this.containerEl?.remove();
    this.containerEl = null;
  }
}

export function NearbyMap({
  centroid,
  radiusM,
  shops,
  language = "en",
  onSelectShop,
  onLocate,
  onMapStatusChange,
}: {
  centroid: { lat: number; lng: number };
  radiusM: number;
  shops: NearbyShop[];
  language?: MapLanguage;
  onSelectShop?: (id: string) => void;
  onLocate?: () => void;
  onMapStatusChange?: (status: "loading" | "ready") => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const languageRef = useRef<MapLanguage>(language);
  const dataRef = useRef({ centroid, radiusM, shops });
  const onLocateRef = useRef<(() => void) | null>(null);
  const onMapStatusChangeRef = useRef<((status: "loading" | "ready") => void) | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const onSelectShopRef = useRef<((id: string) => void) | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  function retryMap() {
    setMapError(null);
    setStatus("loading");
    onMapStatusChangeRef.current?.("loading");
    setRetryNonce((n) => n + 1);
  }

  useEffect(() => {
    onLocateRef.current = onLocate ?? null;
  }, [onLocate]);

  useEffect(() => {
    onMapStatusChangeRef.current = onMapStatusChange ?? null;
  }, [onMapStatusChange]);

  useEffect(() => {
    onSelectShopRef.current = onSelectShop ?? null;
  }, [onSelectShop]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    dataRef.current = { centroid, radiusM, shops };
  }, [centroid, radiusM, shops]);

  const syncShopMarkers = (shops: NearbyShop[]) => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    for (const marker of Array.from(markersRef.current.values())) {
      marker.remove();
    }
    markersRef.current.clear();

    const bounds = map.getBounds();
    const visibleShops = shops.filter((shop) => bounds.contains({ lat: shop.lat, lng: shop.lng }));
    const clusters = groupShopsIntoClusters(visibleShops);

    for (const cluster of clusters) {
      const dominant = cluster[0];
      const style = getCategoryMarkerStyle(dominant.category);
      const isCluster = cluster.length > 1;
      const center = isCluster
        ? {
            lat: cluster.reduce((sum, s) => sum + s.lat, 0) / cluster.length,
            lng: cluster.reduce((sum, s) => sum + s.lng, 0) / cluster.length,
          }
        : { lat: dominant.lat, lng: dominant.lng };
      const element = isCluster
        ? createClusterMarkerElement(style, cluster.length)
        : createShopMarkerElement(style);
      const marker = new maplibregl.Marker({ element, anchor: "center" });
      marker.on("click", () => {
        onSelectShopRef.current?.(dominant.id);
      });
      marker.setLngLat([center.lng, center.lat]).addTo(map);
      markersRef.current.set(isCluster ? `cluster:${dominant.id}` : `shop:${dominant.id}`, marker);
    }
  };

  useEffect(() => {
    syncShopMarkers(shops);
  }, [shops]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    const markers = markersRef.current;

    let disposed = false;
    let map: maplibregl.Map | null = null;
    let styleIndex = 0;
    let styleReady = false;
    let styleSwapAt = 0;
    let watchdogId: number | null = null;
    let interactionsBound = false;
    let resizeObserver: ResizeObserver | null = null;

    function clearWatchdog() {
      if (watchdogId !== null) {
        window.clearTimeout(watchdogId);
        watchdogId = null;
      }
    }

    function showBlockedNotice() {
      clearWatchdog();
      console.error("[nearby-map] every tile source failed to load");
      setMapError(mapBlockedMessage(languageRef.current));
      setStatus("ready");
      onMapStatusChangeRef.current?.("ready");
    }

    function armWatchdog() {
      clearWatchdog();
      watchdogId = window.setTimeout(() => {
        if (disposed || styleReady) return;
        applyStyle(styleIndex + 1, `${MAP_STYLE_CHAIN[styleIndex].id} timed out`);
      }, STYLE_TIMEOUT_MS);
    }

    // Walk down the style chain instead of spinning forever when a browser
    // (Brave Shields, ad blockers, proxies) drops the tile requests.
    function applyStyle(index: number, reason: string) {
      if (disposed || !map || mapRef.current !== map) return;
      if (index >= MAP_STYLE_CHAIN.length) {
        showBlockedNotice();
        return;
      }
      styleIndex = index;
      styleReady = false;
      styleSwapAt = Date.now();
      if (index > 0) {
        console.warn(`[nearby-map] falling back to ${MAP_STYLE_CHAIN[index].id} tiles: ${reason}`);
      }
      try {
        map.setStyle(MAP_STYLE_CHAIN[index].style, { diff: false });
      } catch (err) {
        console.error("[nearby-map] setStyle failed:", err);
        applyStyle(index + 1, "setStyle failed");
        return;
      }
      armWatchdog();
    }

    function addLayers() {
      if (!map || mapRef.current !== map) return;
      const latest = dataRef.current;

      if (!map.getSource("radius")) {
        map.addSource("radius", {
          type: "geojson",
          data: circleGeoJSON(latest.centroid, latest.radiusM),
        });
        map.addLayer({
          id: "radius-fill",
          type: "fill",
          source: "radius",
          paint: { "fill-color": "#1db954", "fill-opacity": 0.07 },
        });
        map.addLayer({
          id: "radius-line",
          type: "line",
          source: "radius",
          paint: { "line-color": "#1db954", "line-width": 2, "line-opacity": 0.5 },
        });
      }
      if (!map.getSource("shops")) {
        map.addSource("shops", {
          type: "geojson",
          data: toFeatureCollection(latest.shops),
        });
        // Raster fallback styles ship no glyphs, so the symbol layer is only
        // added when the active style provides a font stack.
        if (map.getStyle().glyphs) {
          map.addLayer({
            id: "shop-labels",
            type: "symbol",
            source: "shops",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": labelExpression(languageRef.current) as maplibregl.ExpressionSpecification,
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
              "text-offset": [0, 1.1],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-optional": true,
            },
            paint: {
              "text-color": "#f2ece1",
              "text-halo-color": "#121212",
              "text-halo-width": 2,
            },
          });
        }
      }

      if (interactionsBound) return;
      interactionsBound = true;
    }

    function createMap(initialStyle: string | StyleSpecification, startIndex: number) {
      if (disposed || mapRef.current) return;

      // The UMD build in maplibre-gl@4 already creates its worker from an
      // inline blob. Do not override it with a bundler-relative URL: that path
      // resolves to a missing file under Next/Turbopack and the map stays blank.
      const instance = new maplibregl.Map({
        container,
        style: initialStyle,
        center: [centroid.lng, centroid.lat],
        zoom: 14,
        minZoom: 11,
        maxZoom: 18,
        maxBounds: CITY_BOUNDS,
        renderWorldCopies: false,
        antialias: false,
        fadeDuration: 0,
        attributionControl: false,
      });
      instance.addControl(new maplibregl.AttributionControl({ compact: true }));
      instance.addControl(new MapFloatControl(() => onLocateRef.current?.()), "top-right");
      instance.dragRotate.disable();
      instance.touchZoomRotate.disableRotation();
      map = instance;
      styleIndex = startIndex;
      mapRef.current = instance;

      instance.on("loading", () => {
        setStatus("loading");
        onMapStatusChangeRef.current?.("loading");
      });

      // Keep the dark map calm and lighter on low-end phones: hide POI,
      // transit, and airport layers that add tiles and visual noise.
      instance.on("style.load", () => {
        styleReady = true;
        clearWatchdog();
        setMapError(null);
        try {
          const style = instance.getStyle();
          const backgroundLayer = style.layers?.find((layer) => layer.id === "background");
          if (backgroundLayer) {
            instance.setPaintProperty("background", "background-color", MAP_BACKGROUND_COLOR);
          }
          const waterLayer = style.layers?.find((layer) => layer.id === "water");
          if (waterLayer) {
            try {
              instance.setPaintProperty("water", "fill-color", WATER_COLOR);
            } catch {
              // Non-fill water layers keep their default styling.
            }
          }
          for (const layer of style.layers ?? []) {
            if (/(^|[-_])(poi|transit|airport|rail)([-_]|$)/i.test(layer.id)) {
              instance.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        } catch (err) {
          console.error("[nearby-map] style tweaks failed:", err);
        }

        loadedRef.current = true;
        try {
          addLayers();
        } catch (err) {
          console.error("[nearby-map] layer setup failed:", err);
        }
        try {
          syncShopMarkers(dataRef.current.shops);
        } catch (err) {
          console.error("[nearby-map] marker sync failed:", err);
        }
        instance.resize();
      });

      instance.on("move", () => {
        const bounds = instance.getBounds();
        for (const marker of Array.from(markersRef.current.values())) {
          const lngLat = marker.getLngLat();
          if (bounds.contains({ lat: lngLat.lat, lng: lngLat.lng })) {
            marker.getElement().style.display = "";
          } else {
            marker.getElement().style.display = "none";
          }
        }
      });

      instance.on("load", () => {
        loadedRef.current = true;
        console.log("[nearby-map] map loaded");
        instance.resize();
      });

      instance.on("error", (event) => {
        const message = event?.error?.message ?? "unknown error";
        console.error("[nearby-map] map error:", event);
        // Style level failures (blocked style JSON, CSP, DNS) arrive without a
        // sourceId. Per-tile errors carry one and should not swap the style.
        const sourceId = (event as unknown as { sourceId?: string }).sourceId;
        if (!sourceId && !styleReady && Date.now() - styleSwapAt > 800) {
          applyStyle(styleIndex + 1, `style error: ${message}`);
        }
      });

      instance.on("idle", () => {
        setStatus("ready");
        onMapStatusChangeRef.current?.("ready");
      });

      // The sheet above the map changes height while the user drags it, and the
      // desktop layout can settle after the first paint. Keep the canvas sized.
      resizeObserver = new ResizeObserver(() => {
        instance.resize();
      });
      resizeObserver.observe(container);

      armWatchdog();
    }

    // Probe the style JSON before creating the map. Brave Shields and ad
    // blockers drop this request, and MapLibre cannot swap to an inline
    // fallback style after a failed style URL load, so start on raster tiles
    // instead of leaving the spinner up forever.
    async function boot() {
      let primaryOk = true;
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 5000);
        const response = await fetch(STYLE_URL, { signal: controller.signal, cache: "force-cache" });
        window.clearTimeout(timer);
        primaryOk = response.ok;
      } catch {
        primaryOk = false;
      }
      if (disposed) return;
      if (!primaryOk) {
        console.warn("[nearby-map] primary style unreachable, starting on raster fallback");
      }
      const index = primaryOk ? 0 : 1;
      createMap(MAP_STYLE_CHAIN[index].style, index);
    }

    void boot();

    return () => {
      disposed = true;
      clearWatchdog();
      resizeObserver?.disconnect();
      loadedRef.current = false;
      for (const marker of Array.from(markers.values())) {
        marker.remove();
      }
      markers.clear();
      map?.remove();
      map = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const radiusSource = map.getSource("radius") as maplibregl.GeoJSONSource | undefined;
    if (radiusSource) radiusSource.setData(circleGeoJSON(centroid, radiusM) as FeatureCollection);
    const shopsSource = map.getSource("shops") as maplibregl.GeoJSONSource | undefined;
    if (shopsSource) shopsSource.setData(toFeatureCollection(shops) as FeatureCollection);
  }, [centroid, radiusM, shops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("shop-labels")) return;
    map.setLayoutProperty(
      "shop-labels",
      "text-field",
      labelExpression(language) as maplibregl.ExpressionSpecification,
    );
  }, [language]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [centroid.lng, centroid.lat], duration: 300 });
  }, [centroid.lat, centroid.lng]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ opacity: status === "ready" ? 1 : 0, transition: "opacity 600ms ease-out" }}
      aria-label="Map showing nearby shops and your area"
      role="region"
    >
      {mapError ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[var(--canvas)] px-6 text-center"
          role="alert"
        >
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[18px] font-semibold text-[var(--accent-ember)]"
            aria-hidden="true"
          >
            !
          </span>
          <div>
            <p className="text-[14px] font-medium text-[var(--ink)]">Map tiles unavailable</p>
            <p className="mt-1 max-w-[32ch] text-[13px] leading-relaxed text-[var(--body-text)]">
              {mapError}
            </p>
          </div>
          <button
            type="button"
            onClick={retryMap}
            className="min-h-11 rounded-full bg-[var(--accent-ember)] px-5 text-[13px] font-semibold text-[var(--on-primary)] transition-transform active:scale-[0.98]"
          >
            Retry map
          </button>
        </div>
      ) : status === "loading" ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--canvas)]"
          role="status"
          aria-label="Loading map tiles"
        >
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--hairline)] border-t-[var(--accent-ember)]" />
        </div>
      ) : null}
    </div>
  );
}
