"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";

import type { AtlasMapCounty } from "@/components/atlas-map";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import type { ExploreCommittedSelection } from "@/features/ux-reset/explore/explore-model";
import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

const AtlasMap = dynamic(
  async () => {
    const mapModule = await import("@/components/atlas-map");
    return mapModule.AtlasMap;
  },
  {
    loading: () => (
      <AtlasStatusMessage className="map-loading" tone="loading">
        Loading map…
      </AtlasStatusMessage>
    ),
    ssr: false,
  }
);

const MAP_RAMP_VARIABLES = [
  "--map-ramp-1",
  "--map-ramp-2",
  "--map-ramp-3",
  "--map-ramp-4",
  "--map-ramp-5",
  "--map-ramp-6",
] as const;

type ExploreRampColors = {
  neutral: string;
  ramp: string[];
};

type StyleColorSource = Pick<CSSStyleDeclaration, "getPropertyValue">;

export function readExploreRampColors(
  styles: StyleColorSource
): ExploreRampColors {
  const ramp: string[] = [];
  for (const variableName of MAP_RAMP_VARIABLES) {
    const value = styles.getPropertyValue(variableName).trim();
    ramp.push(value || `var(${variableName})`);
  }
  const neutral = styles.getPropertyValue("--muted").trim();
  return {
    neutral: neutral || "var(--muted)",
    ramp,
  };
}

function paintCounties(
  selection: ExploreCommittedSelection,
  colors: ExploreRampColors
): AtlasMapCounty[] {
  const painted: AtlasMapCounty[] = [];
  for (const row of selection.rows) {
    const rampColor =
      row.choroplethBin === "neutral"
        ? colors.neutral
        : (colors.ramp[row.choroplethBin] ?? colors.neutral);
    painted.push({
      color: rampColor,
      county: row.countyName,
      fips: row.fips,
      state: row.state,
    });
  }
  return painted;
}

function ExploreMapFrame({
  children,
  measureId,
}: {
  children: ReactNode;
  measureId: string;
}) {
  return (
    <div
      className="map-wrap"
      data-measure-id={measureId}
      data-testid="explore-map-region"
    >
      {children}
    </div>
  );
}

function ExploreMapUnavailable({
  measureId,
  onRetry,
}: {
  measureId: string;
  onRetry: () => void;
}) {
  return (
    <ExploreMapFrame measureId={measureId}>
      <div data-testid="explore-map-fallback">
        <AtlasStatusMessage
          action={
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry map
            </Button>
          }
          className="map-loading"
          title="Map unavailable"
          titleAs="p"
          tone="error"
        >
          <p>
            County values, availability, and the Investigate and Compare actions
            remain available without the map.
          </p>
        </AtlasStatusMessage>
      </div>
    </ExploreMapFrame>
  );
}

type ExploreMapPanelProps = {
  committed: ExploreCommittedSelection | null;
  geometry: CountyDisplayGeometryFeatureCollection | null;
  geometryError: boolean;
  geometryLoading: boolean;
  geometryReleaseId: string | null;
  onRetryGeometry: () => void;
  onSelectCounty: (fips: string) => void;
  selectedFips: string;
};

export function ExploreMapPanel({
  committed,
  geometry,
  geometryError,
  geometryLoading,
  geometryReleaseId,
  onRetryGeometry,
  onSelectCounty,
  selectedFips,
}: ExploreMapPanelProps) {
  const [renderFailed, setRenderFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const colors = useMemo(
    () =>
      readExploreRampColors(
        typeof document === "undefined"
          ? { getPropertyValue: () => "" }
          : getComputedStyle(document.documentElement)
      ),
    []
  );
  const paint = useMemo(
    () => (committed ? paintCounties(committed, colors) : []),
    [colors, committed]
  );
  const geometryMatchesSelection = Boolean(
    committed &&
    geometry &&
    geometryReleaseId &&
    geometryReleaseId === committed.releaseId
  );
  const showMap = geometryMatchesSelection && !geometryError && !renderFailed;
  const retryMap = () => {
    setRenderFailed(false);
    setAttempt((value) => value + 1);
    onRetryGeometry();
  };

  if (geometryError || renderFailed) {
    return (
      <ExploreMapUnavailable
        measureId={committed?.measureId ?? ""}
        onRetry={retryMap}
      />
    );
  }

  if (!showMap) {
    if (geometryLoading || !committed) {
      return (
        <ExploreMapFrame measureId={committed?.measureId ?? ""}>
          <AtlasStatusMessage className="map-loading" tone="loading">
            {committed ? "Loading display geometry…" : "Loading map…"}
          </AtlasStatusMessage>
        </ExploreMapFrame>
      );
    }
    return (
      <ExploreMapUnavailable
        measureId={committed.measureId}
        onRetry={retryMap}
      />
    );
  }

  if (!geometry || !committed) {
    return (
      <ExploreMapFrame measureId={committed?.measureId ?? ""}>
        <AtlasStatusMessage className="map-loading" tone="loading">
          Loading display geometry…
        </AtlasStatusMessage>
      </ExploreMapFrame>
    );
  }

  return (
    <ExploreMapFrame measureId={committed.measureId}>
      <AtlasMap
        key={attempt}
        ariaLabel={`Map of ${committed.measureLabel}. Colors show governed measure values. Use the county table for keyboard selection.`}
        cameraFrameState={
          committed.mapScope === "ALL" ? null : committed.mapScope
        }
        resetNationalView={committed.mapScope === "ALL"}
        geometry={geometry}
        includeUnscoredCounties
        scores={paint}
        selectedFips={selectedFips}
        selectedState={committed.mapScope}
        showOverlays={false}
        onError={() => setRenderFailed(true)}
        onSelect={(fips) => onSelectCounty(fips)}
      />
    </ExploreMapFrame>
  );
}
