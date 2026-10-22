import type { ZodType } from "zod";

export class ApiResponseValidationError extends Error {
  readonly reason: string;

  constructor(resource: string, reason = "schema validation failed") {
    super(`${resource} could not be verified. Please try again later.`);
    this.name = "ApiResponseValidationError";
    this.reason = reason;
  }
}

const loggedUnverifiedResponses = new Set<string>();

/** One log line per endpoint, county, and reason. Render passes must not repeat it. */
export function logUnverifiedApiResponse(input: {
  endpoint: string;
  fips: string;
  reason: string;
}): void {
  const key = `${input.endpoint}\0${input.fips}\0${input.reason}`;
  if (loggedUnverifiedResponses.has(key)) {
    return;
  }
  loggedUnverifiedResponses.add(key);
  console.error(
    `Response could not be verified. endpoint=${input.endpoint} fips=${input.fips} reason=${input.reason}`
  );
}

function schemaFailureReason(error: {
  issues: readonly { message: string; path: readonly PropertyKey[] }[];
}): string {
  const summary = error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.map(String).join(".");
    return `${path.length > 0 ? path : "(root)"}: ${issue.message}`;
  });
  return summary.length > 0 ? summary.join("; ") : "schema validation failed";
}

export function validateApiResponse<T>(
  resource: string,
  schema: ZodType<T>,
  value: unknown
): T {
  if (
    value &&
    typeof value === "object" &&
    (("score" in value && "human_status" in value) ||
      ("counties" in value && "settings" in value)) &&
    (!("scoring_methodology_version" in value) ||
      value.scoring_methodology_version !== "surveillance-gap-score-v1.1")
  ) {
    throw new ApiResponseValidationError(
      `${resource} scoring version`,
      "scoring_methodology_version is not surveillance-gap-score-v1.1"
    );
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiResponseValidationError(
      resource,
      schemaFailureReason(result.error)
    );
  }
  return result.data;
}
