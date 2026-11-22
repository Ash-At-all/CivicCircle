"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
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
const MAP_BACKGROUND_COLOR = "#0b1020";
const WATER_COLOR = "#16283f";

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
      btn.style.borderRadius = "999px";
      btn.style.border = "1px solid rgba(255,255,255,0.18)";
      btn.style.backgroundColor = "rgba(16,17,17,0.85)";
      btn.style.backdropFilter = "blur(12px)";
      btn.style.color = "#f4f4f6";
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
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    onLocateRef.current = onLocate ?? null;
  }, [onLocate]);

  useEffect(() => {
    onMapStatusChangeRef.current = onMapStatusChange ?? null;
  }, [onMapStatusChange]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    dataRef.current = { centroid, radiusM, shops };
  }, [centroid, radiusM, shops]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // The UMD build in maplibre-gl@4 already creates its worker from an
    // inline blob. Do not override it with a bundler-relative URL: that path
    // resolves to a missing file under Next/Turbopack and the map stays blank.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
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
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.addControl(new MapFloatControl(() => onLocateRef.current?.()), "top-right");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on("loading", () => {
      setStatus("loading");
      onMapStatusChangeRef.current?.("loading");
    });
    map.on("idle", () => {
      setStatus("ready");
      onMapStatusChangeRef.current?.("ready");
    });

    // Keep the dark map calm and lighter on low-end phones: hide POI,
    // transit, and airport layers that add tiles and visual noise.
    map.on("style.load", () => {
      const style = map.getStyle();
      const backgroundLayer = style.layers?.find((layer) => layer.id === "background");
      if (backgroundLayer) {
        map.setPaintProperty("background", "background-color", MAP_BACKGROUND_COLOR);
      }
      const waterLayer = style.layers?.find((layer) => layer.id === "water");
      if (waterLayer) {
        try {
          map.setPaintProperty("water", "fill-color", WATER_COLOR);
        } catch {
          // Non-fill water layers keep their default styling.
        }
      }
      for (const layer of map.getStyle().layers ?? []) {
        if (/(^|[-_])(poi|transit|airport|rail)([-_]|$)/i.test(layer.id)) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }
    });

    let interactionsBound = false;

    function addLayers() {
      if (mapRef.current !== map) return;
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
          paint: { "fill-color": "#57c1ff", "fill-opacity": 0.07 },
        });
        map.addLayer({
          id: "radius-line",
          type: "line",
          source: "radius",
          paint: { "line-color": "#57c1ff", "line-width": 2, "line-opacity": 0.5 },
        });
      }
      if (!map.getSource("shops")) {
        map.addSource("shops", {
          type: "geojson",
          data: toFeatureCollection(latest.shops),
          cluster: true,
          clusterMaxZoom: 15,
          clusterRadius: 48,
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "shops",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "point_count"],
              1,
              "#57c1ff",
              8,
              "#38bdf8",
              20,
              "#ffc533",
              40,
              "#ff9f43",
            ],
            "circle-stroke-color": MAP_BACKGROUND_COLOR,
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 18, 12, 24, 30, 28],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "shops",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
            // OpenFreeMap's dark style only ships Noto Sans; a symbol layer
            // without an explicit font requests the MapLibre default stack,
            // whose glyphs 404 and take the whole clustered source's tiles
            // down with them.
            "text-font": ["Noto Sans Regular"],
          },
          paint: { "text-color": "#f4f4f6" },
        });
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "shops",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "categoryIndex"],
              0,
              "#57c1ff",
              2,
              "#38bdf8",
              4,
              "#ffc533",
              6,
              "#ff9f43",
              8,
              "#59d499",
            ],
            "circle-stroke-color": MAP_BACKGROUND_COLOR,
            "circle-stroke-width": 2,
            "circle-radius": 7,
          },
        });
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
            "text-color": "#f4f4f6",
            "text-halo-color": "#07080a",
            "text-halo-width": 2,
          },
        });
      }

      if (interactionsBound) return;
      interactionsBound = true;

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id as number | undefined;
        const source = map.getSource("shops") as maplibregl.GeoJSONSource | undefined;
        if (!source || clusterId == null) return;
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geom = features[0]?.geometry;
            if (geom?.type === "Point") {
              map.easeTo({
                center: geom.coordinates as [number, number],
                zoom: zoom ?? map.getZoom() + 2,
                duration: 300,
              });
            }
          })
          .catch(() => {});
      });

      map.on("click", "unclustered-point", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id && onSelectShop) onSelectShop(id);
      });

      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "unclustered-point", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
      });
    }

    map.on("load", () => {
      loadedRef.current = true;
      addLayers();
    });

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {status === "loading" ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b1020]"
          role="status"
          aria-label="Loading map tiles"
        >
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/12 border-t-[var(--accent-blue)]" />
        </div>
      ) : null}
    </div>
  );
}
