"use client";

import { useEffect, useRef } from "react";
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

export function NearbyMap({
  centroid,
  radiusM,
  shops,
  language = "en",
  onSelectShop,
}: {
  centroid: { lat: number; lng: number };
  radiusM: number;
  shops: NearbyShop[];
  language?: MapLanguage;
  onSelectShop?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const languageRef = useRef<MapLanguage>(language);
  const dataRef = useRef({ centroid, radiusM, shops });

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
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    // Keep the dark map calm and lighter on low-end phones: hide POI,
    // transit, and airport layers that add tiles and visual noise.
    map.on("style.load", () => {
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
          paint: { "fill-color": "#F8DC47", "fill-opacity": 0.08 },
        });
        map.addLayer({
          id: "radius-line",
          type: "line",
          source: "radius",
          paint: { "line-color": "#F8DC47", "line-width": 2, "line-opacity": 0.6 },
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
            "circle-color": "#1F2230",
            "circle-stroke-color": "#F8DC47",
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
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
          paint: { "text-color": "#F2F0FA" },
        });
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "shops",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#F8DC47",
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#171921",
          },
        });
        map.addLayer({
          id: "shop-labels",
          type: "symbol",
          source: "shops",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": labelExpression(languageRef.current) as maplibregl.ExpressionSpecification,
            "text-size": 11,
            "text-font": ["Noto Sans Regular"],
            "text-offset": [0, 1.1],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
          },
          paint: {
            "text-color": "#F2F0FA",
            "text-halo-color": "#171921",
            "text-halo-width": 1,
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
      className="h-full w-full overflow-hidden bg-[var(--surface)]"
      aria-label="Map showing nearby shops and your area"
      role="region"
    />
  );
}
