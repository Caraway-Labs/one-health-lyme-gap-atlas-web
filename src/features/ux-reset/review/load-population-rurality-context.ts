import {
  acceptPopulationRuralityRows,
  PopulationRuralityContractError,
  type PopulationRuralityMeasureId,
} from "@/features/ux-reset/review/population-rurality-context";
import { observationsV1ObservationsGet } from "@/generated/atlas";
import type { CountyContextObservation } from "@/generated/models";
import {
  ObservationsV1ObservationsGetResponse,
  observationsV1ObservationsGetQueryPageSizeOneMax,
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
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_CONTEXT_PAGES; page += 1) {
    if (input.signal.aborted) {
      throw new DOMException(
        "The population and rurality request was cancelled.",
        "AbortError"
      );
    }
    try {
      const response = await observationsV1ObservationsGet(
        {
          geography_id: [input.fips],
          geography_type: "county",
          measure_id: input.measureId,
          page_size: observationsV1ObservationsGetQueryPageSizeOneMax,
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
        ObservationsV1ObservationsGetResponse,
        response.data
      );
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
  return acceptPopulationRuralityRows({
    measureId: input.measureId,
    releaseId: input.releaseId,
    requestedFips: input.fips,
    rows: readContextObservations(rows),
  });
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
