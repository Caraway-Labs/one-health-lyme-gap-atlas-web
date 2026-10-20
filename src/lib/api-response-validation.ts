import type { ZodType } from "zod";

export class ApiResponseValidationError extends Error {
  constructor(resource: string) {
    super(`${resource} could not be verified. Please try again later.`);
    this.name = "ApiResponseValidationError";
  }
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
    throw new ApiResponseValidationError(`${resource} scoring version`);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiResponseValidationError(resource);
  }
  return result.data;
}
