import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import type { AdvancedIndex } from "fumadocs-core/search/server";

/**
 * Search tags offered in the docs dialog.
 * Folder defaults: `/docs/develop` is Guide, `/docs/api-reference` is
 * Reference, and every other docs page is Product. The MCP client guide is
 * the MCP tag so that filter has a page.
 */
export const DOCS_SEARCH_TAGS = [
  "Product",
  "Guide",
  "Reference",
  "MCP",
] as const;

export type DocsSearchTag = (typeof DOCS_SEARCH_TAGS)[number];

export function isDocsSearchTag(value: unknown): value is DocsSearchTag {
  return (
    value === "Product" ||
    value === "Guide" ||
    value === "Reference" ||
    value === "MCP"
  );
}

export const DOCS_SEARCH_DIALOG_TAGS: { name: string; value: DocsSearchTag }[] =
  DOCS_SEARCH_TAGS.map((tag) => ({ name: tag, value: tag }));

const GUIDE_ROOT = "/docs/develop";
const REFERENCE_ROOT = "/docs/api-reference";
const MCP_CLIENTS_PAGE = "/docs/develop/mcp-clients";

type DocsSearchPage = {
  data: {
    description?: string;
    load?: () => Promise<{ structuredData?: StructuredData }>;
    structuredData?: StructuredData | (() => Promise<StructuredData>);
    title?: string;
  };
  url: string;
};

export function docsSearchTag(url: string): DocsSearchTag {
  const path = normalizedDocsPath(url);
  if (path === MCP_CLIENTS_PAGE) return "MCP";
  if (path === REFERENCE_ROOT || path.startsWith(`${REFERENCE_ROOT}/`)) {
    return "Reference";
  }
  if (path === GUIDE_ROOT || path.startsWith(`${GUIDE_ROOT}/`)) return "Guide";
  return "Product";
}

export async function buildDocsSearchIndex(
  page: DocsSearchPage
): Promise<AdvancedIndex> {
  return {
    description: page.data.description,
    id: page.url,
    structuredData: await readStructuredData(page),
    tag: docsSearchTag(page.url),
    title: page.data.title ?? page.url,
    url: page.url,
  };
}

function normalizedDocsPath(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isStructuredData(value: unknown): value is StructuredData {
  if (typeof value !== "object" || value === null) return false;
  if (!("headings" in value) || !("contents" in value)) return false;
  return Array.isArray(value.headings) && Array.isArray(value.contents);
}

async function readStructuredData(
  page: DocsSearchPage
): Promise<StructuredData> {
  const direct = page.data.structuredData;
  if (typeof direct === "function") {
    const resolved = await direct();
    if (isStructuredData(resolved)) return resolved;
  } else if (isStructuredData(direct)) {
    return direct;
  }
  if (typeof page.data.load === "function") {
    const loaded = await page.data.load();
    if (isStructuredData(loaded.structuredData)) return loaded.structuredData;
  }
  throw new Error(
    "Cannot find structured data from page, please define the page to index function."
  );
}
