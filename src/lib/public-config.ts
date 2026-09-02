import { z } from "zod";

const apiBaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://")
  );

const localApiBaseUrl = "http://localhost:8000";

export function getPublicConfig(
  environment: Record<string, string | undefined> = process.env
) {
  const apiBaseUrl = environment.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl && environment.NODE_ENV !== "production") {
    return { apiBaseUrl: localApiBaseUrl };
  }

  const parsed = apiBaseUrlSchema.safeParse(apiBaseUrl);
  if (!parsed.success) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid HTTP(S) URL.");
  }
  return { apiBaseUrl: parsed.data };
}
