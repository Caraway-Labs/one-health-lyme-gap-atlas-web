"use client";

import type {
  FillLayerSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

import type { CountyScoreSummary } from "@/generated/models";
import type { GeographySelectionSurface } from "@/lib/atlas-analytics";
import {
  CONTIGUOUS_US_INITIAL_VIEW,
  contiguousUsGeometry,
} from "@/lib/atlas-geometry";
import {
  countyFeatureBounds,
  countyIsSubstantiallyVisible,
  fitCountyBounds,
  mapCameraDuration,
  type CountyBounds,
} from "@/lib/atlas-map-camera";
import { countyBelongsToDistrict } from "@/lib/health-districts";
import { cn } from "@/lib/utils";

type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { fips: string }
>;

export type AtlasMapFillColor = NonNullable<
  NonNullable<FillLayerSpecification["paint"]>["fill-color"]
>;

export type AtlasMapCamera = {
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
};

export type AtlasMapHandle = {
  getMap: () => MapLibreMap | null;
};

function mapWithExternalJumpTo(
  map: MapLibreMap,
  applyingExternalMove: { current: boolean }
): MapLibreMap {
  return new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === "jumpTo") {
        return (
          options: Parameters<MapLibreMap["jumpTo"]>[0],
          eventData?: Parameters<MapLibreMap["jumpTo"]>[1]
        ) => {
          applyingExternalMove.current = true;
          try {
            if (eventData === undefined) {
              return target.jumpTo(options);
            }
            return target.jumpTo(options, eventData);
          } finally {
            applyingExternalMove.current = false;
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

const DEFAULT_ARIA_LABEL =
  "County map colored by County Review Priority. Use the county list or results table for keyboard selection.";

const DEFAULT_FILL_COLOR: AtlasMapFillColor = [
  "coalesce",
  ["get", "color"],
  "#e4e9ea",
];

function atlasMapContainerRole(role: "img" | "none"): "img" | undefined {
  switch (role) {
    case "img": {
      return "img";
    }
    case "none": {
      return undefined;
    }
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

function viewportBoundsFromMap(map: MapLibreMap): CountyBounds {
  const viewport = map.getBounds();
  return [
    viewport.getWest(),
    viewport.getSouth(),
    viewport.getEast(),
    viewport.getNorth(),
  ];
}

export function AtlasMap({
  geometry,
  scores,
  selectedFips,
  selectedState = "ALL",
  selectedDistrict = "ALL",
  onSelect,
  className,
  ariaLabel = DEFAULT_ARIA_LABEL,
  showOverlays = true,
  includeUnscoredCounties = true,
  fillColor = DEFAULT_FILL_COLOR,
  onMove,
  onIdle,
  onError,
  containerRole = "img",
  ref,
}: {
  geometry: FeatureCollection;
  scores: CountyScoreSummary[];
  selectedFips: string;
  selectedState?: string;
  selectedDistrict?: string;
  onSelect: (fips: string, surface: GeographySelectionSurface) => void;
  className?: string;
  ariaLabel?: string;
  showOverlays?: boolean;
  includeUnscoredCounties?: boolean;
  fillColor?: AtlasMapFillColor;
  onMove?: (camera: AtlasMapCamera) => void;
  onIdle?: () => void;
  onError?: () => void;
  containerRole?: "img" | "none";
  ref?: Ref<AtlasMapHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const applyingExternalMove = useRef(false);
  const previousSelectedFips = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const selectRef = useRef(onSelect);
  const onMoveRef = useRef(onMove);
  const onIdleRef = useRef(onIdle);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    selectRef.current = onSelect;
    onMoveRef.current = onMove;
    onIdleRef.current = onIdle;
    onErrorRef.current = onError;
  });

  useImperativeHandle(ref, () => ({
    getMap: () => {
      const current = map.current;
      return current
        ? mapWithExternalJumpTo(current, applyingExternalMove)
        : null;
    },
  }));

  const enriched = (): GeoJSON.FeatureCollection => {
    const byFips = new Map(scores.map((county) => [county.fips, county]));
    const contiguousGeometry = contiguousUsGeometry(geometry);
    return {
      ...contiguousGeometry,
      features: contiguousGeometry.features.flatMap((feature) => {
        const county = byFips.get(feature.properties.fips);
        if (!includeUnscoredCounties && !county) {
          return [];
        }
        return [
          {
            ...feature,
            properties: {
              ...feature.properties,
              color: county?.color ?? "#e4e9ea",
              completeness: county?.evidence_completeness ?? 0,
              selected: feature.properties.fips === selectedFips,
              selectedDistrict: Boolean(
                county &&
                countyBelongsToDistrict(
                  county.state,
                  county.county,
                  selectedState,
                  selectedDistrict
                )
              ),
              selectedState:
                selectedState !== "ALL" && county?.state === selectedState,
            },
          },
        ];
      }),
    };
  };

  useEffect(() => {
    if (!container.current || map.current) {
      return;
    }
    const instance = new maplibregl.Map({
      container: container.current,
      style: { layers: [], sources: {}, version: 8 },
      ...CONTIGUOUS_US_INITIAL_VIEW,
      minZoom: 2,
      maxZoom: 8,
      attributionControl: false,
    });
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    instance.on("error", () => {
      onErrorRef.current?.();
    });
    instance.on("move", () => {
      if (applyingExternalMove.current) {
        return;
      }
      const center = instance.getCenter();
      onMoveRef.current?.({
        center: { lng: center.lng, lat: center.lat },
        zoom: instance.getZoom(),
        bearing: instance.getBearing(),
        pitch: instance.getPitch(),
      });
    });
    instance.on("load", () => {
      instance.addSource("counties", { data: enriched(), type: "geojson" });
      instance.addLayer({
        id: "counties-fill",
        paint: {
          "fill-color": fillColor,
          "fill-opacity": 0.92,
          "fill-outline-color": "rgba(255,255,255,.9)",
        },
        source: "counties",
        type: "fill",
      });
      if (showOverlays) {
        instance.addLayer({
          filter: ["==", ["get", "selectedDistrict"], true],
          id: "selected-district-fill",
          paint: { "fill-color": "#f08c46", "fill-opacity": 0.2 },
          source: "counties",
          type: "fill",
        });
        instance.addLayer({
          filter: ["==", ["get", "selectedDistrict"], true],
          id: "selected-district-outline",
          paint: { "line-color": "#d9480f", "line-width": 5 },
          source: "counties",
          type: "line",
        });
        instance.addLayer({
          filter: ["==", ["get", "selectedState"], true],
          id: "selected-state-outline",
          paint: { "line-color": "#0b7285", "line-width": 2.5 },
          source: "counties",
          type: "line",
        });
      }
      instance.addLayer({
        filter: ["==", ["get", "selected"], true],
        id: "selected-outline",
        paint: { "line-color": "#061f3d", "line-width": 3 },
        source: "counties",
        type: "line",
      });
      instance.on("click", "counties-fill", (event) => {
        const fips = event.features?.[0]?.properties?.fips;
        if (typeof fips === "string") {
          selectRef.current(fips, "map");
        }
      });
      instance.on("mouseenter", "counties-fill", () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "counties-fill", () => {
        instance.getCanvas().style.cursor = "";
      });
      instance.once("idle", () => {
        onIdleRef.current?.();
      });
      setMapReady(true);
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
    // The source is initialized once and refreshed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = map.current?.getSource("counties") as
      | GeoJSONSource
      | undefined;
    if (!source || !map.current?.getLayer("selected-outline")) {
      return;
    }
    source.setData(enriched());
    map.current.setPaintProperty("counties-fill", "fill-color", fillColor);
    if (map.current.getLayer("selected-state-outline")) {
      map.current.setFilter("selected-state-outline", [
        "==",
        ["get", "selectedState"],
        true,
      ]);
    }
    if (map.current.getLayer("selected-district-outline")) {
      map.current.setFilter("selected-district-outline", [
        "==",
        ["get", "selectedDistrict"],
        true,
      ]);
    }
    map.current.setFilter("selected-outline", [
      "==",
      ["get", "selected"],
      true,
    ]);
  });

  useEffect(() => {
    const instance = map.current;
    if (!mapReady || !instance?.getLayer("selected-outline")) {
      return;
    }
    if (previousSelectedFips.current === null) {
      previousSelectedFips.current = selectedFips;
      return;
    }
    if (previousSelectedFips.current === selectedFips) {
      return;
    }
    previousSelectedFips.current = selectedFips;

    const feature = geometry.features.find(
      (item) => item.properties.fips === selectedFips
    );
    const bounds = countyFeatureBounds(feature ?? null);
    if (!bounds) {
      return;
    }
    if (
      countyIsSubstantiallyVisible({
        county: bounds,
        currentZoom: instance.getZoom(),
        viewport: viewportBoundsFromMap(instance),
      })
    ) {
      return;
    }

    fitCountyBounds(instance, bounds, { duration: mapCameraDuration() });
  }, [geometry, mapReady, selectedFips]);

  return (
    <div
      ref={container}
      className={cn("maplibre-atlas", className)}
      role={atlasMapContainerRole(containerRole)}
      aria-label={
        atlasMapContainerRole(containerRole) === "img" ? ariaLabel : undefined
      }
    />
  );
}
