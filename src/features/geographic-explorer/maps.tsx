"use client";

import maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CountyScoreSummary } from "@/generated/models";

type Props = {
  geometry: GeoJSON.FeatureCollection;
  counties: CountyScoreSummary[];
  selectedFips: string;
  maximum: number;
  dual: boolean;
  onSelect: (fips: string) => void;
};

export default function ExplorerMaps(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ExplorerMapRuntime
      key={attempt}
      {...props}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function ExplorerMapRuntime(props: Props & { onRetry: () => void }) {
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const maps = useRef<LibreMap[]>([]);
  const latest = useRef(props);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(0);
  useEffect(() => {
    latest.current = props;
    refresh(maps.current, props);
  }, [props]);

  useEffect(() => {
    const lifecycle = { syncing: false, disposed: false };
    const containers = props.dual
      ? [first.current, second.current]
      : [first.current];
    try {
      for (const [index, container] of containers.entries()) {
        if (!container) continue;
        const map = new maplibregl.Map({
          container,
          style: { version: 8, sources: {}, layers: [] },
          center: [-98, 38],
          zoom: 2.5,
          minZoom: 2,
          maxZoom: 8,
          attributionControl: false,
        });
        maps.current.push(map);
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right"
        );
        map.on("error", () => {
          if (!lifecycle.disposed) setFailed(true);
        });
        map.on("load", () => {
          if (lifecycle.disposed) return;
          map.addSource("counties", {
            type: "geojson",
            data: mapData(latest.current),
          });
          map.addLayer({
            id: "county-fill",
            source: "counties",
            type: "fill",
            paint: {
              "fill-color":
                index === 0
                  ? ["get", "color"]
                  : [
                      "interpolate",
                      ["linear"],
                      ["get", "completeness"],
                      0,
                      "#dff1eb",
                      latest.current.maximum,
                      "#075760",
                    ],
              "fill-opacity": 0.9,
              "fill-outline-color": "#ffffff",
            },
          });
          map.addLayer({
            id: "county-selection",
            source: "counties",
            type: "line",
            filter: ["==", ["get", "fips"], latest.current.selectedFips],
            paint: { "line-color": "#082a4d", "line-width": 3 },
          });
          map.on("click", "county-fill", (event) => {
            const fips = event.features?.[0]?.properties?.fips;
            if (typeof fips === "string") latest.current.onSelect(fips);
          });
          // Source loading finishes after the style's load event. Wait for the
          // first rendered idle frame before claiming county geometry is ready.
          map.once("idle", () => {
            if (!lifecycle.disposed) setReady((count) => count + 1);
          });
        });
        map.on("move", () => {
          if (lifecycle.syncing) return;
          lifecycle.syncing = true;
          try {
            for (const other of maps.current)
              if (other !== map)
                other.jumpTo({
                  center: map.getCenter(),
                  zoom: map.getZoom(),
                  bearing: map.getBearing(),
                  pitch: map.getPitch(),
                });
          } finally {
            lifecycle.syncing = false;
          }
        });
      }
    } catch {
      queueMicrotask(() => {
        if (!lifecycle.disposed) setFailed(true);
      });
    }
    return () => {
      lifecycle.disposed = true;
      for (const map of maps.current) map.remove();
      maps.current = [];
    };
  }, [props.dual]);

  return (
    <div>
      {failed && (
        <p role="alert">
          The map could not render. All county values remain available in the
          evidence table.{" "}
          <Button variant="secondary" onClick={props.onRetry}>
            Retry maps
          </Button>
        </p>
      )}
      <p role="status">
        {ready >= (props.dual ? 2 : 1)
          ? "Maps ready. Pan and zoom are synchronized."
          : "Loading county geometry into the map…"}
      </p>
      <div className={props.dual ? "geo-map-pair" : "geo-map-single"}>
        <section aria-label="Review priority map">
          <h3>County review priority</h3>
          <div
            className="geo-map-canvas"
            ref={first}
            aria-label="Interactive county review priority map"
          />
          <p>
            County colors follow the released priority categories. Exact
            category labels appear in the table.
          </p>
          <div className="geo-priority-legend">
            {[
              ...new Map(
                props.counties.map((county) => [county.priority, county.color])
              ).entries(),
            ].map(([priority, color]) => (
              <span key={priority}>
                <i style={{ background: color }} />
                {priority}
              </span>
            ))}
          </div>
        </section>
        {props.dual && (
          <section aria-label="Evidence completeness map">
            <h3>Evidence completeness</h3>
            <div
              className="geo-map-canvas"
              ref={second}
              aria-label="Interactive county evidence completeness map"
            />
            <p>
              0% <span className="geo-completeness-ramp" /> {props.maximum}% ·
              darker means more scored inputs available.
            </p>
          </section>
        )}
      </div>
      <p>
        Only matching counties are colored. Blank geography is outside the
        displayed results, not zero. Use the county table for keyboard selection
        and exact values.
      </p>
    </div>
  );
}

function mapData(props: Props): GeoJSON.FeatureCollection {
  const byFips = new Map(props.counties.map((county) => [county.fips, county]));
  return {
    type: "FeatureCollection",
    features: props.geometry.features.flatMap((feature) => {
      const county = byFips.get(String(feature.properties?.fips));
      return county
        ? [
            {
              ...feature,
              properties: {
                fips: county.fips,
                color: county.color,
                completeness: county.evidence_completeness,
              },
            },
          ]
        : [];
    }),
  };
}

function refresh(maps: LibreMap[], props: Props) {
  const data = mapData(props);
  for (const [index, map] of maps.entries()) {
    const source = map.getSource("counties") as GeoJSONSource | undefined;
    if (!source || !map.getLayer("county-selection")) continue;
    source.setData(data);
    map.setFilter("county-selection", [
      "==",
      ["get", "fips"],
      props.selectedFips,
    ]);
    if (index === 1)
      map.setPaintProperty("county-fill", "fill-color", [
        "interpolate",
        ["linear"],
        ["get", "completeness"],
        0,
        "#dff1eb",
        props.maximum,
        "#075760",
      ]);
  }
}
