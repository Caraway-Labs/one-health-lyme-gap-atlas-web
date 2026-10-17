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
import {
  countyPassesAvailableData,
  countyReferenceMatchesQuery,
  EXPLORER_AVAILABLE_DATA_EMPTY,
  EXPLORER_AVAILABLE_DATA_ERROR,
  EXPLORER_AVAILABLE_DATA_LOADING,
  EXPLORER_AVAILABLE_DATA_OPEN,
  type ExplorerAvailableDataGate,
  type ExplorerCountyReference,
} from "@/features/ux-reset/review/explorer-county-reference";
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
import { ExplorerCountyRowContent } from "@/features/ux-reset/review/explorer-ml-priority";
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
  EXPLORER_ML_PRIORITY_PAGE_SIZE,
  explorerMlListedFips,
  useExplorerCountyMlPriorities,
} from "@/features/ux-reset/review/use-explorer-county-ml-priorities";
import {
  observationGate,
  observationPaintState,
  useExplorerMapObservations,
} from "@/features/ux-reset/review/use-explorer-map-observations";
import { useExplorerMapScores } from "@/features/ux-reset/review/use-explorer-map-scores";
import {
  EXPLORER_ML_PRIORITY_LEGEND,
  EXPLORER_ML_PRIORITY_UNAVAILABLE,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { CountyScoreSummary } from "@/generated/models";
import { isContiguousUsCounty } from "@/lib/atlas-geometry";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";
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
  mapLayer: ExplorerMapLayerId;
  onCountyChange: (fips: string | null, history: "push" | "replace") => void;
  onMapLayerChange: (layerId: ExplorerMapLayerId) => void;
  onViewCountyEvidence?: (fips: string) => void;
  period: string | null;
  releaseId: string;
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
  mapLayer,
  onCountyChange,
  onMapLayerChange,
  onViewCountyEvidence,
  period,
  releaseId,
  releaseStates,
  sources = NO_LEGEND_SOURCES,
  tierRelease,
}: ReviewNationalPictureProps) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const selectedFips = county && isLower48CountyFips(county) ? county : "";
  const countyPostal = selectedFips ? postalForFips(selectedFips) : null;
  const [trackedCounty, setTrackedCounty] = useState(selectedFips);
  const [pickedState, setPickedState] = useState<string | null>(countyPostal);
  if (selectedFips !== trackedCounty) {
    setTrackedCounty(selectedFips);
    if (countyPostal) {
      setPickedState(countyPostal);
    }
  }
  const browseState = pickedState ?? countyPostal;
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
  const layer = explorerMapLayerById(mapLayer);
  const scoreCounties = useMemo(
    () =>
      (scoresQuery.data?.counties ?? []).filter(
        (entry) =>
          isLower48ReviewScope(entry.state) && isLower48CountyFips(entry.fips)
      ),
    [scoresQuery.data?.counties]
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
  const mapPaint = useMemo(
    () =>
      paintExplorerMapLayer({
        counties: scoreCounties,
        layerId: layer.id,
        observation: isExplorerObservationLayer(layer.id)
          ? observationPaintState(observations[layer.id])
          : null,
        releaseId,
        scoresStatus,
        selectedFips,
        sources,
      }),
    [
      layer.id,
      observations,
      releaseId,
      scoreCounties,
      scoresStatus,
      selectedFips,
      sources,
    ]
  );
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
          color: painted ?? missingColor,
          fips,
          state,
        },
      ];
    });
  }, [availableDataGate, geometryFeatures, mapPaint.colorsByFips]);
  const scoreByFips = useMemo(() => {
    const scores = new Map<string, CountyScoreSummary>();
    for (const entry of scoreCounties) {
      scores.set(entry.fips, entry);
    }
    return scores;
  }, [scoreCounties]);
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
  const listedCounties = useMemo(() => {
    if (!browseState) {
      return [];
    }
    return counties
      .filter(
        (entry) =>
          entry.state === browseState &&
          isLower48CountyFips(entry.fips) &&
          countyPassesAvailableData(availableDataGate, entry.fips) &&
          countyReferenceMatchesQuery(entry, countyQuery)
      )
      .toSorted(
        (left, right) =>
          left.county.localeCompare(right.county, "en") ||
          left.fips.localeCompare(right.fips)
      );
  }, [availableDataGate, browseState, counties, countyQuery]);
  const [directoryWindow, setDirectoryWindow] = useState({
    count: EXPLORER_ML_PRIORITY_PAGE_SIZE,
    key: "",
  });
  const directoryWindowKey = `${browseState ?? ""}\u0000${countyQuery.trim().toLowerCase()}\u0000${availableDataGate.kind}`;
  const shownDirectoryCount =
    directoryWindow.key === directoryWindowKey
      ? directoryWindow.count
      : EXPLORER_ML_PRIORITY_PAGE_SIZE;
  const visibleDirectory = listedCounties.slice(0, shownDirectoryCount);
  const listedFips = explorerMlListedFips({
    candidateFips: [],
    directoryFips: listedCounties.map((entry) => entry.fips),
    selectedFips: selectedFips || null,
    shownDirectoryCount,
  });
  const mlPriorities = useExplorerCountyMlPriorities(listedFips, tierRelease);
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
    setPickedState(next);
    if (selectedFips && postalForFips(selectedFips) !== next) {
      onCountyChange(null, "push");
    }
  };
  const chooseCounty = (fips: string) => {
    const postal = postalForFips(fips);
    if (!postal || !identityFor(fips)) {
      return;
    }
    if (!countyPassesAvailableData(availableDataGate, fips)) {
      return;
    }
    setPickedState(postal);
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
            <h2>{mapPaint.title}</h2>
            <p>
              {period ? `Period ${period}` : "Source periods vary by evidence"}
              {` · Release ${releaseId}`}
            </p>
          </div>
          <Button
            data-testid="explorer-fit-national"
            type="button"
            variant="secondary"
            onClick={() => {
              setFitSignal((value) => value + 1);
            }}
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
        <div
          aria-busy={geometryPending || valuesPending}
          className="map-wrap"
          data-map-colors={mapCounties
            .map((entry) => `${entry.fips}:${entry.color ?? ""}`)
            .join(" ")}
          data-map-fips={mapCounties.map((entry) => entry.fips).join(" ")}
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
              ariaLabel="Map of the contiguous United States. Select a county, or choose a state and county from the list."
              cameraFrameState={null}
              fitSignal={fitSignal}
              geometry={{
                ...geometryQuery.data,
                features: geometryFeatures,
              }}
              includeUnscoredCounties={availableDataGate.kind === "open"}
              resetNationalView
              scores={mapCounties}
              selectedFips={selectedFips}
              selectedState={browseState ?? "ALL"}
              onError={() => {
                setMapFailed(true);
              }}
              onSelect={(fips) => {
                chooseCounty(fips);
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
        <ExplorerMapLegend paint={mapPaint} />
      </Card>
      <div className="ux-reset-explorer-list">
        <Card className="gap-0 p-3">
          <h2 className="type-card">Counties</h2>
          <p className="type-small">
            {browseName
              ? `${browseName} counties, alphabetical. Not a national ranking.`
              : "Choose a state to list its counties. Not a national ranking."}
          </p>
          <div className="ux-reset-review-scope-field">
            <span className="type-small">Browse a state</span>
            <Select
              value={browseState}
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
                  {browseName ? `${browseName} (${browseState})` : undefined}
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
          {browseState &&
          !countiesLoading &&
          !countiesError &&
          listedCounties.length === 0 &&
          availableDataGate.kind === "ready" ? (
            <p>{EXPLORER_AVAILABLE_DATA_EMPTY}</p>
          ) : null}
          {browseState &&
          !countiesLoading &&
          !countiesError &&
          listedCounties.length === 0 &&
          availableDataGate.kind === "open" ? (
            <p>No published counties were returned for this state.</p>
          ) : null}
          {visibleDirectory.length > 0 ? (
            <>
              <p className="type-small">{EXPLORER_ML_PRIORITY_LEGEND}</p>
              <div
                aria-label={`Published counties in ${browseName ?? "the selected state"}`}
                className="ux-reset-review-candidate-list"
                role="list"
              >
                {visibleDirectory.map((entry) => {
                  const published = scoreByFips.get(entry.fips);
                  const classification =
                    mlPriorities.get(entry.fips) ??
                    EXPLORER_ML_PRIORITY_UNAVAILABLE;
                  return (
                    <div key={entry.fips} role="listitem">
                      <button
                        aria-current={
                          entry.fips === selectedFips ? "true" : undefined
                        }
                        className="ux-reset-review-candidate"
                        data-fips={entry.fips}
                        data-testid="national-published-county"
                        type="button"
                        onClick={() => {
                          chooseCounty(entry.fips);
                        }}
                      >
                        <ExplorerCountyRowContent
                          classification={classification}
                          explanation="Published county record. Not a review ranking."
                          name={`${entry.county}, ${entry.state}`}
                          publishedCategory={
                            published?.priority.trim() || undefined
                          }
                          publishedScore={published?.score.score}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
          {shownDirectoryCount < listedCounties.length ? (
            <Button
              data-testid="national-county-more"
              type="button"
              variant="secondary"
              onClick={() => {
                setDirectoryWindow({
                  count: shownDirectoryCount + EXPLORER_ML_PRIORITY_PAGE_SIZE,
                  key: directoryWindowKey,
                });
              }}
            >
              {`Show ${Math.min(
                EXPLORER_ML_PRIORITY_PAGE_SIZE,
                listedCounties.length - shownDirectoryCount
              )} more counties`}
            </Button>
          ) : null}
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
