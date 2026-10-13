"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  useCallback,
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
} from "@/lib/county-geography";

import {
  filterReviewStateNavigationEntries,
  reviewNavigationEntryByCode,
  reviewNavigationFilterStatus,
  reviewNavigationFocusAnnouncement,
  reviewNavigationMapPhase,
  reviewNavigationMapRetryable,
  reviewNavigationMapStatus,
  reviewNavigationStatusText,
  reviewStateAvailabilityValues,
  reviewStateContractSummary,
  reviewStateNavigationCopy,
  reviewStateNavigationEntries,
  reviewStateNavigationFeatures,
  reviewStateNavigationLabel,
  type ReviewNavigationMapPhase,
  type ReviewStateFeatureCollection,
  type ReviewStateNavigationEntry,
} from "./review-state-navigation";

const ReviewStateNavigationMap = dynamic(
  async () => {
    const mapModule =
      await import("@/features/ux-reset/review/review-state-navigation-map");
    return mapModule.ReviewStateNavigationMap;
  },
  { ssr: false }
);

const EMPTY_FEATURES: ReviewStateFeatureCollection = {
  features: [],
  type: "FeatureCollection",
};

type ReviewNationalOrientationProps = {
  onOpenState: (stateCode: string) => void;
  releaseId: string;
  releaseStates: readonly AtlasStateOption[];
};

type MapFocusMove = "first" | "last" | "next" | "previous";

function moveSupportedCode(
  codes: readonly string[],
  current: string | null,
  move: MapFocusMove
): string | null {
  if (codes.length === 0) {
    return null;
  }
  switch (move) {
    case "first": {
      return codes[0] ?? null;
    }
    case "last": {
      return codes.at(-1) ?? null;
    }
    case "next":
    case "previous": {
      const index = current === null ? -1 : codes.indexOf(current);
      if (index === -1) {
        return move === "previous"
          ? (codes.at(-1) ?? null)
          : (codes[0] ?? null);
      }
      const delta = move === "next" ? 1 : -1;
      return codes[(index + delta + codes.length) % codes.length] ?? null;
    }
    default: {
      const exhaustive: never = move;
      return exhaustive;
    }
  }
}

