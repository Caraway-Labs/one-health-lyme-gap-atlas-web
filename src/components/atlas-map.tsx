"use client";

import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { CountyScoreSummary } from "@/generated/models";
import { CONTIGUOUS_US_INITIAL_VIEW, contiguousUsGeometry } from "@/lib/atlas-geometry";

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, { fips: string }>;

export function AtlasMap({
  geometry,
  scores,
  selectedFips,
  onSelect,
}: {
  geometry: FeatureCollection;
  scores: CountyScoreSummary[];
  selectedFips: string;
  onSelect: (fips: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  const enriched = (): GeoJSON.FeatureCollection => {
    const byFips = new Map(scores.map((county) => [county.fips, county]));
    const contiguousGeometry = contiguousUsGeometry(geometry);
    return {
      ...contiguousGeometry,
      features: contiguousGeometry.features.map((feature) => {
        const county = byFips.get(feature.properties.fips);
        return {
          ...feature,
          properties: {
            ...feature.properties,
            color: county?.color ?? "#e4e9ea",
            selected: feature.properties.fips === selectedFips,
          },
        };
      }),
    };
  };

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: {}, layers: [] },
      ...CONTIGUOUS_US_INITIAL_VIEW,
      minZoom: 2,
      maxZoom: 8,
      attributionControl: false,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    instance.on("load", () => {
      instance.addSource("counties", { type: "geojson", data: enriched() });
      instance.addLayer({
        id: "counties-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#e4e9ea"],
          "fill-opacity": 0.92,
          "fill-outline-color": "rgba(255,255,255,.9)",
        },
      });
      instance.addLayer({
        id: "selected-outline",
        type: "line",
        source: "counties",
        filter: ["==", ["get", "selected"], true],
        paint: { "line-color": "#061f3d", "line-width": 3 },
      });
      instance.on("click", "counties-fill", (event) => {
        const fips = event.features?.[0]?.properties?.fips;
        if (typeof fips === "string") selectRef.current(fips);
      });
      instance.on("mouseenter", "counties-fill", () => { instance.getCanvas().style.cursor = "pointer"; });
      instance.on("mouseleave", "counties-fill", () => { instance.getCanvas().style.cursor = ""; });
    });
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
    // The source is initialized once and refreshed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = map.current?.getSource("counties") as GeoJSONSource | undefined;
    if (!source || !map.current?.getLayer("selected-outline")) return;
    source.setData(enriched());
    map.current.setFilter("selected-outline", ["==", ["get", "selected"], true]);
  });

  return (
    <div
      ref={container}
      className="maplibre-atlas"
      role="img"
      aria-label="County map colored by Surveillance Gap Score. Use the ranked list or results table for keyboard selection."
    />
  );
}
