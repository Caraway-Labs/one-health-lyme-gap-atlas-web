"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import { AtlasMapLegend } from "@/components/atlas-map-legend";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { RankedCounties } from "@/components/ranked-counties";
import { ResultsTable } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CountyScoreSummary } from "@/generated/models";
import type { GeographySelectionSurface } from "@/lib/atlas-analytics";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
} from "@/lib/county-geography";

const AtlasMap = dynamic(
  async () => {
    const mod = await import("@/components/atlas-map");
    return mod.AtlasMap;
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

type ReviewStatePanelProps = {
  scopeCode: string;
  rankedCounties: readonly CountyScoreSummary[];
  mapCounties: readonly CountyScoreSummary[];
  releaseId: string;
};

export function ReviewStatePanel({
  scopeCode,
  rankedCounties,
  mapCounties,
  releaseId,
}: ReviewStatePanelProps) {
  const inScopeFips = useMemo(
    () => new Set(rankedCounties.map((county) => county.fips)),
    [rankedCounties]
  );
  const [pickedFips, setPickedFips] = useState("");
  const [showTable, setShowTable] = useState(false);
  const selectedFips = useMemo(() => {
    if (pickedFips && inScopeFips.has(pickedFips)) {
      return pickedFips;
    }
    return rankedCounties[0]?.fips ?? "";
  }, [inScopeFips, pickedFips, rankedCounties]);

  const geometryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async () => fetchCountyDisplayGeometry(releaseId),
    queryKey: countyDisplayGeometryQueryKey("atlas-home", releaseId),
    staleTime: Infinity,
  });

  const selectCounty = useCallback(
    (fips: string, _surface: GeographySelectionSurface) => {
      if (!inScopeFips.has(fips)) {
        return;
      }
      setPickedFips(fips);
    },
    [inScopeFips]
  );

  const mapScores = useMemo(() => [...mapCounties], [mapCounties]);
  const geometryError = Boolean(geometryQuery.isError);
  const geometryReady = Boolean(geometryQuery.data);
  const hasCounties = rankedCounties.length > 0;

  return (
    <div
      className="ux-reset-review-state-layout"
      data-testid="review-state-panel"
    >
      <Card className="map-card gap-0 py-0">
        <AtlasSectionHeader
          aside={
            <Badge className="map-scope h-auto" variant="secondary">
              {scopeCode} counties
            </Badge>
          }
          className="card-title-row"
          eyebrow="State review scope"
          headingLevel="h2"
          title="County review priority in this state"
        />
        <div className="map-wrap" data-testid="review-state-map-region">
          {geometryReady && hasCounties ? (
            <AtlasMap
              geometry={geometryQuery.data as never}
              scores={mapScores}
              selectedFips={selectedFips}
              selectedState={scopeCode}
              onSelect={selectCounty}
            />
          ) : geometryError ? (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-error"
              tone="error"
            >
              <p>
                The map is temporarily unavailable. Use the county list or table
                to inspect the same findings.
              </p>
            </AtlasStatusMessage>
          ) : !hasCounties && !geometryQuery.isPending ? (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-empty"
              tone="empty"
            >
              <p>No counties in this state match the current release scope.</p>
            </AtlasStatusMessage>
          ) : (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-loading"
              tone="loading"
            >
              Loading map…
            </AtlasStatusMessage>
          )}
        </div>
        <AtlasMapLegend
          caption={`Map framed for ${scopeCode} counties in this release.`}
        />
      </Card>
      <RankedCounties
        counties={[...rankedCounties]}
        selectedFips={selectedFips}
        showTable={showTable}
        onSelect={selectCounty}
        onToggleTable={() => setShowTable((value) => !value)}
      />
      {showTable ? (
        <ResultsTable
          counties={[...rankedCounties]}
          onSelect={(fips) => selectCounty(fips, "results_table")}
        />
      ) : null}
    </div>
  );
}
