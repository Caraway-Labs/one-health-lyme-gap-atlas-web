"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AtlasMap } from "@/components/atlas-map";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { KnownEmptySelectionNotice } from "@/features/ux-reset/observations/known-empty-selection-notice";
import { EXPLORER_MAP_SECTION_HEADING } from "@/features/ux-reset/page-introduction-copy";
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
import { explorerMapDrillAction } from "@/features/ux-reset/review/explorer-map-focus";
import { ExplorerMapLayerControl } from "@/features/ux-reset/review/explorer-map-layer-control";
import {
  completenessLayerGate,
  explorerMapLayerById,
  explorerMapLayerGates,
  isExplorerObservationLayer,
  paintExplorerMapLayer,
  resolveExplorerMapColor,
  type ExplorerMapLayerId,
  type ExplorerMapLegendSource,
} from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import {
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
  lower48ReviewStateName,
  postalCodeForStateFips,
} from "@/features/ux-reset/review/review-state-fips";
import {
  knownEmptyMapSelection,
  observationGate,
  observationPaintState,
  useExplorerMapObservations,
} from "@/features/ux-reset/review/use-explorer-map-observations";
import { useExplorerMapScores } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { isContiguousUsCounty } from "@/lib/atlas-geometry";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";
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
  onViewCountyEvidence?: (fips: string) => void;
  period: string | null;
  releaseId: string;
  /** Browser what-if. Defaults leave governed county colors in place. */
  scenarioSettings?: ScoreSettings;
  releaseStates: readonly AtlasStateOption[];
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
  onViewCountyEvidence,
  period,
  releaseId,
  releaseStates,
  scenarioSettings = SCENARIO_SCORE_DEFAULTS,
  sources = NO_LEGEND_SOURCES,
  tierRelease: _tierRelease,
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
    ? scoresQuery.isError
      ? "error"
      : scoresQuery.isPending
        ? "loading"
        : "ready"
    : "ready";
  const completenessGate = useMemo(
    () =>
      completenessLayerGate({
        counties: scoreCounties,
        scoresStatus: scoresQuery.isError
          ? "error"
          : scoresQuery.isPending
            ? "loading"
            : "ready",
      }),
    [scoreCounties, scoresQuery.isError, scoresQuery.isPending]
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
  const mapCounties = useMemo(() => {
    const awaitingLayer = mapPaint.kind === "loading";
    const missingColor = noPublishedValueColor();
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
  const stateChoices = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const state of releaseStates) {
      if (!isLower48ReviewScope(state.code)) {
        continue;
      }
      byCode.set(state.code, state.name);
    }
    if (browseState && !byCode.has(browseState)) {
      const name = lower48ReviewStateName(browseState);
      if (name) {
        byCode.set(browseState, name);
      }
    }
    return [...byCode.entries()]
      .map(([code, name]) => ({ code, name }))
      .toSorted(
        (left, right) =>
          left.name.localeCompare(right.name, "en") ||
          left.code.localeCompare(right.code)
      );
  }, [browseState, releaseStates]);
  const rankedRows = useMemo(() => {
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
    return rankExplorerCounties([...byFips.values()], {
      query: countyQuery,
      visibleFips,
    });
  }, [availableDataGate, counties, countyQuery, listState, scoreCounties]);
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
  const showMap =
    !mapFailed &&
    !geometryError &&
    !geometryPending &&
    !valuesPending &&
    geometryQuery.data &&
    mapCounties.length > 0 &&
    (availableDataGate.kind === "open" || availableDataGate.kind === "ready");
  const browseName = browseState
    ? (stateChoices.find((state) => state.code === browseState)?.name ??
      browseState)
    : null;

  return (
    <div
      className="ux-reset-explorer-browse"
      data-testid="review-national-orientation"
    >
      <Card className="ux-reset-explorer-map ux-reset-review-operating-map map-card gap-0 py-0">
        <div className="ux-reset-explorer-map-heading">
          <div>
            <h2>{EXPLORER_MAP_SECTION_HEADING}</h2>
            <p>
              {period ? `Period ${period}` : "Source periods vary by evidence"}
              {` · Release ${releaseId}`}
            </p>
          </div>
          <Button
            data-testid="explorer-fit-national"
            type="button"
            variant="secondary"
            onClick={returnToNationalExtent}
          >
            Fit United States
          </Button>
        </div>
        <div className="ux-reset-explorer-map-layer">
          <ExplorerMapLayerControl
            gates={layerGates}
            layerId={mapLayer}
            onLayerChange={onMapLayerChange}
          />
        </div>
        {knownEmptySelection ? (
          <KnownEmptySelectionNotice
            selections={[knownEmptySelection]}
            testId="national-map-known-empty"
          />
        ) : null}
        <div
          aria-busy={
            geometryPending || valuesPending || mapPaint.kind === "loading"
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
            <AtlasMap
              ariaLabel="Map of the contiguous United States. The first selection focuses a state. The next selection in that state chooses a county. You can also use the state list and the county list."
              cameraFrameState={mapFocus}
              doubleClickZoom={false}
              fitSignal={fitSignal}
              geographicStateOutline={mapFocus !== null}
              geometry={{
                ...geometryQuery.data,
                features: geometryFeatures,
              }}
              includeUnscoredCounties={availableDataGate.kind === "open"}
              resetNationalView
              scores={mapCounties}
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
              onSelect={() => {
                // County clicks are handled by the two-stage pointer above.
              }}
            />
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
          ) : valuesPending || geometryPending ? (
            <AtlasStatusMessage className="map-loading" tone="loading">
              <p>{`Loading ${layer.label}…`}</p>
            </AtlasStatusMessage>
          ) : availableDataGate.kind === "ready" &&
            geometryFeatures.length > 0 ? (
            <AtlasStatusMessage className="map-loading" tone="empty">
              <p>{EXPLORER_AVAILABLE_DATA_EMPTY}</p>
            </AtlasStatusMessage>
          ) : (
            <AtlasStatusMessage className="map-loading" tone="empty">
              <p>No county shapes were returned for this release.</p>
            </AtlasStatusMessage>
          )}
        </div>
        <ExplorerMapLegend
          key={`${mapPaint.layerId}:${mapPaint.kind}:${mapPaint.title}`}
          paint={mapPaint}
        />
      </Card>
      <ExplorerLowerWorkspace
        fips={selectedFips || null}
        releaseId={releaseId}
        whatIfActive={scenarioByFips !== null && mapLayer === "gap_score"}
      />
      <div className="ux-reset-explorer-list">
        <Card className="gap-0 p-3">
          <header className="ux-reset-ranked-counties-header">
            <p className="ux-reset-ranked-counties-eyebrow">Counties</p>
          </header>
          <div className="ux-reset-review-scope-field">
            <span className="type-small">Browse a state</span>
            <Select
              value={listState}
              onValueChange={(next) => {
                if (next) {
                  chooseState(next);
                }
              }}
            >
              <SelectTrigger
                aria-label="Browse a state"
                className="h-9 w-full"
                data-testid="national-browse-state"
              >
                <SelectValue placeholder="Choose a state">
                  {listState && browseName
                    ? `${browseName} (${listState})`
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stateChoices.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            rows={rankedRows}
            scenarios={scenarioByFips}
            scopeKey={listState ?? "ALL"}
            selectedFips={selectedFips}
            showEyebrow={false}
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
            href={handoff.href}
            releaseId={releaseId}
            onOpen={markReviewReturnFocus}
            onViewCountyEvidence={onViewCountyEvidence}
          />
        ) : (
          <p className="type-body" data-testid="explorer-preview-empty">
            No county is selected. Choose one from the list or the map.
          </p>
        )}
      </div>
    </div>
  );
}
