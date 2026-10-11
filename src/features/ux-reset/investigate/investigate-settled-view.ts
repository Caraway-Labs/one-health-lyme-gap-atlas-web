import {
  countyEvidenceLoadStates,
  investigateBundleWithoutObservations,
  type CountyEvidenceBundle,
  type CountyEvidenceLoadState,
  type ResolvedCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";

export type SettledInvestigateHierarchy = {
  bundle: CountyEvidenceBundle;
  catalogFailed: boolean;
  countyRecord: PublishedCountyRecord | null;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  countyRecordRefreshError: string | null;
  /** Loaded only when `bundle` came from the measure catalog, not a synthetic stand-in. */
  observationsLoaded: CountyEvidenceLoadState;
};

/**
 * Hierarchy props after catalog and county requests have a chance to settle.
 * A successful county 404 is an absent record, so a failed catalog still
 * renders the unpublished coverage state.
 */
export function settledInvestigateHierarchy(input: {
  bundle: CountyEvidenceBundle | null;
  catalogError: string | null;
  countyRecord: PublishedCountyRecord | null;
  countyRecordAbsent: boolean;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  countyRecordRefreshError: string | null;
  identity: ResolvedCountyIdentity | null;
  releaseId: string | null;
}): SettledInvestigateHierarchy | null {
  if (input.bundle) {
    return {
      bundle: input.bundle,
      catalogFailed: false,
      countyRecord: input.countyRecord,
      countyRecordError: input.countyRecordError,
      countyRecordLoading: input.countyRecordLoading,
      countyRecordRefreshError: input.countyRecordRefreshError,
      observationsLoaded: countyEvidenceLoadStates.loaded,
    };
  }
  const countySettled =
    input.countyRecord !== null ||
    Boolean(input.countyRecordError) ||
    input.countyRecordAbsent;
  if (
    !input.catalogError ||
    !input.identity ||
    !input.releaseId ||
    input.countyRecordLoading ||
    !countySettled
  ) {
    return null;
  }
  return {
    bundle: investigateBundleWithoutObservations({
      county: input.identity,
      releaseId: input.releaseId,
    }),
    catalogFailed: true,
    countyRecord: input.countyRecord,
    countyRecordError: input.countyRecordError,
    countyRecordLoading: false,
    countyRecordRefreshError: input.countyRecordRefreshError,
    observationsLoaded: countyEvidenceLoadStates.withheld,
  };
}
