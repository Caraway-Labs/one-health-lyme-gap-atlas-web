import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RankedCounties } from "../src/components/ranked-counties";

const county = {
  color: "#efc64a",
  county: "Adams",
  fips: "08001",
  priority: "Priority 2 — Review",
  score: { score: 61.9 },
  state: "CO",
} as never;

describe("Ranked counties presentation", () => {
  afterEach(cleanup);

  it("selects a county from the accessible ranked list", () => {
    const onSelect = vi.fn<(fips: string, surface: string) => void>();
    render(
      <RankedCounties
        counties={[county]}
        selectedFips=""
        showTable={false}
        onSelect={onSelect}
        onToggleTable={vi.fn<() => void>()}
      />
    );

    expect(screen.getByRole("complementary").textContent).toContain(
      "Counties to review"
    );
    expect(
      screen.getByRole("list", { name: "Counties suggested for review" })
        .textContent
    ).toContain("Adams, CO");
    fireEvent.click(screen.getByRole("button", { name: /Adams, CO/ }));
    expect(onSelect).toHaveBeenCalledWith("08001", "ranked_list");
  });

  it("toggles the full county list with a stable accessible name", () => {
    const onToggleTable = vi.fn<() => void>();
    const { rerender } = render(
      <RankedCounties
        counties={[county]}
        selectedFips=""
        showTable={false}
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
        onToggleTable={onToggleTable}
      />
    );

    const closed = screen.getByRole("button", {
      name: "View full county list",
    });
    expect(closed.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(closed);
    expect(onToggleTable).toHaveBeenCalledOnce();

    rerender(
      <RankedCounties
        counties={[county]}
        selectedFips=""
        showTable
        onSelect={vi.fn<(fips: string, surface: string) => void>()}
        onToggleTable={onToggleTable}
      />
    );

    expect(
      screen
        .getByRole("button", { name: "Hide full county list" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });
});
