import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DesignSystemVisualFirstSpecimens } from "@/components/design-system-visual-first-specimens";

describe("design-system visual-first specimens", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a specimen for each new primitive family", () => {
    render(<DesignSystemVisualFirstSpecimens />);

    expect(screen.getByRole("tab", { name: "Shortlist" })).toBeTruthy();
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scenario" })).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("labels every icon in the vocabulary with text", () => {
    render(<DesignSystemVisualFirstSpecimens />);

    const list = screen.getByRole("list", { name: "Atlas icon vocabulary" });

    expect(list.textContent).toContain("Unavailable");
    expect(list.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(
      list.querySelectorAll("li").length
    );
  });
});
