"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { AtlasMapLegend } from "@/components/atlas-map-legend";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { RankedCounties } from "@/components/ranked-counties";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CountyScoreSummary } from "@/generated/models";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
} from "@/lib/county-geography";
import { useQuery } from "@tanstack/react-query";

const AtlasMap = dynamic(
  () => import("@/components/atlas-map").then((mod) => mod.AtlasMap),
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
  const [selectedFips, setSelectedFips] = useState(
    () => rankedCounties[0]?.fips ?? ""
  );
  const [showTable, setShowTable] = useState(false);

  const geometryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async () => fetchCountyDisplayGeometry(releaseId),
    queryKey: countyDisplayGeometryQueryKey("atlas-home", releaseId),
    staleTime: Infinity,
  });

  return (
    <div className="ux-reset-review-state-layout" data-testid="review-state-panel">
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
        <div className="map-wrap">
          {geometryQuery.data && rankedCounties.length > 0 ? (
            <AtlasMap
              geometry={geometryQuery.data as never}
              scores={[...mapCounties]}
              selectedFips={selectedFips}
              selectedState={scopeCode}
              onSelect={(fips) => setSelectedFips(fips)}
            />
          ) : (
            <AtlasStatusMessage className="map-loading" tone="loading">
              Loading map…
            </AtlasStatusMessage>
          )}
        </div>
        <AtlasMapLegend caption={`Map framed for ${scopeCode} counties in this release.`} />
      </Card>
      <RankedCounties
        counties={[...rankedCounties]}
        selectedFips={selectedFips}
        showTable={showTable}
        onSelect={(fips) => setSelectedFips(fips)}
        onToggleTable={() => setShowTable((value) => !value)}
      />
    </div>
  );
}
