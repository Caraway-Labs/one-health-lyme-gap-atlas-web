import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocsOpenGraphCard } from "../src/lib/docs-open-graph-card";

describe("docs open graph card", () => {
  afterEach(() => cleanup());

  it("renders the section, title, and brand mark", () => {
    render(
      <DocsOpenGraphCard
        markSrc="data:image/png;base64,aa"
        section="Developers"
        title="Quickstart"
      />
    );

    expect({
      footer: screen.getByText("One Health Atlas documentation").textContent,
      mark: document.querySelector("img")?.getAttribute("src"),
      section: screen.getByText("Developers").textContent,
      title: screen.getByText("Quickstart").textContent,
    }).toStrictEqual({
      footer: "One Health Atlas documentation",
      mark: "data:image/png;base64,aa",
      section: "Developers",
      title: "Quickstart",
    });
  });
});
