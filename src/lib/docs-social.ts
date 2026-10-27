import type { Metadata } from "next";

import {
  DOCS_SITE_TITLE,
  docsCanonicalUrl,
  type PublicDocsEnvironment,
} from "@/lib/docs-config";

/** Blob ref for "Edit on GitHub". Docs edits land on the default branch. */
export const DOCS_GITHUB_REF = "main";

export const DOCS_REPOSITORY = {
  owner: "Caraway-Labs",
  repo: "one-health-lyme-gap-atlas-web",
} as const;

export const DOCS_CONTENT_DIRECTORY = "content/docs";

export const DOCS_OPEN_GRAPH_SIZE = {
  height: 630,
  width: 1200,
} as const;

const PRODUCT_GUIDE = "Product guide";
const DEVELOPERS = "Developers";
const API_REFERENCE = "API reference";

/**
 * Sidebar section for a docs URL. Product guide is the home section.
 * Developers and API reference match the root folders in the docs tree.
 */
export function docsSectionLabel(pageUrl: string): string {
  const pathname = pagePathname(pageUrl);
  if (
    pathname === "/docs/api-reference" ||
    pathname.startsWith("/docs/api-reference/")
  ) {
    return API_REFERENCE;
  }
  if (pathname === "/docs/develop" || pathname.startsWith("/docs/develop/")) {
    return DEVELOPERS;
  }
  return PRODUCT_GUIDE;
}

/** Repo path of a Fumadocs page file, relative to the repository root. */
export function docsGithubEditPath(pagePath: string): string {
  const normalized = pagePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized.startsWith(`${DOCS_CONTENT_DIRECTORY}/`)) return normalized;
  return `${DOCS_CONTENT_DIRECTORY}/${normalized}`;
}

export function docsGithubEditHref(pagePath: string): string {
  const filePath = docsGithubEditPath(pagePath);
  return `https://github.com/${DOCS_REPOSITORY.owner}/${DOCS_REPOSITORY.repo}/blob/${DOCS_GITHUB_REF}/${filePath}`;
}

/** Public path of the generated social image for a docs page. */
export function docsOpenGraphImagePath(pageUrl: string): string {
  const pathname = pagePathname(pageUrl);
  if (pathname === "/docs") return "/docs/og/image.png";
  const slug = pathname.startsWith("/docs/")
    ? pathname.slice("/docs/".length)
    : pathname.replace(/^\/+/, "");
  return `/docs/og/${slug}/image.png`;
}

/** Alt text for the social image. The image repeats the title and section. */
export function docsOpenGraphAlt(title: string, section: string): string {
  return `${title} (${section}) — One Health Atlas documentation`;
}

export function docsPageSocialMetadata(
  page: { description?: string; title: string; url: string },
  environment?: PublicDocsEnvironment
): Metadata {
  const section = docsSectionLabel(page.url);
  const canonical = docsCanonicalUrl(page.url, environment);
  const imageUrl = docsCanonicalUrl(
    docsOpenGraphImagePath(page.url),
    environment
  );
  const alt = docsOpenGraphAlt(page.title, section);
  const title = `${page.title} | ${DOCS_SITE_TITLE}`;
  const image = {
    alt,
    height: DOCS_OPEN_GRAPH_SIZE.height,
    url: imageUrl,
    width: DOCS_OPEN_GRAPH_SIZE.width,
  };

  return {
    alternates: { canonical },
    description: page.description,
    openGraph: {
      description: page.description,
      images: [image],
      siteName: "One Health Atlas",
      title,
      type: "article",
      url: canonical,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description: page.description,
      images: [image],
      title,
    },
  };
}

function pagePathname(pageUrl: string): string {
  const pathname =
    pageUrl.startsWith("http://") || pageUrl.startsWith("https://")
      ? new URL(pageUrl).pathname
      : pageUrl;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}
