"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  canonicalGeographyAvailabilityRetryDelay,
  canonicalGeographyViewFromError,
  fetchCanonicalGeographyAvailability,
  shouldRetryCanonicalGeographyAvailability,
  unsupportedCanonicalGeographyView,
  type CanonicalGeographyAvailabilityView,
} from "@/features/ux-reset/geography/canonical-geography-availability";
import { CanonicalGeographyAvailabilityNoticeBody } from "@/features/ux-reset/geography/canonical-geography-availability-notice-body";
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
  return <CanonicalGeographyAvailabilityNoticeBody view={view} />;
}
