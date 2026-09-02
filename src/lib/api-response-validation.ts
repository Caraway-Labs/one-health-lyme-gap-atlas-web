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
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiResponseValidationError(resource);
  }
  return result.data;
}
