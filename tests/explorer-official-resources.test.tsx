import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExplorerOfficialResources } from "@/features/ux-reset/review/explorer-official-resources";

const TOPICS = [
  "Human disease surveillance",
  "Tick and pathogen surveillance",
  "Clinical and laboratory testing",
  "Prevention and outreach",
  "Community context",
  "Examples from state programs",
] as const;

describe("Explorer official resources card", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows every resource group once, with publisher context", () => {
    render(<ExplorerOfficialResources />);

    const links = screen.getAllByRole("link");
    expect({
      groups: screen
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent),
      intro: screen.getByText("Guidance to support your review.").textContent,
      links: links.length,
      note: screen.getByText(/Follow your own state’s/).textContent,
      title: screen.getByRole("heading", {
        level: 3,
        name: "Official resources",
      }).textContent,
      unique: new Set(links.map((link) => link.getAttribute("href"))).size,
      viewAll: screen.getByRole("link", { name: "View all resources →" })
        .getAttribute("href"),
    }).toStrictEqual({
      groups: [...TOPICS],
      intro: "Guidance to support your review.",
      links: 16,
      note: expect.stringContaining("Examples from other state programs"),
      title: "Official resources",
      unique: 16,
      viewAll: "/resources",
    });
  });

  it("carries a selected county state into the resources page once", () => {
    render(<ExplorerOfficialResources stateCode="ID" />);

    expect(
      screen
        .getByRole("link", { name: "View all resources →" })
        .getAttribute("href")
    ).toBe("/resources?state=ID#state-resources");
  });
});
