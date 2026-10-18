import { getDocsUrl, type PublicOriginEnvironment } from "@/lib/public-origins";

export type { PublicOriginEnvironment as PublicDocsEnvironment } from "@/lib/public-origins";
export { getDocsUrl } from "@/lib/public-origins";

export function getDocsHref(
  anchor?: string,
  environment?: PublicOriginEnvironment
): string {
  const docsUrl = getDocsUrl(environment);
  if (!anchor) return docsUrl;
  return new URL(
    anchor.startsWith("#") ? anchor : `#${anchor}`,
    docsUrl
  ).toString();
}

/** Link to a published docs page slug (for example `evidence-and-uncertainty`). */
export function getDocsPageHref(
  pageSlug: string,
  environment?: PublicOriginEnvironment
): string {
  const docsUrl = getDocsUrl(environment);
  const normalized = pageSlug.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized) return docsUrl;
  return new URL(normalized, `${docsUrl.replace(/\/$/, "")}/`).toString();
}
