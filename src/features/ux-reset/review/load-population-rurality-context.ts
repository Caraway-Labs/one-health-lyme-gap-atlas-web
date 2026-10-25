import {
  createObservationSelectionAccumulator,
  observationAuthorityFailure,
} from "@/features/ux-reset/observations/selection-availability";
import {
  acceptPopulationRuralityRows,
  PopulationRuralityContractError,
  type PopulationRuralityMeasureId,
} from "@/features/ux-reset/review/population-rurality-context";
import { listObservations } from "@/generated/atlas";
import type { CountyContextObservation } from "@/generated/models";
import {
  ListObservationsResponse,
  listObservationsQueryPageSizeMax,
} from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  ApiResponseValidationError,
  validateApiResponse,
} from "@/lib/api-response-validation";

const MAX_CONTEXT_PAGES = 3;

function readContextObservations(
  rows: readonly unknown[]
): CountyContextObservation[] {
  const contextRows: CountyContextObservation[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || !("county_context" in row)) {
      throw new PopulationRuralityContractError(
        "A population and rurality request returned a dated observation."
      );
    }
    const record = row as { county_context?: unknown };
    if (record.county_context == null) {
      throw new PopulationRuralityContractError(
        "A population and rurality request returned a row without county context."
      );
    }
    contextRows.push(row as CountyContextObservation);
  }
  return contextRows;
}

/**
 * One county and one API 212 measure. The request sends vintage_year and
 * does not send year, start_date, or end_date. A 404 is absence, not zero.
 */
export async function fetchPopulationRuralityMeasure(input: {
  fips: string;
  measureId: PopulationRuralityMeasureId;
  releaseId: string;
  signal: AbortSignal;
  vintageYear: number;
}): Promise<ReturnType<typeof acceptPopulationRuralityRows>> {
  const rows: unknown[] = [];
  const seenTokens = new Set<string>();
  const selection = createObservationSelectionAccumulator({
    measureId: input.measureId,
    requestedReleaseId: input.releaseId,
  });
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_CONTEXT_PAGES; page += 1) {
    if (input.signal.aborted) {
      throw new DOMException(
        "The population and rurality request was cancelled.",
        "AbortError"
      );
    }
    try {
      const response = await listObservations(
        {
          geography_id: [input.fips],
          geography_type: "county",
          measure_id: input.measureId,
          page_size: listObservationsQueryPageSizeMax,
          ...(pageToken ? { page_token: pageToken } : {}),
          vintage_year: input.vintageYear,
        },
        { signal: input.signal }
      );
      if (response.status !== 200) {
        throw new AtlasApiError(
          "Population and rurality context could not be loaded.",
          "/v1/observations",
          response.status,
          null
        );
      }
      const parsed = validateApiResponse(
        "Population and rurality observations",
        ListObservationsResponse,
        response.data
      );
      selection.note({
        dataCount: parsed.data.length,
        meta: parsed.meta,
        pageToken,
      });
      rows.push(...parsed.data);
      const nextToken = parsed.meta.next_page_token ?? null;
      if (!nextToken || seenTokens.has(nextToken)) {
        break;
      }
      seenTokens.add(nextToken);
      pageToken = nextToken;
    } catch (error) {
      if (error instanceof AtlasApiError && error.status === 404) {
        return { kind: "absent" };
      }
      throw error;
    }
  }
  const accepted = acceptPopulationRuralityRows({
    measureId: input.measureId,
    releaseId: input.releaseId,
    requestedFips: input.fips,
    rows: readContextObservations(rows),
  });
  if (accepted.kind !== "absent") {
    return accepted;
  }
  const folded = selection.finish();
  const authorityFailure = observationAuthorityFailure(folded);
  if (authorityFailure === "release_mismatch") {
    throw new PopulationRuralityContractError(
      "Observation availability release does not match the requested release."
    );
  }
  if (authorityFailure === "malformed_authority") {
    throw new PopulationRuralityContractError(
      "Observation availability did not include a checked release and limitations."
    );
  }
  if (folded.kind === "known_unavailable") {
    return { kind: "absent", selection: folded.selection };
  }
  return { kind: "absent" };
}

export function populationRuralityLoadErrorMessage(error: unknown): string {
  if (
    error instanceof PopulationRuralityContractError ||
    error instanceof ApiResponseValidationError
  ) {
    return "This response did not match the selected county, measure, vintage, and release, so it was not shown.";
  }
  if (error instanceof AtlasApiError && error.status === 400) {
    return "This population and rurality filter is not supported, so nothing was shown.";
  }
  return "Population and rurality context could not be loaded.";
}
