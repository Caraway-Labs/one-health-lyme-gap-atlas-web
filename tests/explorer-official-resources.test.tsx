import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExplorerOfficialResources } from "@/features/ux-reset/review/explorer-official-resources";

const TOPICS = [
  "Lyme disease surveillance",
  "Tick and vector surveillance",
  "Clinical testing and reporting",
] as const;

describe("Explorer official resources card", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows one heading, the intro, and three topic groups", () => {
    render(<ExplorerOfficialResources />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Official resources" })
    ).toBeVisible();
    expect(
      screen.getByText(
        "Authoritative references to support surveillance review, reporting, and public health action."
      )
    ).toBeVisible();
    expect(screen.queryByText(/official resources & guidance/i)).toBeNull();
    expect(screen.queryByText("Resources for follow-up")).toBeNull();
    expect(
      screen
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent)
    ).toStrictEqual([...TOPICS]);
  });

  it("keeps the five external destinations in the approved order", () => {
    render(<ExplorerOfficialResources />);

    expect(screen.getAllByRole("list")).toHaveLength(3);
    expect(
      screen.getAllByRole("link").map((link) => ({
        hiddenIcon: link.querySelector("svg")?.getAttribute("aria-hidden"),
        href: link.getAttribute("href"),
        rel: link.getAttribute("rel"),
        target: link.getAttribute("target"),
        text: link.textContent,
      }))
    ).toStrictEqual([
      {
        hiddenIcon: "true",
        href: "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/",
        rel: "noopener noreferrer",
        target: "_blank",
        text: "Lyme surveillance case definition",
      },
      {
        hiddenIcon: "true",
        href: "https://www.cdc.gov/ticks/data-research/facts-stats/geographic-distribution-of-tickborne-disease-cases.html",
        rel: "noopener noreferrer",
        target: "_blank",
        text: "County case data and limitations",
      },
      {
        hiddenIcon: "true",
        href: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
        rel: "noopener noreferrer",
        target: "_blank",
        text: "Tick and pathogen record definitions",
      },
      {
        hiddenIcon: "true",
        href: "https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf",
        rel: "noopener noreferrer",
        target: "_blank",
        text: "Blacklegged tick surveillance guidance",
      },
      {
        hiddenIcon: "true",
        href: "https://www.cdc.gov/lyme/hcp/diagnosis-testing/index.html",
        rel: "noopener noreferrer",
        target: "_blank",
        text: "Clinical testing guidance",
      },
    ]);

    const lyme = screen
      .getByRole("heading", { name: "Lyme disease surveillance" })
      .closest("section");
    expect(lyme).toBeInstanceOf(HTMLElement);
    expect(within(lyme as HTMLElement).getAllByRole("listitem")).toHaveLength(
      2
    );
  });
});
