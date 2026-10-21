"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AtlasMap } from "@/components/atlas-map";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { KnownEmptySelectionNotice } from "@/features/ux-reset/observations/known-empty-selection-notice";
import { COUNTY_BOUNDARIES_FILL } from "@/features/ux-reset/review/county-boundaries-palette";
import { DownloadCountyPdfButton } from "@/features/ux-reset/review/download-county-pdf-button";
import {
  countyPassesAvailableData,
  EXPLORER_AVAILABLE_DATA_EMPTY,
  EXPLORER_AVAILABLE_DATA_ERROR,
  EXPLORER_AVAILABLE_DATA_LOADING,
  EXPLORER_AVAILABLE_DATA_OPEN,
  type ExplorerAvailableDataGate,
  type ExplorerCountyReference,
} from "@/features/ux-reset/review/explorer-county-reference";
import { ExplorerLowerWorkspace } from "@/features/ux-reset/review/explorer-lower-workspace";
import {
  ExplorerMapSectionHeader,
  ExplorerMapSourceCaption,
} from "@/features/ux-reset/review/explorer-map-chrome";
import { explorerMapDrillAction } from "@/features/ux-reset/review/explorer-map-focus";
import {
  ExplorerMapLayerAvailability,
  ExplorerMapLayerControl,
} from "@/features/ux-reset/review/explorer-map-layer-control";
import {
  completenessLayerGate,
  explorerMapLayerById,
  explorerMapLayerGates,
  isExplorerObservationLayer,
  explorerUnpaintedFillColor,
  paintExplorerMapLayer,
  resolveExplorerMapColor,
  type ExplorerMapLayerId,
  type ExplorerMapLegendSource,
} from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import {
  explorerMapFrameReady,
  explorerMapLoadingMode,
  explorerMapPaintRevision,
  explorerMapRenderedFrameSignature,
  explorerScoresLoadStatus,
} from "@/features/ux-reset/review/explorer-map-loading";
import {
  ExplorerMapLoadingOverlay,
  ExplorerMapSurface,
} from "@/features/ux-reset/review/explorer-map-loading-overlay";
import {
  boundExplorerNationalCounties,
  EXPLORER_NATIONAL_COUNTY_SHORTLIST_LENGTH,
  rankExplorerCounties,
  type ExplorerRankSource,
} from "@/features/ux-reset/review/explorer-ranked-counties";
import { ExplorerRankedCountyList } from "@/features/ux-reset/review/explorer-ranked-county-list";
import {
  SCENARIO_SCORE_DEFAULTS,
  adjustCountyScenarios,
  scoreSettingsFromCollection,
} from "@/features/ux-reset/review/explorer-scenario-score";
import {
  applyGapScoreScenarioColors,
  scenarioGapScoreLegend,
} from "@/features/ux-reset/review/explorer-what-if-scenario";
import {
  buildReviewCompareHandoff,
  buildReviewInvestigateHandoff,
} from "@/features/ux-reset/review/review-county-preview";
import { ReviewPublishedCountyPreview } from "@/features/ux-reset/review/review-published-county-preview";
import { markReviewReturnFocus } from "@/features/ux-reset/review/review-return-focus";
import {
  isLower48CountyFips,
  isLower48ReviewScope,
  postalCodeForStateFips,
} from "@/features/ux-reset/review/review-state-fips";
import { RURALITY_NO_DATA_COLOR } from "@/features/ux-reset/review/rurality-palette";
import {
  useExplorerMapLoadingPresentation,
  useExplorerMapPaintSettlement,
  usePublishedExplorerMapFrame,
} from "@/features/ux-reset/review/use-explorer-map-loading";
import {
  knownEmptyMapSelection,
  observationGate,
  observationPaintState,
  useExplorerMapObservations,
} from "@/features/ux-reset/review/use-explorer-map-observations";
import { useExplorerMapScores } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { isContiguousUsCounty } from "@/lib/atlas-geometry";
import type { ScoreSettings } from "@/lib/atlas-ui";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
} from "@/lib/county-geography";

