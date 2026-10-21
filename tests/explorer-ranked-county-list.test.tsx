import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExplorerRankedCounty } from "@/features/ux-reset/review/explorer-ranked-counties";
import { ExplorerRankedCountyList } from "@/features/ux-reset/review/explorer-ranked-county-list";

const ROWS: ExplorerRankedCounty[] = [
  {
    color: "#c2410c",
    completeness: 60,
    county: "Barbour County",
    fips: "01005",
    rank: 1,
    score: 71.2,
    state: "AL",
  },
  {
    color: "#0f766e",
    completeness: 94,
    county: "Autauga County",
    fips: "01001",
    rank: 2,
    score: 40,
    state: "AL",
  },
  {
    color: null,
    completeness: null,
    county: "Bullock County",
    fips: "01011",
    rank: 3,
    score: 12.5,
    state: "AL",
  },
  {
    color: null,
    completeness: null,
    county: "Butler County",
    fips: "01013",
    rank: null,
    score: null,
    state: "AL",
  },
];

function renderList(
  props: Partial<Parameters<typeof ExplorerRankedCountyList>[0]> = {}
) {
  const onSelect = vi.fn<(fips: string) => void>();
  render(
    <ExplorerRankedCountyList
      emptyLabel="No counties in this scope."
      rows={ROWS}
      scopeKey="AL"
      selectedFips="01001"
      testId="explorer-county-row"
      onSelect={onSelect}
      {...props}
    />
  );
  return { onSelect };
}

function rowOrder() {
  return screen
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("button").dataset.fips);
}

describe(ExplorerRankedCountyList, () => {
  afterEach(() => {
    cleanup();
  });

  it("lists scored counties first and the unscored county after a divider", () => {
    renderList();

    expect(rowOrder()).toStrictEqual(["01005", "01001", "01011", "01013"]);
    expect(screen.getByText("No published Atlas gap score")).toBeTruthy();
    const unscored = screen.getByRole("button", { name: /Butler County/ });
    expect(unscored.textContent).toContain("No score");
    expect(unscored.textContent).toContain("Not ranked");
  });

  it("marks only the selected county as current", () => {
    renderList();

    expect(
      screen
        .getByRole("button", { name: /Autauga County/ })
        .getAttribute("aria-current")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /Barbour County/ })
        .getAttribute("aria-current")
    ).toBeNull();
  });

  it("selects a county by FIPS when its row is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList();

    await user.click(screen.getByRole("button", { name: /Bullock County/ }));

    expect(onSelect).toHaveBeenCalledWith("01011");
  });

  it("sorts by name and by evidence without dropping or re-ranking rows", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByTestId("explorer-sort-name"));
    expect(rowOrder()).toStrictEqual(["01001", "01005", "01011", "01013"]);

    await user.click(screen.getByTestId("explorer-sort-evidence"));
    // 94, 60, then the two counties with no completeness stay last, scored
    // before the unscored one. Missing completeness is never sorted as zero.
    expect(rowOrder()).toStrictEqual(["01001", "01005", "01011", "01013"]);
    expect(
      screen.getByRole("button", { name: /Barbour County/ }).dataset.rank
    ).toBe("1");
  });

  it("returns to the published order when the active sort is toggled off", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByTestId("explorer-sort-name"));
    await user.click(screen.getByTestId("explorer-sort-name"));

    expect(rowOrder()).toStrictEqual(["01005", "01001", "01011", "01013"]);
  });

  it("shows an evidence meter only where completeness was published", () => {
    renderList();

    const meters = screen.getAllByTestId("explorer-ranked-evidence");
    expect(meters).toHaveLength(4);
    expect(
      screen.getAllByRole("meter", { name: "Evidence completeness" })
    ).toHaveLength(2);
    expect(screen.getByText("94%")).toBeTruthy();
  });

  it("states that scenario scores are showing when a scenario is active", () => {
    renderList({ scenarioActive: true });

    expect(
      screen.getByTestId("explorer-list-scenario-badge").textContent
    ).toContain("Scenario scores");
  });

  it("omits the scenario badge and sort control for the default view of one county", () => {
    renderList({ rows: [ROWS[0] as ExplorerRankedCounty] });

    expect(screen.queryByTestId("explorer-list-scenario-badge")).toBeNull();
    expect(screen.queryByTestId("explorer-ranked-sort")).toBeNull();
  });

  it("renders the shortlist note and a candidate test id", () => {
    renderList({
      candidateFips: new Set(["01005"]),
      note: "Showing the top counties nationwide.",
    });

    expect(
      screen.getByTestId("explorer-national-shortlist-note").textContent
    ).toBe("Showing the top counties nationwide.");
    expect(
      screen.getByRole("button", { name: /Barbour County/ }).dataset.testid
    ).toBe("review-candidate");
  });

  it("shows the empty label when no county is in scope", () => {
    renderList({ rows: [] });

    expect(screen.getByTestId("explorer-ranked-empty").textContent).toBe(
      "No counties in this scope."
    );
    expect(screen.queryByRole("list", { name: "Ranked counties" })).toBeNull();
  });

  it("resets the sort when the scope changes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(fips: string) => void>();
    const { rerender } = render(
      <ExplorerRankedCountyList
        emptyLabel="none"
        rows={ROWS}
        scopeKey="AL"
        selectedFips=""
        testId="explorer-county-row"
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByTestId("explorer-sort-name"));
    expect(rowOrder()[0]).toBe("01001");

    rerender(
      <ExplorerRankedCountyList
        emptyLabel="none"
        rows={ROWS}
        scopeKey="GA"
        selectedFips=""
        testId="explorer-county-row"
        onSelect={onSelect}
      />
    );

    expect(rowOrder()[0]).toBe("01005");
  });
});
