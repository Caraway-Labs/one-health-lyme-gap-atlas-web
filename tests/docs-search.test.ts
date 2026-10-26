import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { createFromSource } from "fumadocs-core/search/server";
import { describe, expect, it } from "vitest";

import {
  buildDocsSearchIndex,
  DOCS_SEARCH_TAGS,
  docsSearchTag,
  isDocsSearchTag,
  type DocsSearchTag,
} from "@/lib/docs-search";
import { docsSource } from "@/lib/docs-source";

const DOCS_ROOT = path.join(process.cwd(), "content", "docs");
const FIXED_QUERIES = [
  "page_token",
  "value_state",
  "429",
  "FIPS",
  "provenance",
] as const;
/**
 * English search export after schema field tables, examples, and search tags.
 * A jump past this size means the index is repeating reference text.
 */
const INDEX_BYTES_BEFORE = 5_266_930;

function pageUrl(file: string): string {
  const relative = path
    .relative(DOCS_ROOT, file)
    .replaceAll("\\", "/")
    .replace(/\.mdx$/, "");
  const slug = relative.endsWith("/index")
    ? relative.slice(0, -"/index".length)
    : relative === "index"
      ? ""
      : relative;
  return slug.length > 0 ? `/docs/${slug}` : "/docs";
}

function mdxFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...mdxFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".mdx")) files.push(fullPath);
  }
  return files;
}

function contentFolder(file: string): string {
  const relative = path.relative(DOCS_ROOT, file).replaceAll("\\", "/");
  const slash = relative.indexOf("/");
  return slash === -1 ? "(root)" : relative.slice(0, slash);
}

function pagePath(url: string): string {
  const path = url.split("#", 1)[0] ?? url;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

describe("docs search tags", () => {
  it("assigns Product, Guide, Reference, or MCP for each content folder", () => {
    const tagsByFolder = new Map<string, Set<DocsSearchTag>>();
    for (const file of mdxFiles(DOCS_ROOT)) {
      const folder = contentFolder(file);
      const tags = tagsByFolder.get(folder) ?? new Set<DocsSearchTag>();
      tags.add(docsSearchTag(pageUrl(file)));
      tagsByFolder.set(folder, tags);
    }

    expect({
      folders: {
        "(root)": [...(tagsByFolder.get("(root)") ?? [])].sort(),
        "api-reference": [...(tagsByFolder.get("api-reference") ?? [])].sort(),
        develop: [...(tagsByFolder.get("develop") ?? [])].sort(),
      },
      pages: {
        mcpClients: docsSearchTag("/docs/develop/mcp-clients"),
        productAccess: docsSearchTag("/docs/api-mcp-and-access"),
        quickstart: docsSearchTag("/docs/develop/quickstart"),
        referenceRoot: docsSearchTag("/docs/api-reference"),
      },
      vocabulary: [...DOCS_SEARCH_TAGS],
    }).toStrictEqual({
      folders: {
        "(root)": ["Product"],
        "api-reference": ["Reference"],
        develop: ["Guide", "MCP"],
      },
      pages: {
        mcpClients: "MCP",
        productAccess: "Product",
        quickstart: "Guide",
        referenceRoot: "Reference",
      },
      vocabulary: ["Product", "Guide", "Reference", "MCP"],
    });
  });

  it("tags every built page and keeps the fixed queries on a guide or reference page", async () => {
    const tags = new Map<string, DocsSearchTag>();
    const missingTags: string[] = [];
    for (const page of docsSource.getPages()) {
      const indexed = await buildDocsSearchIndex(page);
      if (
        !isDocsSearchTag(indexed.tag) ||
        indexed.tag !== docsSearchTag(page.url)
      ) {
        missingTags.push(page.url);
        continue;
      }
      tags.set(page.url, indexed.tag);
    }

    const api = createFromSource(docsSource, {
      buildIndex: buildDocsSearchIndex,
      language: "english",
    });
    const exported = await api.export();
    const bytes = Buffer.byteLength(JSON.stringify(exported), "utf-8");
    const queryMisses: string[] = [];
    for (const query of FIXED_QUERIES) {
      const hits = await api.search(query);
      const top = hits.slice(0, 3).map((hit) => ({
        tag: tags.get(pagePath(hit.url)),
        type: hit.type,
        url: hit.url,
      }));
      if (!top.some((hit) => hit.tag === "Guide" || hit.tag === "Reference")) {
        queryMisses.push(`${query} ${JSON.stringify(top)}`);
      }
    }

    const referenceHits = await api.search("provenance", { tag: "Reference" });
    const guideHits = await api.search("page_token", { tag: "Guide" });
    expect({
      bytesWithinBaseline: bytes <= INDEX_BYTES_BEFORE,
      guideOnly:
        guideHits.length > 0 &&
        guideHits.every((hit) => tags.get(pagePath(hit.url)) === "Guide"),
      missingTags,
      queryMisses,
      referenceOnly:
        referenceHits.length > 0 &&
        referenceHits.every(
          (hit) => tags.get(pagePath(hit.url)) === "Reference"
        ),
    }).toStrictEqual({
      bytesWithinBaseline: true,
      guideOnly: true,
      missingTags: [],
      queryMisses: [],
      referenceOnly: true,
    });
  });
});