const NO_PUBLISHED_VALUE_TOKEN = "--explorer-boundary";
const NO_LEGEND_SOURCES: readonly ExplorerMapLegendSource[] = [];

type ReviewNationalPictureProps = {
  availableDataGate?: ExplorerAvailableDataGate;
  counties: readonly ExplorerCountyReference[];
  countiesError: boolean;
  countiesLoading: boolean;
  county: string | null;
  countyQuery: string;
  mapFocus?: string | null;
  mapLayer: ExplorerMapLayerId;
  onCountyChange: (fips: string | null, history: "push" | "replace") => void;
  onMapFocusChange?: (state: string | null) => void;
  onMapLayerChange: (layerId: ExplorerMapLayerId) => void;
  /** Clears geographic scope in the URL. The map still refits locally. */
  onReturnToUsView?: () => void;
  onViewCountyEvidence?: (fips: string) => void;
  period: string | null;
  releaseId: string;
  /** Browser what-if. Defaults leave governed county colors in place. */
  scenarioSettings?: ScoreSettings;
  sources?: readonly ExplorerMapLegendSource[];
  tierRelease: Tier1ActiveRelease;
};

function noPublishedValueColor(): string | undefined {
  return resolveExplorerMapColor(`var(${NO_PUBLISHED_VALUE_TOKEN})`);
}

function postalForFips(fips: string): string | null {
  if (!isLower48CountyFips(fips)) {
    return null;
  }
  const postal = postalCodeForStateFips(fips.slice(0, 2));
  return postal && isLower48ReviewScope(postal) ? postal : null;
}

