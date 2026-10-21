import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExplorerCountyReference } from "@/features/ux-reset/review/explorer-county-reference";
import { ExplorerCountyToolbar } from "@/features/ux-reset/review/explorer-county-toolbar";
import type { EvidenceView } from "@/lib/atlas-ui";

const counties: ExplorerCountyReference[] = [
  {
    burgdorferiStatus: "Present",
    county: "Autauga",
    evidenceCompleteness: 80,
    fips: "01001",
    humanStatus: "published_count_floor",
    state: "AL",
    stateName: "Alabama",
    tickStatus: "Established",
  },
  {
    burgdorferiStatus: "No records",
    county: "Baldwin",
    evidenceCompleteness: 1,
    fips: "01003",
    humanStatus: "missing",
    state: "AL",
    stateName: "Alabama",
    tickStatus: "No records",
  },
  {
    burgdorferiStatus: "Present",
    county: "Bullock County",
    evidenceCompleteness: 80,
    fips: "01011",
    humanStatus: "published_count_floor",
    state: "AL",
    stateName: "Alabama",
    tickStatus: "Established",
  },
];

function ToolbarHarness({
  onClearSelection,
  onCountySelect,
}: {
  onClearSelection: () => void;
  onCountySelect: (county: ExplorerCountyReference) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [availableData, setAvailableData] = useState<EvidenceView>("all");
  return (
    <ExplorerCountyToolbar
      availableData={availableData}
      counties={counties}
      countyQuery={query}
      scope="AL"
      scopeLabel="Alabama"
      selectedFips={selectedFips}
      stateOptions={[{ code: "AL", name: "Alabama" }]}
      onAvailableDataChange={setAvailableData}
      onClearSelection={() => {
        setQuery("");
        setSelectedFips(null);
        onClearSelection();
      }}
      onCountyQueryChange={setQuery}
      onCountySelect={(county) => {
        setQuery(county.fips);
        setSelectedFips(county.fips);
        onCountySelect(county);
      }}
      onScopeChange={vi.fn<() => void>()}
    />
  );
}

describe("explorer county toolbar", () => {
  afterEach(() => {
    cleanup();
  });

  it("names the controls and shows geography and the filtered count", () => {
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
      />
    );
    expect(screen.getByRole("combobox", { name: "State" })).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "County name or five-digit FIPS" })
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Available data" })
    ).toBeTruthy();
    expect(screen.getByTestId("explorer-filter-count").textContent).toBe(
      "3 counties"
    );
    const geography = screen.getByRole("navigation", { name: "Geography" });
    expect({
      current: geography.querySelector("[aria-current='page']")?.textContent,
      home: within(geography).getByRole("button", { name: "United States" })
        .textContent,
    }).toStrictEqual({ current: "Alabama", home: "United States" });
  });

  it("renders trailing controls and offers no inline download button", () => {
    render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips="01001"
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        trailing={<button type="button">Trailing control</button>}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Trailing control" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Download county list as CSV" })
    ).toBeNull();
    const geography = screen.getByRole("navigation", { name: "Geography" });
    expect(
      within(geography).getByRole("button", { name: "Alabama" })
    ).toBeTruthy();
    expect(geography.querySelector("[aria-current='page']")?.textContent).toBe(
      "Autauga"
    );
  });

  it("selects an exact FIPS and shows the county name", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    expect(search.getAttribute("placeholder")).toBe("Search county or FIPS");
    fireEvent.change(search, { target: { value: "01001" } });
    expect(
      screen.getByRole("option", { name: "Autauga, AL - 01001" })
    ).toBeTruthy();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCountySelect).toHaveBeenCalledWith(
      expect.objectContaining({ fips: "01001" })
    );
    expect((search as HTMLInputElement).value).toBe("Autauga, AL - 01001");
  });

  it("moves the active county with the arrow keys before selecting it", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "01" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCountySelect).toHaveBeenCalledWith(
      expect.objectContaining({ fips: "01003" })
    );
    expect((search as HTMLInputElement).value).toBe("Baldwin, AL - 01003");
  });

  it("clears a selected county back to the search placeholder", () => {
    const onClearSelection = vi.fn<() => void>();
    render(
      <ToolbarHarness
        onClearSelection={onClearSelection}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "auta" } });
    expect(
      screen.getByRole("option", { name: "Autauga, AL - 01001" })
    ).toBeTruthy();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(search, { target: { value: "01001" } });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Clear county" }));
    expect(onClearSelection).toHaveBeenCalledOnce();
    expect((search as HTMLInputElement).value).toBe("");
    expect(search.getAttribute("placeholder")).toBe("Search county or FIPS");
  });

  it("shows the county label when a selection arrives without a matching query", () => {
    const view = render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips="01001"
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    expect({
      clear: screen.queryByRole("button", { name: "Clear county" }) !== null,
      value: (search as HTMLInputElement).value,
    }).toStrictEqual({
      clear: true,
      value: "Autauga, AL - 01001",
    });
    view.rerender(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery="auta"
        scope="AL"
        scopeLabel="Alabama"
        selectedFips="01011"
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );
    expect({
      clear: screen.queryByRole("button", { name: "Clear county" }) !== null,
      value: (search as HTMLInputElement).value,
    }).toStrictEqual({
      clear: true,
      value: "Bullock County, AL - 01011",
    });
  });
});
