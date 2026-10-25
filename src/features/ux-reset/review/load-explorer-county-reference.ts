import {
  countyReferenceFromScoreSummaries,
  type ExplorerCountyReference,
} from "@/features/ux-reset/review/explorer-county-reference";
import { getAtlasScores } from "@/generated/atlas";
import { GetAtlasScoresResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";

class ExplorerCountyReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplorerCountyReferenceError";
  }
}

/** Published score rows reduced to county identity and existing availability fields. */
export async function fetchExplorerCountyReference(
  releaseId: string,
  signal: AbortSignal
): Promise<ExplorerCountyReference[]> {
  const response = await getAtlasScores(
    { dataset_version: releaseId },
    { signal }
  );
  if (response.status !== 200) {
    throw new AtlasApiError(
      "County geography is temporarily unavailable.",
      "/v1/atlas/scores",
      response.status,
      null
    );
  }
  const parsed = validateApiResponse(
    "Atlas scores",
    GetAtlasScoresResponse,
    response.data
  );
  if (parsed.release_id !== releaseId) {
    throw new ExplorerCountyReferenceError(
      "County reference release does not match the requested release."
    );
  }
  return countyReferenceFromScoreSummaries(parsed.counties);
}
