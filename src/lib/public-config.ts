import { z } from "zod";

const apiBaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://")
  );

const localApiBaseUrl = "http://localhost:8000";

// Next.js only inlines NEXT_PUBLIC_* values in browser bundles when referenced
// directly. Do not replace this with an indirect process.env lookup.
const deployedApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const deployedNodeEnv = process.env.NODE_ENV;

type PublicEnvironment = Record<string, string | undefined>;

export function getPublicConfig(
  environment?: PublicEnvironment
) {
  const apiBaseUrl = environment?.NEXT_PUBLIC_API_BASE_URL ?? deployedApiBaseUrl;
  const nodeEnv = environment?.NODE_ENV ?? deployedNodeEnv;
  if (!apiBaseUrl && nodeEnv !== "production") {
    return { apiBaseUrl: localApiBaseUrl };
  }

  const parsed = apiBaseUrlSchema.safeParse(apiBaseUrl);
  if (!parsed.success) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid HTTP(S) URL.");
  }
  return { apiBaseUrl: parsed.data };
}
