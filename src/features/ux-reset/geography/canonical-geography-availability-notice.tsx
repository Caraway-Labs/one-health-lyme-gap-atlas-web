"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import {
  CANONICAL_GEOGRAPHY_UNPUBLISHED_COPY,
  canonicalGeographyAvailabilityRetryDelay,
  canonicalGeographyViewFromError,
  fetchCanonicalGeographyAvailability,
  shouldRetryCanonicalGeographyAvailability,
  unsupportedCanonicalGeographyView,
  type CanonicalGeographyAvailabilityView,
} from "@/features/ux-reset/geography/canonical-geography-availability";
import { isCountyFips } from "@/lib/county-geography";

const AVAILABILITY_QUERY_KEY = "canonical-geography-availability";

export function useCanonicalGeographyAvailability(
  fips: string | null
): CanonicalGeographyAvailabilityView {
  const countyFips = fips?.trim() ?? "";
  const enabled = isCountyFips(countyFips);
  const queryClient = useQueryClient();
  const configuredRetry = queryClient.getDefaultOptions().queries?.retry;
  const configuredRetryDelay =
    queryClient.getDefaultOptions().queries?.retryDelay;
  const query = useQuery({
    enabled,
    gcTime: 0,
    queryFn: ({ signal }) =>
      fetchCanonicalGeographyAvailability(countyFips, signal),
    queryKey: [AVAILABILITY_QUERY_KEY, "county", countyFips],
    retry: (failureCount, error) =>
      shouldRetryCanonicalGeographyAvailability(
        failureCount,
        error,
        configuredRetry
      ),
    retryDelay: (failureCount, error) =>
      canonicalGeographyAvailabilityRetryDelay(
        failureCount,
        error,
        configuredRetryDelay
      ),
    staleTime: 0,
  });

  if (!fips) {
    return { status: "idle" };
  }
  if (!enabled) {
    return unsupportedCanonicalGeographyView();
  }
  if (query.isError) {
    return canonicalGeographyViewFromError(query.error);
  }
  if (query.isPending || !query.data) {
    return { status: "loading" };
  }
  return query.data;
}

function statusMessage(
  view: CanonicalGeographyAvailabilityView
): string | null {
  switch (view.status) {
    case "idle":
    case "loading":
    case "unpublished": {
      return null;
    }
    case "error":
    case "not_found":
    case "rate_limited":
    case "unsupported": {
      return view.message;
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

/**
 * Selected-county notice for the additive availability operation.
 * County facts, display geometry, and published observations stay in place.
 */
export function CanonicalGeographyAvailabilityNotice({
  fips,
}: {
  fips: string | null;
}) {
  const view = useCanonicalGeographyAvailability(fips);
  if (view.status === "idle") {
    return null;
  }
  const message = statusMessage(view);
  const live = view.status === "loading" || view.status === "unpublished";
  return (
    <section
      aria-label="Canonical geography publication"
      aria-live={live ? "polite" : undefined}
      data-release={view.status === "unpublished" ? view.releaseId : ""}
      data-status={view.status}
      data-testid="canonical-geography-availability"
    >
      {view.status === "loading" ? (
        <AtlasStatusMessage tone="loading">
          Checking canonical geography publication…
        </AtlasStatusMessage>
      ) : null}
      {view.status === "unpublished" ? (
        <AtlasStatusMessage tone="empty">
          <p>{CANONICAL_GEOGRAPHY_UNPUBLISHED_COPY}</p>
          <p className="type-small">Checked release {view.releaseId}.</p>
          <ul data-testid="canonical-geography-limitations">
            {view.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </AtlasStatusMessage>
      ) : null}
      {message ? (
        <AtlasStatusMessage tone="error">
          <p>{message}</p>
        </AtlasStatusMessage>
      ) : null}
    </section>
  );
}
