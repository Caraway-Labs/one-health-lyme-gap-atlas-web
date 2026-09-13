import { z } from "zod";

const DEFAULT_DOCS_URL = "https://carawaylabs.com/docs";
const docsUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.pathname === "/docs";
  }, "The Atlas docs URL must be an HTTPS /docs URL.");

const deployedDocsUrl = process.env.NEXT_PUBLIC_DOCS_URL;

export type PublicDocsEnvironment = {
  NEXT_PUBLIC_DOCS_URL?: string;
};

export function getDocsUrl(environment?: PublicDocsEnvironment): string {
  const configuredUrl =
    environment?.NEXT_PUBLIC_DOCS_URL ?? deployedDocsUrl ?? DEFAULT_DOCS_URL;
  const parsed = docsUrlSchema.safeParse(configuredUrl);

  if (!parsed.success) {
    throw new Error("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
  }

  return parsed.data;
}

export function getDocsHref(anchor?: string): string {
  if (!anchor) return getDocsUrl();
  return new URL(
    anchor.startsWith("#") ? anchor : `#${anchor}`,
    getDocsUrl()
  ).toString();
}