export function ReviewNationalPicture({
  availableDataGate = EXPLORER_AVAILABLE_DATA_OPEN,
  counties,
  countiesError,
  countiesLoading,
  county,
  countyQuery,
  mapFocus: controlledMapFocus = null,
  mapLayer,
  onCountyChange,
  onMapFocusChange,
  onMapLayerChange,
  onReturnToUsView,
  period,
  releaseId,
  scenarioSettings = SCENARIO_SCORE_DEFAULTS,
  sources = NO_LEGEND_SOURCES,
  tierRelease,
  onViewCountyEvidence,
}: ReviewNationalPictureProps) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const selectedFips = county && isLower48CountyFips(county) ? county : "";
  const countyPostal = selectedFips ? postalForFips(selectedFips) : null;
  const [trackedCounty, setTrackedCounty] = useState(selectedFips);
  const [pickedState, setPickedState] = useState<string | null>(null);
  if (selectedFips !== trackedCounty) {
    setTrackedCounty(selectedFips);
  }
  const mapFocus = onMapFocusChange ? controlledMapFocus : pickedState;
  const listState = mapFocus;
  const browseState = mapFocus ?? countyPostal;
  const [fitSignal, setFitSignal] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const geometryQuery = useQuery({
    queryFn: () => fetchCountyDisplayGeometry(releaseId),
    queryKey: countyDisplayGeometryQueryKey("atlas-home", releaseId),
    staleTime: Infinity,
  });
  const scoresQuery = useExplorerMapScores(releaseId);
  const geometryStatus = geometryQuery.isPending
    ? "loading"
    : geometryQuery.isError
      ? "error"
      : "ready";
  const observations = useExplorerMapObservations({
    activeLayerId: mapLayer,
    fips:
      geometryQuery.data?.features.map((feature) => feature.properties.fips) ??
      [],
    geometryStatus,
    releaseId,
  });
  const knownEmptySelection = knownEmptyMapSelection(observations, mapLayer);
  const layer = explorerMapLayerById(mapLayer);
  const scoreCounties = useMemo(
    () =>
      (scoresQuery.data?.counties ?? []).filter(
        (entry) =>
          isLower48ReviewScope(entry.state) && isLower48CountyFips(entry.fips)
      ),
    [scoresQuery.data?.counties]
  );
  const scenarioBaseline = useMemo(
    () => scoreSettingsFromCollection(scoresQuery.data?.settings),
    [scoresQuery.data?.settings]
  );
  const scenarioByFips = useMemo(
    () =>
      adjustCountyScenarios(scoreCounties, scenarioSettings, scenarioBaseline),
    [scenarioBaseline, scenarioSettings, scoreCounties]
  );
  const scoresStatus = layer.needsScores
    ? explorerScoresLoadStatus({
        data: scoresQuery.data,
        isError: scoresQuery.isError,
        isFetching: scoresQuery.isFetching,
        isPending: scoresQuery.isPending,
      })
    : "ready";
  const completenessGate = useMemo(
    () =>
      completenessLayerGate({
        counties: scoreCounties,
        scoresStatus: explorerScoresLoadStatus({
          data: scoresQuery.data,
          isError: scoresQuery.isError,
          isFetching: scoresQuery.isFetching,
          isPending: scoresQuery.isPending,
        }),
      }),
    [
      scoreCounties,
      scoresQuery.data,
      scoresQuery.isError,
      scoresQuery.isFetching,
      scoresQuery.isPending,
    ]
  );
  const layerGates = useMemo(
    () =>
      explorerMapLayerGates({
        completeness: completenessGate,
        observations: {
          incidence_floor: observationGate(observations.incidence_floor),
          rurality: observationGate(observations.rurality),
          svi: observationGate(observations.svi),
          uninsured: observationGate(observations.uninsured),
        },
      }),
    [completenessGate, observations]
  );
  const mapPaint = useMemo(() => {
    const scenarioColors = scenarioByFips !== null && layer.id === "gap_score";
    const colored = scenarioColors
      ? applyGapScoreScenarioColors(scoreCounties, scenarioByFips)
      : null;
    const paint = paintExplorerMapLayer({
      counties: colored?.counties ?? scoreCounties,
      layerId: layer.id,
      observation: isExplorerObservationLayer(layer.id)
        ? observationPaintState(observations[layer.id])
        : null,
      releaseId,
      scoresStatus,
      selectedFips,
      sources,
    });
    const legend =
      colored && scoresStatus === "ready"
        ? scenarioGapScoreLegend(colored)
        : null;
    if (!legend) {
      return paint;
    }
    return { ...paint, ...legend };
  }, [
    layer.id,
    observations,
    releaseId,
    scenarioByFips,
    scoreCounties,
    scoresStatus,
    selectedFips,
    sources,
  ]);
  const geometryFeatures = useMemo(
    () =>
      (geometryQuery.data?.features ?? []).filter(
        (feature) =>
          isContiguousUsCounty(feature.properties.fips) &&
          isLower48CountyFips(feature.properties.fips)
      ),
    [geometryQuery.data]
  );
  const unpaintedCountyColor = resolveExplorerMapColor(
    explorerUnpaintedFillColor(mapPaint)
  );
  const mapCounties = useMemo(() => {
    const awaitingLayer = mapPaint.kind === "loading";
    // Gray means a governed rurality response omitted a county. A failed
    // load stays on the boundary color so it is not read as No data.
    // Social vulnerability uses its own no-data gray from the legend entry.
    const missingColor =
      mapPaint.layerId === "boundaries"
        ? COUNTY_BOUNDARIES_FILL
        : mapPaint.layerId === "rurality" && mapPaint.kind === "categorical"
          ? RURALITY_NO_DATA_COLOR
          : (unpaintedCountyColor ?? noPublishedValueColor());
    return geometryFeatures.flatMap((feature) => {
      const fips = feature.properties.fips;
      const state = postalForFips(fips);
      if (!state) {
        return [];
      }
      if (
        availableDataGate.kind === "ready" &&
        !availableDataGate.fips.has(fips)
      ) {
        return [];
      }
      if (
        availableDataGate.kind === "loading" ||
        availableDataGate.kind === "error"
      ) {
        return [];
      }
      const painted = resolveExplorerMapColor(mapPaint.colorsByFips.get(fips));
      return [
        {
          color: awaitingLayer ? undefined : (painted ?? missingColor),
          fips,
          state,
        },
      ];
    });
  }, [
    availableDataGate,
    geometryFeatures,
    mapPaint.colorsByFips,
    mapPaint.kind,
    mapPaint.layerId,
    unpaintedCountyColor,
  ]);
  const identityByFips = useMemo(() => {
    const identities = new Map<string, ExploreCountyIdentity>();
    for (const entry of counties) {
      if (!isLower48CountyFips(entry.fips)) {
        continue;
      }
      identities.set(entry.fips, {
        county: entry.county,
        fips: entry.fips,
        state: entry.state,
        stateName: entry.stateName,
      });
    }
    for (const entry of scoreCounties) {
      if (identities.has(entry.fips)) {
        continue;
      }
      identities.set(entry.fips, {
        county: entry.county.trim() || `County ${entry.fips}`,
        fips: entry.fips,
        state: entry.state,
        stateName: entry.state_name.trim() || entry.state,
      });
    }
    return identities;
  }, [counties, scoreCounties]);
  const rankedList = useMemo(() => {
    const byFips = new Map<string, ExplorerRankSource>();
    for (const entry of counties) {
      if (!isLower48CountyFips(entry.fips)) {
        continue;
      }
      if (listState && entry.state !== listState) {
        continue;
      }
      byFips.set(entry.fips, {
        county: entry.county,
        fips: entry.fips,
        score: null,
        state: entry.state,
      });
    }
    for (const entry of scoreCounties) {
      if (listState && entry.state !== listState) {
        continue;
      }
      const existing = byFips.get(entry.fips);
      const score = entry.in_contiguous_tick_scope ? entry.score.score : null;
      byFips.set(entry.fips, {
        color: score === null ? null : entry.color,
        county: existing?.county || entry.county,
        fips: entry.fips,
        score,
        state: entry.state,
      });
    }
    if (!listState) {
      for (const [fips, source] of byFips) {
        if (source.score === null) {
          byFips.delete(fips);
        }
      }
    }
    const visibleFips =
      availableDataGate.kind === "open"
        ? null
        : new Set(
            [...byFips.keys()].filter((fips) =>
              countyPassesAvailableData(availableDataGate, fips)
            )
          );
    const ranked = rankExplorerCounties([...byFips.values()], {
      query: countyQuery,
      visibleFips,
    });
    if (listState) {
      return { rows: ranked, truncated: false };
    }
    return boundExplorerNationalCounties(ranked, selectedFips);
  }, [
    availableDataGate,
    counties,
    countyQuery,
    listState,
    scoreCounties,
    selectedFips,
  ]);
  const rankedRows = rankedList.rows;
  const identityFor = (fips: string): ExploreCountyIdentity | null =>
    identityByFips.get(fips) ?? null;
  const selectedIdentity = selectedFips ? identityFor(selectedFips) : null;
  usePublishExploreCommittedNavigation({
    county: selectedFips || null,
    dataset: releaseId,
    period,
  });
  const handoff = useMemo(() => {
    if (!selectedFips) {
      return null;
    }
    const source = {
      period,
      releaseId,
      scopeCode: "ALL",
      searchParams: new URLSearchParams(searchKey),
      selectedFips,
    };
    return {
      compareHref: buildReviewCompareHandoff(source),
      ...buildReviewInvestigateHandoff(source),
    };
  }, [period, releaseId, searchKey, selectedFips]);

  const chooseState = (next: string) => {
    if (!isLower48ReviewScope(next)) {
      return;
    }
    if (onMapFocusChange) {
      onMapFocusChange(next);
      return;
    }
    setPickedState(next);
    if (selectedFips && postalForFips(selectedFips) !== next) {
      onCountyChange(null, "push");
    }
  };
  const returnToNationalExtent = () => {
    setFitSignal((value) => value + 1);
    if (onMapFocusChange) {
      onMapFocusChange(null);
      return;
    }
    setPickedState(null);
  };
  const returnToUsView = () => {
    // A focused state already refits when the frame clears. Bumping the fit
    // signal in that same turn would fit the state that is about to leave.
    if (mapFocus === null) {
      setFitSignal((value) => value + 1);
    }
    if (onReturnToUsView) {
      onReturnToUsView();
      return;
    }
    onCountyChange(null, "push");
    if (onMapFocusChange) {
      onMapFocusChange(null);
      return;
    }
    setPickedState(null);
  };
  const chooseCounty = (fips: string) => {
    const postal = postalForFips(fips);
    if (!postal || !identityFor(fips)) {
      return;
    }
    if (!countyPassesAvailableData(availableDataGate, fips)) {
      return;
    }
    onCountyChange(fips, "push");
  };

  const geometryError = geometryQuery.isError;
  const geometryPending = geometryQuery.isPending;
  const valuesPending = layer.needsScores && scoresStatus === "loading";
  const paintRevision = explorerMapPaintRevision({
    frameReady: explorerMapFrameReady({
      availableDataKind: availableDataGate.kind,
      geometryFailed: geometryError,
      geometryPending,
      geometryPresent: Boolean(geometryQuery.data),
    }),
    frameSignature: explorerMapRenderedFrameSignature(mapCounties),
    layerId: mapPaint.layerId,
    paintKind: mapPaint.kind,
    releaseId,
    scope: "US",
  });
  const publishedMap = usePublishedExplorerMapFrame(paintRevision, mapCounties);
  const { onPaintSettled, settledRevision } = useExplorerMapPaintSettlement(
    publishedMap.revision
  );
  const queryClient = useQueryClient();
  const activeObservation = isExplorerObservationLayer(mapLayer)
    ? observations[mapLayer]
    : null;
  const layerFailed =
    activeObservation?.status === "error" ||
    (layer.needsScores && scoresQuery.isError && !scoresQuery.isFetching);
  const mapLoading = useExplorerMapLoadingPresentation({
    mode: explorerMapLoadingMode({
      confirmedEmptyFrame: paintRevision !== null && mapCounties.length === 0,
      deferToOtherLoader:
        availableDataGate.kind === "loading" ||
        availableDataGate.kind === "error",
      geometryFailed: geometryError,
      geometryPending,
      layerFailed,
      mapFailed,
      paintKind: mapPaint.kind,
      publishedRevision: publishedMap.revision,
      settledRevision,
    }),
    requestKey: `US:${releaseId}:${mapLayer}`,
  });
  const retryMapLayer = useCallback(() => {
    if (mapFailed) {
      setMapFailed(false);
      return;
    }
    if (isExplorerObservationLayer(mapLayer)) {
      void queryClient.refetchQueries({
        queryKey: ["ux-reset-explorer-map-observations", releaseId, mapLayer],
      });
      return;
    }
    if (layer.needsScores) {
      void scoresQuery.refetch();
    }
  }, [
    layer.needsScores,
    mapFailed,
    mapLayer,
    queryClient,
    releaseId,
    scoresQuery,
  ]);
  const preserveRenderedMap = publishedMap.revision !== null;
  const showMap =
    !mapFailed &&
    !geometryError &&
    (!geometryPending || preserveRenderedMap) &&
    (!valuesPending || preserveRenderedMap) &&
    geometryQuery.data &&
    mapCounties.length > 0 &&
    (availableDataGate.kind === "open" || availableDataGate.kind === "ready");
  return (
    <div
      className="ux-reset-explorer-browse"
      data-testid="review-national-orientation"
    >
      <Card className="ux-reset-explorer-map ux-reset-review-operating-map map-card gap-0 py-0">
        <ExplorerMapSectionHeader
          fitLabel="Fit geography"
          fitPlaceName="United States"
          fitTestId="explorer-fit-national"
          onFit={returnToNationalExtent}
          onUsView={returnToUsView}
        />
        <div className="ux-reset-explorer-map-layer">
          <ExplorerMapLayerControl
            gates={layerGates}
            layerId={mapLayer}
            onLayerChange={onMapLayerChange}
          />
        </div>
        {knownEmptySelection ? (
          <KnownEmptySelectionNotice
            omitCaveats
            selections={[knownEmptySelection]}
            testId="national-map-known-empty"
          />
        ) : null}
        <div
          aria-busy={
            mapLoading.busy ||
            geometryPending ||
            valuesPending ||
            mapPaint.kind === "loading"
          }
          className="map-wrap"
          data-map-colors={mapCounties
            .map((entry) => `${entry.fips}:${entry.color ?? ""}`)
            .join(" ")}
          data-map-fips={mapCounties.map((entry) => entry.fips).join(" ")}
          data-map-focus={mapFocus ?? ""}
          data-map-stage={
            mapFocus ? (selectedFips ? "county" : "state") : "national"
          }
          data-testid="review-national-map-region"
        >
          {availableDataGate.kind === "loading" ? (
            <AtlasStatusMessage className="map-loading" tone="loading">
              <p>{EXPLORER_AVAILABLE_DATA_LOADING}</p>
            </AtlasStatusMessage>
          ) : availableDataGate.kind === "error" ? (
            <AtlasStatusMessage className="map-loading" tone="error">
              <p>{EXPLORER_AVAILABLE_DATA_ERROR}</p>
            </AtlasStatusMessage>
          ) : showMap && geometryQuery.data ? (
            <ExplorerMapSurface
              blockMap={mapLoading.blockMap}
              onPaintSettled={onPaintSettled}
              revision={publishedMap.revision}
            >
              <AtlasMap
                ariaLabel="Map of the contiguous United States. The first selection focuses a state. The next selection in that state chooses a county. You can also use the State filter and the county list."
                cameraFrameState={mapFocus}
                doubleClickZoom={false}
                fitSelectedCounty={mapFocus !== null && selectedFips.length > 0}
                fitSignal={fitSignal}
                geographicStateOutline={mapFocus !== null}
                geometry={{
                  ...geometryQuery.data,
                  features: geometryFeatures,
                }}
                includeUnscoredCounties={availableDataGate.kind === "open"}
                neutralCountyBoundaries={mapLayer === "boundaries"}
                paintRevision={publishedMap.revision ?? undefined}
                resetNationalView
                scores={publishedMap.frame}
                selectedFips={selectedFips}
                selectedState={browseState ?? "ALL"}
                onCountyPointer={(click) => {
                  const action = explorerMapDrillAction({
                    clickDetail: click.clickDetail,
                    fips: click.fips,
                    focusedState: mapFocus,
                  });
                  switch (action.type) {
                    case "ignore": {
                      return;
                    }
                    case "focus-state": {
                      chooseState(action.state);
                      return;
                    }
                    case "select-county": {
                      chooseCounty(action.fips);
                      return;
                    }
                    default: {
                      const exhaustive: never = action;
                      return exhaustive;
                    }
                  }
                }}
                onError={() => {
                  setMapFailed(true);
                }}
                onPaintSettled={onPaintSettled}
                onSelect={() => {
                  // County clicks are handled by the two-stage pointer above.
                }}
              />
            </ExplorerMapSurface>
          ) : mapFailed || geometryError ? (
            <AtlasStatusMessage className="map-loading" tone="error">
              <p>
                The map is temporarily unavailable. Choose a state and county
                from the list.
              </p>
              {mapFailed ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMapFailed(false);
                  }}
                >
                  Retry map
                </Button>
              ) : null}
            </AtlasStatusMessage>
          ) : valuesPending ||
            geometryPending ? null : availableDataGate.kind === "ready" &&
            geometryFeatures.length > 0 ? (
            <AtlasStatusMessage className="map-loading" tone="empty">
              <p>{EXPLORER_AVAILABLE_DATA_EMPTY}</p>
            </AtlasStatusMessage>
          ) : (
            <AtlasStatusMessage className="map-loading" tone="empty">
              <p>No county shapes were returned for this release.</p>
            </AtlasStatusMessage>
          )}
          <ExplorerMapLoadingOverlay
            view={mapLoading.overlay}
            onRetry={retryMapLayer}
          />
        </div>
        <ExplorerMapLegend
          key={`${mapPaint.layerId}:${mapPaint.kind}:${mapPaint.title}`}
          paint={mapPaint}
        />
        <div className="ux-reset-explorer-map-availability">
          <ExplorerMapLayerAvailability gates={layerGates} />
        </div>
        <ExplorerMapSourceCaption period={period} releaseId={releaseId} />
      </Card>
      <ExplorerLowerWorkspace
        fips={selectedFips || null}
        releaseId={releaseId}
        whatIfActive={scenarioByFips !== null && mapLayer === "gap_score"}
      />
      <div className="ux-reset-explorer-list">
        <Card className="gap-0 p-3">
          {countiesLoading ? (
            <AtlasStatusMessage tone="loading">
              Loading published counties…
            </AtlasStatusMessage>
          ) : null}
          {countiesError ? (
            <AtlasStatusMessage tone="error">
              Published counties could not be loaded.
            </AtlasStatusMessage>
          ) : null}
          {availableDataGate.kind === "loading" ? (
            <AtlasStatusMessage tone="loading">
              <p>{EXPLORER_AVAILABLE_DATA_LOADING}</p>
            </AtlasStatusMessage>
          ) : null}
          {availableDataGate.kind === "error" ? (
            <AtlasStatusMessage tone="error">
              <p>{EXPLORER_AVAILABLE_DATA_ERROR}</p>
            </AtlasStatusMessage>
          ) : null}
          {listState &&
          !countiesLoading &&
          !countiesError &&
          rankedRows.length === 0 &&
          availableDataGate.kind === "ready" ? (
            <p>{EXPLORER_AVAILABLE_DATA_EMPTY}</p>
          ) : null}
          {listState &&
          !countiesLoading &&
          !countiesError &&
          rankedRows.length === 0 &&
          availableDataGate.kind === "open" ? (
            <p>No published counties were returned for this state.</p>
          ) : null}
          <ExplorerRankedCountyList
            emptyLabel={
              countyQuery.trim()
                ? "No counties match that name or FIPS."
                : listState
                  ? "No counties in this state have a published Atlas gap score."
                  : "No counties have a published Atlas gap score."
            }
            note={
              rankedList.truncated
                ? `Showing the first ${EXPLORER_NATIONAL_COUNTY_SHORTLIST_LENGTH} counties. Use the State control, or select a state on the map, to narrow this list.`
                : undefined
            }
            rows={rankedRows}
            scenarios={scenarioByFips}
            scopeKey={listState ?? "ALL"}
            selectedFips={selectedFips}
            testId="national-published-county"
            onSelect={chooseCounty}
          />
        </Card>
      </div>
      <div className="ux-reset-explorer-preview">
        {selectedIdentity && handoff ? (
          <ReviewPublishedCountyPreview
            compareHref={handoff.compareHref}
            county={selectedIdentity}
            release={tierRelease}
            releaseId={releaseId}
            onOpen={markReviewReturnFocus}
            onViewCountyEvidence={onViewCountyEvidence}
          />
        ) : (
          <>
            <p className="type-body" data-testid="explorer-preview-empty">
              No county is selected. Choose one from the list or the map.
            </p>
            <DownloadCountyPdfButton
              countyName=""
              fips=""
              releaseId=""
              stateCode=""
            />
          </>
        )}
      </div>
    </div>
  );
}
