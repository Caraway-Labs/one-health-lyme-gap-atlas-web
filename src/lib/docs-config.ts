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

/**
 * Absolute canonical URL for a docs page.
 * Relative Fumadocs URLs are joined to the configured docs origin, so a
 * preview site metadataBase cannot replace an explicit docs URL.
 */
export function docsCanonicalUrl(
  pageUrl: string,
  environment?: PublicOriginEnvironment
): string {
  const docsUrl = getDocsUrl(environment);
  const pathname =
    pageUrl.startsWith("http://") || pageUrl.startsWith("https://")
      ? new URL(pageUrl).pathname
      : pageUrl;
  if (pathname === "/docs" || pathname === "/docs/") return docsUrl;
  const suffix = pathname.startsWith("/docs/")
    ? pathname.slice("/docs/".length)
    : pathname.replace(/^\/+/, "");
  return new URL(suffix, `${docsUrl.replace(/\/$/, "")}/`).href;
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
