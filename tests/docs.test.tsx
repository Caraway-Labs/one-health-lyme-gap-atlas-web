import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocsLink } from "@/components/docs-link";
import { getDocsHref, getDocsUrl } from "@/lib/docs-config";

describe("documentation configuration", () => {
  afterEach(() => cleanup());

  it("uses the canonical public docs URL by default", () => {
    expect(getDocsUrl({})).toBe("https://carawaylabs.com/docs");
    expect(getDocsHref("missing-is-not-zero")).toBe(
      "https://carawaylabs.com/docs#missing-is-not-zero"
    );
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
      name: "Open Atlas documentation (opens in a new tab)",
    });

    expect(link.getAttribute("href")).toBe("https://carawaylabs.com/docs");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
