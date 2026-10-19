// @vitest-environment jsdom
import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { pageSlugsFromContentSegments } from "@/lib/docs-llms-export";
import {
  copyPageMarkdown,
  copyWithDocumentExecCommand,
  docsPageActionKind,
  docsPageActionPath,
} from "@/lib/docs-page-actions";
const actions = ["copy-markdown", "view-source"] as const;

function exportSegments(publicPath: string): string[] {
  if (publicPath === "/docs.md") return ["content.md"];
  if (publicPath === "/docs.mdx") return ["content.mdx"];
  const nested = /^\/docs\/(?<slug>.+)(?<suffix>\.mdx?)$/.exec(publicPath);
  const slug = nested?.groups?.slug;
  const suffix = nested?.groups?.suffix;
  if (!slug || (suffix !== ".md" && suffix !== ".mdx")) {
    throw new Error(`Unexpected documentation export path: ${publicPath}`);
  }
  return [...slug.split("/"), `content${suffix}`];
}

describe("documentation page action content", () => {
  it("selects processed markdown to copy and raw markdown to view", () => {
    expect(docsPageActionKind("copy-markdown")).toBe("processed");
    expect(docsPageActionKind("view-source")).toBe("raw");
  });

  it("builds the public export paths for index and nested pages", () => {
    expect(docsPageActionPath("/docs", "copy-markdown")).toBe("/docs.md");
    expect(docsPageActionPath("/docs/", "view-source")).toBe("/docs.mdx");
    expect(docsPageActionPath("/docs/develop/support", "copy-markdown")).toBe(
      "/docs/develop/support.md"
    );
    expect(docsPageActionPath("/docs/develop", "view-source")).toBe(
      "/docs/develop.mdx"
    );
  });

  it("points every current page at the export that decodes to that page", () => {
    const pages = documentationPages(path.join("content", "docs"));
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      for (const action of actions) {
        const decoded = pageSlugsFromContentSegments(
          exportSegments(docsPageActionPath(page.url, action))
        );
        expect(decoded).toStrictEqual({
          kind: docsPageActionKind(action),
          slugs: page.slugs,
        });
      }
    }
  });
});

function documentationPages(
  directory: string,
  slugs: string[] = []
): { slugs: string[]; url: string }[] {
  const pages: { slugs: string[]; url: string }[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const nested = documentationPages(path.join(directory, entry.name), [
        ...slugs,
        entry.name,
      ]);
      for (const page of nested) pages.push(page);
      continue;
    }
    if (!entry.name.endsWith(".mdx")) continue;
    const pageSlugs =
      entry.name === "index.mdx" ? slugs : [...slugs, entry.name.slice(0, -4)];
    pages.push({
      slugs: pageSlugs,
      url: pageSlugs.length === 0 ? "/docs" : `/docs/${pageSlugs.join("/")}`,
    });
  }
  return pages;
}

describe("documentation page markdown copy fallback", () => {
  it("uses the clipboard API when it accepts the text", async () => {
    const writeText = vi.fn<(value: string) => Promise<void>>(async () => {
      await Promise.resolve();
    });
    const fallbackCopy = vi.fn<(value: string) => boolean>(() => true);
    await expect(
      copyPageMarkdown("page markdown", { writeText }, fallbackCopy)
    ).resolves.toStrictEqual({ method: "clipboard", status: "copied" });
    expect(writeText).toHaveBeenCalledWith("page markdown");
    expect(fallbackCopy).not.toHaveBeenCalled();
  });

  it("falls back when the clipboard API is missing or rejects", async () => {
    const fallbackCopy = vi.fn<(value: string) => boolean>(() => true);
    await expect(
      copyPageMarkdown("exported markdown", undefined, fallbackCopy)
    ).resolves.toStrictEqual({ method: "fallback", status: "copied" });
    const writeText = vi.fn<(value: string) => Promise<void>>(async () => {
      await Promise.resolve();
      throw new Error("clipboard denied");
    });
    await expect(
      copyPageMarkdown("exported markdown", { writeText }, fallbackCopy)
    ).resolves.toStrictEqual({ method: "fallback", status: "copied" });
    expect(fallbackCopy).toHaveBeenCalledTimes(2);
    expect(fallbackCopy).toHaveBeenNthCalledWith(1, "exported markdown");
    expect(fallbackCopy).toHaveBeenNthCalledWith(2, "exported markdown");
  });

  it("reports an unavailable clipboard when the fallback also fails", async () => {
    await expect(
      copyPageMarkdown("exported markdown", null, () => false)
    ).resolves.toStrictEqual({ status: "unavailable" });
  });

  it("copies through the document command and removes the temporary field", () => {
    const execCommand = vi.fn<(command: string) => boolean>(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    expect(copyWithDocumentExecCommand("selected markdown")).toBeTruthy();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    const withoutCommand = {
      body: document.createElement("div"),
      createElement: document.createElement.bind(document),
    } as unknown as Document;
    expect(
      copyWithDocumentExecCommand("selected markdown", withoutCommand)
    ).toBeFalsy();
  });
});
