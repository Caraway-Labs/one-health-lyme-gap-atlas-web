import { readFile } from "node:fs/promises";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocsLink } from "@/components/docs-link";
import {
  docsCanonicalUrl,
  getDocsHref,
  getDocsPageHref,
  getDocsUrl,
} from "@/lib/docs-config";

describe("documentation configuration", () => {
  afterEach(() => cleanup());

  it("uses the canonical public docs URL by default", () => {
    expect(getDocsUrl({})).toBe("https://onehealthatlas.org/docs");
    expect(getDocsHref("missing-is-not-zero", {})).toBe(
      "https://onehealthatlas.org/docs#missing-is-not-zero"
    );
    expect(getDocsPageHref("evidence-and-uncertainty", {})).toBe(
      "https://onehealthatlas.org/docs/evidence-and-uncertainty"
    );
  });

  it("keeps docs canonicals on the configured docs URL when the site is a preview", async () => {
    const pageSource = await readFile(
      "src/app/docs/[[...slug]]/page.tsx",
      "utf-8"
    );
    const socialSource = await readFile("src/lib/docs-social.ts", "utf-8");
    expect(pageSource).toContain("docsPageSocialMetadata");
    expect(socialSource).toContain("docsCanonicalUrl(page.url, environment)");
    expect(socialSource).toContain("docsOpenGraphImagePath(page.url)");
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const previousDocs = process.env.NEXT_PUBLIC_DOCS_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example";
    process.env.NEXT_PUBLIC_DOCS_URL = "https://onehealthatlas.org/docs";
    try {
      expect(docsCanonicalUrl("/docs")).toBe("https://onehealthatlas.org/docs");
      expect(docsCanonicalUrl("/docs/develop/support")).toBe(
        "https://onehealthatlas.org/docs/develop/support"
      );
    } finally {
      if (previousSite === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previousSite;
      }
      if (previousDocs === undefined) {
        delete process.env.NEXT_PUBLIC_DOCS_URL;
      } else {
        process.env.NEXT_PUBLIC_DOCS_URL = previousDocs;
      }
    }
  });

  it("follows a preview site origin when the docs URL is not set separately", () => {
    expect(
      getDocsPageHref("api-reference", {
        NEXT_PUBLIC_SITE_URL: "https://preview.example",
      })
    ).toBe("https://preview.example/docs/api-reference");
  });

  it("rejects non-canonical docs origins and paths", () => {
    expect(() =>
      getDocsUrl({ NEXT_PUBLIC_DOCS_URL: "http://example.com/docs" })
    ).toThrow("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
    expect(() =>
      getDocsUrl({ NEXT_PUBLIC_DOCS_URL: "https://example.com/help" })
    ).toThrow("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
  });

  it("opens the docs link securely in a new tab", () => {
    render(<DocsLink />);
    const link = screen.getByRole("link", {
      name: "Open One Health Atlas documentation (opens in a new tab)",
    });

    expect(link.getAttribute("href")).toBe("https://onehealthatlas.org/docs");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