function enabledButtons(list: HTMLUListElement): HTMLButtonElement[] {
  return [...list.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
}

export function ReviewNationalOrientation({
  onOpenState,
  releaseId,
  releaseStates,
}: ReviewNationalOrientationProps) {
  const entries = useMemo(
    () => reviewStateNavigationEntries(releaseStates),
    [releaseStates]
  );
  const [query, setQuery] = useState("");
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [mapFailure, setMapFailure] = useState<"load" | "webgl" | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const geometryQuery = useQuery({
    enabled: releaseId.length > 0,
    queryFn: ({ signal }) => fetchCountyDisplayGeometry(releaseId, { signal }),
    queryKey: countyDisplayGeometryQueryKey("ux-reset-review", releaseId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const features = useMemo(
    () =>
      geometryQuery.data
        ? reviewStateNavigationFeatures(geometryQuery.data, entries)
        : EMPTY_FEATURES,
    [entries, geometryQuery.data]
  );
  const geometry = geometryQuery.isError
    ? "error"
    : geometryQuery.isSuccess
      ? "ready"
      : "loading";
  const phase = reviewNavigationMapPhase({
    featureCount: features.features.length,
    geometry,
    mapFailure,
    mapReady,
  });
  const visible = useMemo(
    () => filterReviewStateNavigationEntries(entries, query),
    [entries, query]
  );
  const activate = useCallback(
    (code: string) => {
      const entry = reviewNavigationEntryByCode(entries, code);
      if (entry?.availability !== reviewStateAvailabilityValues.supported) {
        return;
      }
      setSelectedCode(code);
      onOpenState(code);
    },
    [entries, onOpenState]
  );
  const retryMap = useCallback(() => {
    setMapFailure(null);
    setMapReady(false);
    setMapAttempt((value) => value + 1);
    void geometryQuery.refetch();
  }, [geometryQuery]);
  const handleReady = useCallback(() => {
    setMapReady(true);
  }, []);
  const handleWebglUnavailable = useCallback(() => {
    setMapFailure("webgl");
  }, []);
  const handleLoadFailed = useCallback(() => {
    setMapFailure("load");
  }, []);
  const [trackedReleaseId, setTrackedReleaseId] = useState(releaseId);
  if (trackedReleaseId !== releaseId) {
    setTrackedReleaseId(releaseId);
    setMapFailure(null);
    setMapReady(false);
    setMapAttempt((value) => value + 1);
  }
  if (focusCode && !visible.some((entry) => entry.code === focusCode)) {
    setFocusCode(null);
  }

  const mapCodes = useMemo(
    () =>
      features.features.flatMap((feature) =>
        feature.properties.availability ===
        reviewStateAvailabilityValues.supported
          ? [feature.properties.code]
          : []
      ),
    [features]
  );

  return (
    <ReviewNationalOrientationView
      catalog={entries}
      entries={visible}
      features={features}
      mapAttempt={mapAttempt}
      mapCodes={mapCodes}
      phase={phase}
      query={query}
      totalCount={entries.length}
      contractSummary={reviewStateContractSummary(entries)}
      focusCode={focusCode}
      hoverCode={hoverCode}
      selectedCode={selectedCode}
      onActivate={activate}
      onFocusCode={setFocusCode}
      onHoverCode={setHoverCode}
      onLoadFailed={handleLoadFailed}
      onQueryChange={setQuery}
      onReady={handleReady}
      onRetry={retryMap}
      onWebglUnavailable={handleWebglUnavailable}
    />
  );
}

type ReviewNationalOrientationViewProps = {
  catalog: readonly ReviewStateNavigationEntry[];
  contractSummary: string | null;
  entries: readonly ReviewStateNavigationEntry[];
  features: ReviewStateFeatureCollection;
  focusCode: string | null;
  hoverCode: string | null;
  mapAttempt: number;
  mapCodes: readonly string[];
  onActivate: (code: string) => void;
  onFocusCode: (code: string | null) => void;
  onHoverCode: (code: string | null) => void;
  onLoadFailed: () => void;
  onQueryChange: (query: string) => void;
  onReady: () => void;
  onRetry: () => void;
  onWebglUnavailable: () => void;
  phase: ReviewNavigationMapPhase;
  query: string;
  selectedCode: string | null;
  totalCount: number;
};

export function ReviewNationalOrientationView({
  catalog,
  contractSummary,
  entries,
  features,
  focusCode,
  hoverCode,
  mapAttempt,
  mapCodes,
  onActivate,
  onFocusCode,
  onHoverCode,
  onLoadFailed,
  onQueryChange,
  onReady,
  onRetry,
  onWebglUnavailable,
  phase,
  query,
  selectedCode,
  totalCount,
}: ReviewNationalOrientationViewProps) {
  const searchId = useId();
  const instructionsId = useId();
  const listId = useId();
  const focus = reviewNavigationEntryByCode(catalog, focusCode);
  const hover = reviewNavigationEntryByCode(catalog, hoverCode);
  const selected = reviewNavigationEntryByCode(catalog, selectedCode);
  const status = reviewNavigationStatusText({
    contractSummary,
    focus,
    hover,
    phase,
    selected,
    totalCount,
    visibleCount: entries.length,
  });
  const showMap =
    features.features.length > 0 &&
    (phase === "map-loading" || phase === "ready");
  const retryable = reviewNavigationMapRetryable(phase);

  const keyboardCodes = entries.flatMap((entry) =>
    entry.availability === reviewStateAvailabilityValues.supported &&
    mapCodes.includes(entry.code)
      ? [entry.code]
      : []
  );

  const focusListButton = (end: "first" | "last") => {
    const list = document.querySelector(`#${listId}`);
    const buttons =
      list instanceof HTMLUListElement ? enabledButtons(list) : [];
    const button = end === "first" ? buttons[0] : buttons.at(-1);
    button?.focus();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusListButton(event.key === "ArrowDown" ? "first" : "last");
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const supported = entries.filter(
      (entry) => entry.availability === reviewStateAvailabilityValues.supported
    );
    if (supported.length === 1) {
      const only = supported[0];
      if (only) {
        onActivate(only.code);
      }
    }
  };

  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const list = event.currentTarget.closest("ul");
    if (!(list instanceof HTMLUListElement)) {
      return;
    }
    const buttons = enabledButtons(list);
    if (buttons.length === 0) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        const index = buttons.indexOf(event.currentTarget);
        if (index === -1) {
          return;
        }
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
        return;
      }
      case "Home": {
        event.preventDefault();
        buttons[0]?.focus();
        return;
      }
      case "End": {
        event.preventDefault();
        buttons.at(-1)?.focus();
        return;
      }
      case "Escape": {
        event.preventDefault();
        event.currentTarget.blur();
        break;
      }
      default: {
        break;
      }
    }
  };

  const onMapBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    onFocusCode(null);
  };

  const onMapKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== "ready") {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight": {
        event.preventDefault();
        onFocusCode(moveSupportedCode(keyboardCodes, focusCode, "next"));
        return;
      }
      case "ArrowUp":
      case "ArrowLeft": {
        event.preventDefault();
        onFocusCode(moveSupportedCode(keyboardCodes, focusCode, "previous"));
        return;
      }
      case "Home": {
        event.preventDefault();
        onFocusCode(moveSupportedCode(keyboardCodes, focusCode, "first"));
        return;
      }
      case "End": {
        event.preventDefault();
        onFocusCode(moveSupportedCode(keyboardCodes, focusCode, "last"));
        return;
      }
      case "Escape": {
        event.preventDefault();
        onFocusCode(null);
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (focusCode) {
          onActivate(focusCode);
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  return (
    <div
      className="ux-reset-explorer-browse"
      data-testid="review-national-orientation"
    >
      <div className="ux-reset-explorer-list ux-reset-review-state-nav">
        <h2 className="type-card">County list</h2>
        <h3 className="sr-only">{reviewStateNavigationCopy.heading}</h3>
        <p className="type-body">{reviewStateNavigationCopy.description}</p>
        <p className="type-small" id={instructionsId}>
          {reviewStateNavigationCopy.instructions}
        </p>
        {/* The map frame is the keyboard target for cycling supported states. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          aria-describedby={instructionsId}
          aria-label={reviewStateNavigationCopy.mapLabel}
          className="ux-reset-review-state-map"
          data-map-phase={phase}
          data-testid="review-state-navigation-map"
          role="region"
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={phase === "ready" ? 0 : undefined}
          onBlur={onMapBlur}
          onKeyDown={onMapKeyDown}
        >
          {showMap ? (
            <ReviewStateNavigationMap
              key={mapAttempt}
              features={features}
              focusCode={focusCode}
              hoverCode={hoverCode}
              selectedCode={selectedCode}
              onActivate={onActivate}
              onHover={onHoverCode}
              onLoadFailed={onLoadFailed}
              onReady={onReady}
              onWebglUnavailable={onWebglUnavailable}
            />
          ) : null}
          {phase === "ready" ? null : (
            <div
              aria-hidden="true"
              className="ux-reset-review-state-map-message"
            >
              <p className="type-body">{reviewNavigationMapStatus(phase)}</p>
            </div>
          )}
        </div>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="sr-only"
          data-testid="review-state-navigation-live"
        >
          {`Map status: ${reviewNavigationMapStatus(phase)} ${reviewNavigationFocusAnnouncement(focus)}`}
        </p>
        <p data-testid="review-state-navigation-status">{status}</p>
        {retryable ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry map
          </Button>
        ) : null}
        <label className="ux-reset-review-scope-field" htmlFor={searchId}>
          <span className="type-small">
            {reviewStateNavigationCopy.searchLabel}
          </span>
          <Input
            autoComplete="off"
            data-testid="review-state-search"
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
            onKeyDown={onSearchKeyDown}
          />
        </label>
        <p
          className="sr-only"
          data-testid="review-state-navigation-results"
          role="status"
        >
          {reviewNavigationFilterStatus({
            totalCount,
            visibleCount: entries.length,
          })}
        </p>
        <ul
          aria-label={reviewStateNavigationCopy.listLabel}
          className="ux-reset-review-state-list"
          data-testid="review-state-list"
          id={listId}
        >
          {entries.map((entry) => {
            const supported =
              entry.availability === reviewStateAvailabilityValues.supported;
            return (
              <li key={entry.code}>
                <Button
                  className="ux-reset-review-state-option"
                  data-availability={entry.availability}
                  data-focused={entry.code === focusCode ? "true" : "false"}
                  data-hovered={entry.code === hoverCode ? "true" : "false"}
                  data-selected={entry.code === selectedCode ? "true" : "false"}
                  disabled={!supported}
                  id={`${listId}-${entry.code}`}
                  type="button"
                  variant="outline"
                  aria-current={
                    entry.code === selectedCode ? "true" : undefined
                  }
                  onBlur={() => {
                    if (focusCode === entry.code) {
                      onFocusCode(null);
                    }
                  }}
                  onClick={() => {
                    if (!supported) {
                      return;
                    }
                    onActivate(entry.code);
                  }}
                  onKeyDown={onOptionKeyDown}
                  onFocus={() => {
                    onFocusCode(entry.code);
                  }}
                  onMouseEnter={() => {
                    onHoverCode(entry.code);
                  }}
                  onMouseLeave={() => {
                    if (hoverCode === entry.code) {
                      onHoverCode(null);
                    }
                  }}
                >
                  {reviewStateNavigationLabel(entry)}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
      <aside className="ux-reset-explorer-preview">
        <p className="eyebrow">Selected county</p>
        <p className="type-body">
          No county is selected. Choose a state to open its counties. National
          ranking is unavailable, and that is not low priority.
        </p>
        <p className="type-small">
          This map shows state boundaries so you can open a state. It is not an
          Atlas gap score map.
        </p>
      </aside>
    </div>
  );
}
