import { readFileSync } from "node:fs";
import path from "node:path";

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GlossaryList, Term } from "@/features/docs/term";
import { getMDXComponents } from "@/mdx-components";

describe("glossary term control", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the term and its definition as plain text", () => {
    render(<Term id="value_state" />);

    expect(
      screen.getByRole("button", { name: "value_state" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "How to read value. Never treat a null value as zero."
    );
    expect(screen.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "href",
      "/docs/glossary#value_state"
    );
  });

  it("keeps custom label text and still resolves the definition", () => {
    render(<Term id="fips">FIPS</Term>);

    expect(screen.getByRole("button", { name: "FIPS" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Five-digit county FIPS code, with leading zeros."
    );
  });

  it("throws while rendering a missing term", () => {
    expect(() => render(<Term id="not-a-term" />)).toThrow(
      'Unknown glossary term "not-a-term".'
    );
  });

  it("renders alphabetical anchors from the glossary source", () => {
    render(<GlossaryList />);
    const headings = screen.getAllByRole("heading").map((heading) => ({
      id: heading.closest("section")?.id,
      name: heading.textContent,
    }));

    expect(headings[0]).toStrictEqual({
      id: "availability",
      name: "availability",
    });
    expect(headings.map((heading) => heading.name)).toStrictEqual(
      headings
        .map((heading) => heading.name)
        .sort((left, right) =>
          (left ?? "").localeCompare(right ?? "", "en", { sensitivity: "base" })
        )
    );
    expect(headings.length).toBeGreaterThanOrEqual(25);
  });

  it("registers Term and GlossaryList for MDX pages", () => {
    const components = getMDXComponents();
    const navigation = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "content", "docs", "meta.json"),
        "utf-8"
      )
    ) as { pages?: string[] };
    const pages = navigation.pages ?? [];

    expect(components.Term).toBe(Term);
    expect(components.GlossaryList).toBe(GlossaryList);
    expect(pages.indexOf("glossary")).toBe(
      pages.indexOf("---Resources---") + 1
    );
  });
});
