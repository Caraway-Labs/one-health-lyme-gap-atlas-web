import { InvestigateContractError } from "@/features/ux-reset/investigate/county-evidence";
import { AtlasApiError } from "@/lib/api-mutator";

/**
 * Query results Investigate keeps. `undefined` has never resolved. `null` is a
 * settled absence (the county 404). A later refetch error keeps whichever of
 * those already resolved.
 */
export const investigateQueryOutcomes = [
  "failed-first-load",
  "loaded",
  "never-loaded",
  "refresh-failed",
  "settled-absent",
] as const;

export type InvestigateQueryOutcome = (typeof investigateQueryOutcomes)[number];

/**
 * Each Investigate request that can fail on its own. `catalog` and `measures`
 * are the one `/v1/measures` query. Observation rows that fail inside a loaded
 * bundle stay measure failures on that bundle.
 */
export const investigateRequestNames = [
  "catalog",
  "county-record",
  "directory",
  "indicators",
  "measures",
  "metadata",
  "observations",
] as const;

export type InvestigateRequestName = (typeof investigateRequestNames)[number];

export type InvestigateRequestDisclosure = {
  /** Settled absence, including a cached null kept after a refresh failure. */
  absent: boolean;
  /** First-load failure. Empty when a resolved result is still held. */
  failure: string | null;
  /** True when `data` is anything other than `undefined`, including `null`. */
  keepsResolvedResult: boolean;
  outcome: InvestigateQueryOutcome;
  refreshFailure: string | null;
};

export const CATALOG_REQUEST_FAILURE = "Governed measures could not be loaded.";
export const CATALOG_REFRESH_FAILURE =
  "The measure catalog refresh failed. The last governed catalog is still shown.";
export const INDICATOR_REQUEST_FAILURE =
  "Governed indicators could not be loaded. Observations stay grouped by the indicator id allowlist. That is a request failure, not a loaded indicator catalog.";
export const INDICATOR_REFRESH_FAILURE =
  "The indicator catalog refresh failed. The last governed indicator list is still shown.";
export const COUNTY_RECORD_REFRESH_FAILURE =
  "The published county record refresh failed. The last governed result is still shown.";
export const COUNTY_RECORD_REQUEST_FAILURE =
  "The published county record could not be loaded. That is a request failure, not missing evidence.";
export const COUNTY_RECORD_CONTRACT_FAILURE =
  "The published county record did not match this county and release, so it was not shown.";
export const OBSERVATION_REQUEST_FAILURE =
  "County evidence did not load for the requested county.";
export const OBSERVATION_REFRESH_FAILURE =
  "County evidence refresh failed. The last governed result is still shown.";
export const DIRECTORY_REQUEST_FAILURE =
  "The published county list for this release could not be loaded.";
export const DIRECTORY_REFRESH_FAILURE =
  "The published county list refresh failed. The last governed list is still shown.";
export const METADATA_REFRESH_FAILURE =
  "The release metadata refresh failed. The last governed release is still shown.";

export function investigateQueryOutcome(input: {
  data: unknown;
  isError: boolean;
}): InvestigateQueryOutcome {
  if (input.data === undefined) {
    return input.isError ? "failed-first-load" : "never-loaded";
  }
  if (input.isError) {
    return "refresh-failed";
  }
  if (input.data === null) {
    return "settled-absent";
  }
  return "loaded";
}

function metadataFailureMessage(
  error: unknown,
  requestedDataset: string | null
): string {
  if (error instanceof InvestigateContractError) {
    return "The release response did not match the requested dataset.";
  }
  if (error instanceof AtlasApiError && requestedDataset) {
    return `The requested release "${requestedDataset}" is not available. ${error.message}`;
  }
  if (error instanceof AtlasApiError) {
    return error.message;
  }
  return "Unable to load governed release metadata.";
}

const FIRST_LOAD_FAILURES: Record<InvestigateRequestName, string> = {
  catalog: CATALOG_REQUEST_FAILURE,
  "county-record": COUNTY_RECORD_REQUEST_FAILURE,
  directory: DIRECTORY_REQUEST_FAILURE,
  indicators: INDICATOR_REQUEST_FAILURE,
  measures: CATALOG_REQUEST_FAILURE,
  metadata: "Unable to load governed release metadata.",
  observations: OBSERVATION_REQUEST_FAILURE,
};

const REFRESH_FAILURES: Record<InvestigateRequestName, string> = {
  catalog: CATALOG_REFRESH_FAILURE,
  "county-record": COUNTY_RECORD_REFRESH_FAILURE,
  directory: DIRECTORY_REFRESH_FAILURE,
  indicators: INDICATOR_REFRESH_FAILURE,
  measures: CATALOG_REFRESH_FAILURE,
  metadata: METADATA_REFRESH_FAILURE,
  observations: OBSERVATION_REFRESH_FAILURE,
};

function firstLoadFailure(input: {
  error: unknown;
  request: InvestigateRequestName;
  requestedDataset: string | null;
}): string {
  if (
    input.request === "county-record" &&
    input.error instanceof InvestigateContractError
  ) {
    return COUNTY_RECORD_CONTRACT_FAILURE;
  }
  if (input.request === "metadata") {
    return metadataFailureMessage(input.error, input.requestedDataset);
  }
  return FIRST_LOAD_FAILURES[input.request];
}

export function investigateRequestDisclosure(input: {
  data: unknown;
  error?: unknown;
  isError: boolean;
  request: InvestigateRequestName;
  requestedDataset?: string | null;
}): InvestigateRequestDisclosure {
  const outcome = investigateQueryOutcome(input);
  const keepsResolvedResult = input.data !== undefined;
  const absent = input.data === null && keepsResolvedResult;
  switch (outcome) {
    case "failed-first-load": {
      return {
        absent: false,
        failure: firstLoadFailure({
          error: input.error,
          request: input.request,
          requestedDataset: input.requestedDataset ?? null,
        }),
        keepsResolvedResult: false,
        outcome,
        refreshFailure: null,
      };
    }
    case "loaded": {
      return {
        absent,
        failure: null,
        keepsResolvedResult,
        outcome,
        refreshFailure: null,
      };
    }
    case "never-loaded": {
      return {
        absent,
        failure: null,
        keepsResolvedResult,
        outcome,
        refreshFailure: null,
      };
    }
    case "settled-absent": {
      return {
        absent,
        failure: null,
        keepsResolvedResult,
        outcome,
        refreshFailure: null,
      };
    }
    case "refresh-failed": {
      return {
        absent,
        failure: null,
        keepsResolvedResult: true,
        outcome,
        refreshFailure: REFRESH_FAILURES[input.request],
      };
    }
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
