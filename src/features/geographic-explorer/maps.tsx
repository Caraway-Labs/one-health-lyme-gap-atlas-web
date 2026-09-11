"use client";

import { useRef, useState } from "react";

import {
  AtlasMap,
  type AtlasMapCamera,
  type AtlasMapFillColor,
  type AtlasMapHandle,
} from "@/components/atlas-map";
import { Button } from "@/components/ui/button";
import type { CountyScoreSummary } from "@/generated/models";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

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
  const first = useRef<AtlasMapHandle>(null);
  const second = useRef<AtlasMapHandle>(null);
  const syncing = useRef(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(0);

  const syncFrom = (origin: "first" | "second", camera: AtlasMapCamera) => {
    if (syncing.current) {
      return;
    }
    syncing.current = true;
    try {
      const target = origin === "first" ? second : first;
      target.current?.getMap()?.jumpTo(camera);
    } finally {
      syncing.current = false;
    }
  };

  return (
    <div>
      {failed && (
        <p role="alert">
          The map could not render. All county values remain available in the
          evidence table.{" "}
          <Button
            {...analyticsControlAttributes("geo_retry_maps")}
            variant="secondary"
            onClick={props.onRetry}
          >
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
          <AtlasMap
            ref={first}
            className="geo-map-canvas"
            ariaLabel="Interactive county review priority map"
            containerRole="none"
            geometry={props.geometry as never}
            scores={props.counties}
            selectedFips={props.selectedFips}
            showOverlays={false}
            includeUnscoredCounties={false}
            onSelect={(fips) => props.onSelect(fips)}
            onMove={(camera) => syncFrom("first", camera)}
            onIdle={() => setReady((count) => count + 1)}
            onError={() => setFailed(true)}
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
            <AtlasMap
              ref={second}
              className="geo-map-canvas"
              ariaLabel="Interactive county evidence completeness map"
              containerRole="none"
              geometry={props.geometry as never}
              scores={props.counties}
              selectedFips={props.selectedFips}
              showOverlays={false}
              includeUnscoredCounties={false}
              fillColor={
                [
                  "interpolate",
                  ["linear"],
                  ["get", "completeness"],
                  0,
                  "#dff1eb",
                  props.maximum,
                  "#075760",
                ] as AtlasMapFillColor
              }
              onSelect={(fips) => props.onSelect(fips)}
              onMove={(camera) => syncFrom("second", camera)}
              onIdle={() => setReady((count) => count + 1)}
              onError={() => setFailed(true)}
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
