// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import config from "../next.config";
import sitemap from "../src/app/sitemap";
import {
  docsExportMatchesPinnedRelease,
  findPrivateDocsValue,
  markdownKindFromSuffix,
  pageSlugsFromContentSegments,
  publicMarkdownResponse,
  renderDocsExportIndex,
  renderPublicDocsPage,
  withAbsoluteSiteLinks,
} from "../src/lib/docs-llms-export";

const publicOpenApiManifest = JSON.parse(
  readFileSync("contracts/public-openapi.manifest.json", "utf-8")
) as { sha256: string; sourceCommit: string };

const apiReferenceSource = readFileSync(
  "content/docs/api-reference/index.mdx",
  "utf-8"
);

describe("documentation markdown exports", () => {
  it("rewrites docs index links to the deployment origin", () => {
    expect(
      withAbsoluteSiteLinks(
        "- [API reference](/docs/api-reference): Generated from the pinned contract.",
        "https://onehealthatlas.org"
      )
    ).toBe(
      "- [API reference](https://onehealthatlas.org/docs/api-reference): Generated from the pinned contract."
    );
  });

  it("keeps the index, full export, and per-page suffixes stable", () => {
    const index = renderDocsExportIndex(
      "# Atlas documentation\n\n- [Releases and methodology labels](/docs/releases-and-methodology): Plain-language definitions.",
      "https://onehealthatlas.org"
    );
    expect(index).toContain(
      "[Releases and methodology labels](https://onehealthatlas.org/docs/releases-and-methodology)"
    );
    expect(index).toContain(
      "[llms-full.txt](https://onehealthatlas.org/llms-full.txt)"
    );
    expect(index).toContain("Append `.md`");
    expect(index).toContain("Append `.mdx`");
    expect(index.endsWith("\n")).toBeTruthy();
  });

  it("renders one page from processed markdown without a second contract", () => {
    const page = renderPublicDocsPage({
      description: "Plain-language definitions for Atlas release snapshots.",
      processed:
        "The county review score is a **derived follow-up-priority measure**. It is not a diagnosis.\n\nSee [Evidence](/docs/evidence-and-uncertainty).",
      title: "Releases and methodology labels",
      url: "https://onehealthatlas.org/docs/releases-and-methodology",
    });
    expect(page).toContain(
      "# Releases and methodology labels (https://onehealthatlas.org/docs/releases-and-methodology)"
    );
    expect(page).toContain("It is not a diagnosis.");
    expect(page).toContain(
      "](https://onehealthatlas.org/docs/evidence-and-uncertainty)"
    );
    expect(page).not.toContain("openapi.json");
  });

  it("decodes processed and raw content suffixes", () => {
    expect(markdownKindFromSuffix("content.md")).toBe("processed");
    expect(markdownKindFromSuffix("content.mdx")).toBe("raw");
    expect(markdownKindFromSuffix("page.md")).toBeNull();
    expect(
      pageSlugsFromContentSegments(["develop", "support", "content.md"])
    ).toStrictEqual({ kind: "processed", slugs: ["develop", "support"] });
    expect(pageSlugsFromContentSegments(["content.txt"])).toBeNull();
  });

  it("maps folder index exports onto the folder page", () => {
    expect(
      pageSlugsFromContentSegments(["develop", "index", "content.mdx"])
    ).toStrictEqual({ kind: "raw", slugs: ["develop"] });
    expect(pageSlugsFromContentSegments(["content.md"])).toStrictEqual({
      kind: "processed",
      slugs: [],
    });
  });

  it("requires the current pinned OpenAPI commit and checksum", () => {
    expect(apiReferenceSource).toContain(publicOpenApiManifest.sourceCommit);
    expect(apiReferenceSource).toContain(publicOpenApiManifest.sha256);
    expect(
      docsExportMatchesPinnedRelease(apiReferenceSource, publicOpenApiManifest)
    ).toBeTruthy();
    expect(
      docsExportMatchesPinnedRelease("stale export without the pin", {
        sha256: publicOpenApiManifest.sha256,
        sourceCommit: publicOpenApiManifest.sourceCommit,
      })
    ).toBeFalsy();
  });

  it("recognizes private values in documentation text", () => {
    expect(findPrivateDocsValue("ordinary public docs")).toBeFalsy();
    expect(
      findPrivateDocsValue("-----BEGIN RSA PRIVATE KEY-----\nabc")
    ).toBeTruthy();
  });

  it("withholds exports that contain private values", async () => {
    const response = publicMarkdownResponse(
      "token sk-live-abcdefghijklmnopqrstuvwxyz\n"
    );
    const withheld = await response.text();
    expect(response.status).toBe(500);
    expect(withheld).toBe("Documentation export withheld.\n");
    expect(withheld).not.toContain("sk-live");
  });

  it("publishes a stable markdown response for public text", async () => {
    const body = "# Atlas documentation\n";
    const first = publicMarkdownResponse(body);
    const second = publicMarkdownResponse(body);
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(first.headers.get("etag")).toBe(second.headers.get("etag"));
    await expect(first.text()).resolves.toBe(body);
  });

  it("lists the export URLs from the sitemap and rewrites page suffixes", async () => {
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const previousDocs = process.env.NEXT_PUBLIC_DOCS_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_DOCS_URL;
    const entries = sitemap().map((entry) => entry.url);
    if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    if (previousDocs === undefined) delete process.env.NEXT_PUBLIC_DOCS_URL;
    else process.env.NEXT_PUBLIC_DOCS_URL = previousDocs;
    expect(entries).toContain("https://onehealthatlas.org/llms.txt");
    expect(entries).toContain("https://onehealthatlas.org/llms-full.txt");
    const rewrites = await config.rewrites?.();
    const rules = Array.isArray(rewrites)
      ? rewrites
      : [
          ...(rewrites?.beforeFiles ?? []),
          ...(rewrites?.afterFiles ?? []),
          ...(rewrites?.fallback ?? []),
        ];
    expect(rules).toStrictEqual(
      expect.arrayContaining([
        {
          destination: "/llms.mdx/docs/content.md",
          source: "/docs.md",
        },
        {
          destination: "/llms.mdx/docs/:slug*/content.mdx",
          source: "/docs/:slug*.mdx",
        },
      ])
    );
  });
});
