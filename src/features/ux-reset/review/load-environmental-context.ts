import { exploreObservationPageParams } from "@/features/ux-reset/explore/load-explore-resources";
import {
  acceptCountyObservations,
  InvestigateContractError,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  createObservationSelectionAccumulator,
  type KnownEmptyObservationSelection,
} from "@/features/ux-reset/observations/selection-availability";
import {
  DatedObservationContractError,
  readDatedObservations,
} from "@/features/ux-reset/review/dated-observation-envelope";
import {
  environmentalDateSupport,
  type EnvironmentalContextMeasureId,
} from "@/features/ux-reset/review/environmental-context";
import { observationsV1ObservationsGet } from "@/generated/atlas";
import type { Observation } from "@/generated/models";
import { ObservationsV1ObservationsGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  ApiResponseValidationError,
  validateApiResponse,
} from "@/lib/api-response-validation";

const MAX_ENVIRONMENTAL_PAGES = 3;

export class EnvironmentalDateError extends Error {
  constructor() {
    super(
      "Environmental observations are only requested for a January 2025 day."
    );
    this.name = "EnvironmentalDateError";
  }
}

export type EnvironmentalMeasureLoad =
  | { count: number; kind: "conflict" }
  | { kind: "absent"; selection?: KnownEmptyObservationSelection | null }
  | { kind: "observation"; observation: Observation };

/**
 * One county, one measure, one January 2025 day. The response is kept only
 * when every row matches that county, measure, day, and release.
 */
export async function fetchEnvironmentalMeasure(input: {
  date: string;
  fips: string;
  measureId: EnvironmentalContextMeasureId;
  releaseId: string;
  signal: AbortSignal;
}): Promise<EnvironmentalMeasureLoad> {
  if (environmentalDateSupport(input.date) !== "supported") {
    throw new EnvironmentalDateError();
  }
  const observations: Observation[] = [];
  const seenTokens = new Set<string>();
  const selection = createObservationSelectionAccumulator({
    measureId: input.measureId,
    requestedReleaseId: input.releaseId,
  });
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_ENVIRONMENTAL_PAGES; page += 1) {
    if (input.signal.aborted) {
      throw new DOMException(
        "The environmental request was cancelled.",
        "AbortError"
      );
    }
    const response = await observationsV1ObservationsGet(
      exploreObservationPageParams({
        fips: [input.fips],
        measureId: input.measureId,
        pageToken,
        timeBound: {
          date: input.date,
          handoffPeriod: input.date,
          kind: "day",
        },
      }),
      { signal: input.signal }
    );
    if (response.status !== 200) {
      throw new AtlasApiError(
        "Environmental context could not be loaded.",
        "/v1/observations",
        response.status,
        null
      );
    }
    const parsed = validateApiResponse(
      "Environmental observations",
      ObservationsV1ObservationsGetResponse,
      response.data
    );
    selection.note({
      dataCount: parsed.data.length,
      meta: parsed.meta,
      pageToken,
    });
    observations.push(...readDatedObservations(parsed.data));
    const nextToken = parsed.meta.next_page_token ?? null;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    pageToken = nextToken;
  }
  const accepted = acceptCountyObservations({
    measureId: input.measureId,
    observations,
    releaseId: input.releaseId,
    requestedFips: input.fips,
    timeBound: {
      date: input.date,
      handoffPeriod: input.date,
      kind: "day",
    },
  });
  if (accepted.length === 0) {
    const folded = selection.finish();
    if (folded.kind === "release_mismatch") {
      throw new InvestigateContractError(
        "Observation availability release does not match the requested release.",
        "release_mismatch"
      );
    }
    if (folded.kind === "known_unavailable") {
      return { kind: "absent", selection: folded.selection };
    }
    return { kind: "absent" };
  }
  if (accepted.length > 1) {
    return { count: accepted.length, kind: "conflict" };
  }
  const observation = accepted[0];
  if (!observation) {
    return { kind: "absent" };
  }
  return { kind: "observation", observation };
}

export function environmentalLoadErrorMessage(error: unknown): string {
  if (error instanceof EnvironmentalDateError) {
    return error.message;
  }
  if (
    error instanceof InvestigateContractError ||
    error instanceof ApiResponseValidationError
  ) {
    return "This response did not match the selected county, date, measure, and release, so it was not shown.";
  }
  if (error instanceof DatedObservationContractError) {
    return "This response did not include a governed observation date, so it was not shown.";
  }
  return "Environmental context could not be loaded.";
}
