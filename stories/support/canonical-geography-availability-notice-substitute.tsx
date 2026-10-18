"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import {
  CANONICAL_GEOGRAPHY_CHECK_ERROR_COPY,
  type CanonicalGeographyAvailabilityView,
} from "@/features/ux-reset/geography/canonical-geography-availability";
import { CanonicalGeographyAvailabilityNoticeBody } from "@/features/ux-reset/geography/canonical-geography-availability-notice-body";

import { syntheticReleaseId } from "../fixtures/synthetic-county";

const idleView = {
  status: "idle",
} as const satisfies CanonicalGeographyAvailabilityView;

/**
 * Stories that do not name a fixture stay idle. Idle renders nothing and
 * never calls the availability operation.
 */
const CanonicalGeographyAvailabilityStoryContext =
  createContext<CanonicalGeographyAvailabilityView>(idleView);

export const storyGeographyUnpublished = {
  limitations: [
    "Canonical geography identity delivery is not published by this API capability.",
  ],
  releaseId: syntheticReleaseId,
  status: "unpublished",
} as const satisfies CanonicalGeographyAvailabilityView;

export const storyGeographyLoading = {
  status: "loading",
} as const satisfies CanonicalGeographyAvailabilityView;

export const storyGeographyError = {
  message: CANONICAL_GEOGRAPHY_CHECK_ERROR_COPY,
  status: "error",
} as const satisfies CanonicalGeographyAvailabilityView;

export function CanonicalGeographyAvailabilityStoryProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: CanonicalGeographyAvailabilityView;
}) {
  return (
    <CanonicalGeographyAvailabilityStoryContext.Provider value={value}>
      {children}
    </CanonicalGeographyAvailabilityStoryContext.Provider>
  );
}

/**
 * Storybook substitute for the selected-county availability notice.
 * The Vite alias replaces the production module, so this render reads the
 * in-memory fixture and does not call useQuery or the API.
 */
export function CanonicalGeographyAvailabilityNotice({
  fips,
}: {
  fips: string | null;
}) {
  const view = useContext(CanonicalGeographyAvailabilityStoryContext);
  if (!fips?.trim()) {
    return null;
  }
  return <CanonicalGeographyAvailabilityNoticeBody view={view} />;
}
