"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AtlasMapLegend } from "@/components/atlas-map-legend";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import {
  RANKED_COUNTY_SHORTLIST_LENGTH,
  RankedCounties,
} from "@/components/ranked-counties";
import { ResultsTable } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import {
  buildReviewCompareHandoff,
  buildReviewInvestigateHandoff,
  reviewPreviewForSelection,
} from "@/features/ux-reset/review/review-county-preview";
import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";
import {
  consumeReviewReturnFocus,
  markReviewReturnFocus,
  reviewReturnFocusMatches,
} from "@/features/ux-reset/review/review-return-focus";
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

type ReviewCountyHistory = "push" | "replace";

type ReviewStatePanelProps = {
  scopeCode: string;
  rankedCounties: readonly CountyScoreSummary[];
  mapCounties: readonly CountyScoreSummary[];
  county?: string | null;
  onCountyChange?: (fips: string, history: ReviewCountyHistory) => void;
  period?: string | null;
  releaseId: string;
};

export function ReviewStatePanel({
  scopeCode,
  rankedCounties,
  mapCounties,
  county = null,
  onCountyChange,
  period = null,
  releaseId,
}: ReviewStatePanelProps) {
  const inScopeFips = useMemo(
    () => new Set(rankedCounties.map((entry) => entry.fips)),
    [rankedCounties]
  );
  const [showTableOverride, setShowTableOverride] = useState<boolean | null>(
    null
  );
  const [latchedReturnFips, setLatchedReturnFips] = useState<string | null>(
    null
  );
  // The URL county is the selection, including after Back or Forward.
  const selectedFips = useMemo(() => {
    if (county && inScopeFips.has(county)) {
      return county;
    }
    return rankedCounties[0]?.fips ?? "";
  }, [county, inScopeFips, rankedCounties]);
  usePublishExploreCommittedNavigation(
    selectedFips
      ? {
          county: selectedFips,
          dataset: releaseId,
          period,
        }
      : null
  );
  useEffect(() => {
    if ((county && inScopeFips.has(county)) || !selectedFips) {
      return;
    }
    onCountyChange?.(selectedFips, "replace");
  }, [county, inScopeFips, onCountyChange, selectedFips]);

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
      onCountyChange?.(fips, "push");
    },
    [inScopeFips, onCountyChange]
  );
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const layoutRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLAnchorElement>(null);
  const preview = reviewPreviewForSelection({
    counties: rankedCounties,
    response: null,
    selectedFips,
  });
  const handoff = useMemo(() => {
    if (!selectedFips) {
      return null;
    }
    const source = {
      period,
      releaseId,
      scopeCode,
      searchParams: new URLSearchParams(searchKey),
      selectedFips,
    };
    return {
      compareHref: buildReviewCompareHandoff(source),
      ...buildReviewInvestigateHandoff(source),
    };
  }, [period, releaseId, scopeCode, searchKey, selectedFips]);
  const selectedRank = rankedCounties.findIndex(
    (county) => county.fips === selectedFips
  );
  const returnFocusMatches =
    /^\d{5}$/.test(selectedFips) && reviewReturnFocusMatches(selectedFips);
  if (returnFocusMatches && latchedReturnFips !== selectedFips) {
    setLatchedReturnFips(selectedFips);
  } else if (
    !returnFocusMatches &&
    latchedReturnFips !== null &&
    latchedReturnFips !== selectedFips
  ) {
    setLatchedReturnFips(null);
  }
  const focusReturnedCounty =
    returnFocusMatches || latchedReturnFips === selectedFips;
  const showTable =
    showTableOverride ??
    (focusReturnedCounty && selectedRank >= RANKED_COUNTY_SHORTLIST_LENGTH);
  useLayoutEffect(() => {
    if (!/^\d{5}$/.test(selectedFips)) {
      return;
    }
    const root = layoutRef.current;
    const row = root?.querySelector<HTMLButtonElement>(
      `.rank-row.active[data-fips="${selectedFips}"]`
    );
    if (row) {
      const list = row.closest(".rank-list");
      if (list instanceof HTMLElement) {
        const rowBox = row.getBoundingClientRect();
        const listBox = list.getBoundingClientRect();
        const visible =
          rowBox.top >= listBox.top && rowBox.bottom <= listBox.bottom;
        if (!visible) {
          row.scrollIntoView({ block: "nearest" });
        }
      }
    }
    if (!focusReturnedCounty) {
      return;
    }
    if (row) {
      row.focus({ preventScroll: true });
    } else {
      const tableControl = root?.querySelector<HTMLButtonElement>(
        `.full-table button[data-fips="${selectedFips}"]`
      );
      if (tableControl) {
        const scroller = tableControl.closest(".table-scroll");
        if (scroller instanceof HTMLElement) {
          const rowBox = tableControl.getBoundingClientRect();
          const listBox = scroller.getBoundingClientRect();
          const visible =
            rowBox.top >= listBox.top && rowBox.bottom <= listBox.bottom;
          if (!visible) {
            tableControl.scrollIntoView({ block: "nearest" });
          }
        }
        tableControl.focus({ preventScroll: true });
      } else {
        openRef.current?.focus({ preventScroll: true });
      }
    }
    consumeReviewReturnFocus(selectedFips);
  }, [focusReturnedCounty, selectedFips]);
  const mapScores = useMemo(() => [...mapCounties], [mapCounties]);
  const geometryError = Boolean(geometryQuery.isError);
  const geometryReady = Boolean(geometryQuery.data);
  const hasCounties = rankedCounties.length > 0;

  return (
    <div
      ref={layoutRef}
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
              cameraFrameState={scopeCode}
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
      {preview && handoff ? (
        <ReviewCountyPreviewPanel
          compareHref={handoff.compareHref}
          droppedNotes={handoff.droppedNotes}
          href={handoff.href}
          openRef={openRef}
          preview={preview}
          releaseId={releaseId}
          onOpen={markReviewReturnFocus}
        />
      ) : null}
      <RankedCounties
        counties={[...rankedCounties]}
        selectedFips={selectedFips}
        showTable={showTable}
        onSelect={selectCounty}
        onToggleTable={() =>
          setShowTableOverride((current) => !(current ?? showTable))
        }
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
