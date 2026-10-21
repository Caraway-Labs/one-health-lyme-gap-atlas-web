import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("returns to the national scope from the United States breadcrumb", () => {
    const onScopeChange = vi.fn<(scope: string) => void>();
    render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips={null}
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={onScopeChange}
      />
    );

    fireEvent.click(screen.getByTestId("explorer-breadcrumb-us"));

    expect(onScopeChange).toHaveBeenCalledWith("ALL");
  });

  it("shows only United States as the current page in the national scope", () => {
    render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery=""
        scope="ALL"
        scopeLabel="United States"
        selectedFips={null}
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );

    const geography = screen.getByRole("navigation", { name: "Geography" });
    expect(geography.querySelector("[aria-current='page']")?.textContent).toBe(
      "United States"
    );
    expect(screen.queryByTestId("explorer-breadcrumb-us")).toBeNull();
  });

  it("clears the county from the state breadcrumb while a county is selected", () => {
    const onClearSelection = vi.fn<() => void>();
    render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips="01001"
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={onClearSelection}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );

    fireEvent.click(screen.getByTestId("explorer-breadcrumb-state"));

    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it("selects the county under the pointer without moving focus off the search", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "bull" } });

    const notPrevented = fireEvent.mouseDown(
      screen.getByRole("option", { name: "Bullock County, AL - 01011" })
    );

    expect(notPrevented).toBeFalsy();
    expect(onCountySelect).toHaveBeenCalledWith(
      expect.objectContaining({ fips: "01011" })
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens the list on focus when text is typed and closes it on blur", () => {
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "au" } });
    fireEvent.blur(search);
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.focus(search);

    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.blur(search);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not open the list on focus when the search is empty", () => {
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
      />
    );

    fireEvent.focus(screen.getByTestId("explorer-county-search"));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps focus in the search when the clear button is pressed", () => {
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
      />
    );
    fireEvent.change(screen.getByTestId("explorer-county-search"), {
      target: { value: "auta" },
    });

    const notPrevented = fireEvent.mouseDown(
      screen.getByRole("button", { name: "Clear county" })
    );

    expect(notPrevented).toBeFalsy();
  });

  it("jumps to the first and last match with Home and End and wraps with ArrowUp", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "01" } });

    fireEvent.keyDown(search, { key: "End" });
    expect(
      screen
        .getByRole("option", { name: "Bullock County, AL - 01011" })
        .getAttribute("aria-selected")
    ).toBe("true");

    fireEvent.keyDown(search, { key: "Home" });
    expect(
      screen
        .getByRole("option", { name: "Autauga, AL - 01001" })
        .getAttribute("aria-selected")
    ).toBe("true");

    fireEvent.keyDown(search, { key: "ArrowUp" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCountySelect).toHaveBeenCalledWith(
      expect.objectContaining({ fips: "01011" })
    );
  });

  it("reports when no county matches and ignores the arrow keys and Enter", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "zzz" } });

    expect(
      screen.getByText("No counties match that name or FIPS.")
    ).toBeTruthy();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCountySelect).not.toHaveBeenCalled();
  });

  it("selects the only match when Enter is pressed with the list closed", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
      />
    );
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "baldwin" } });
    fireEvent.keyDown(search, { key: "Escape" });

    fireEvent.keyDown(search, { key: "Enter" });

    expect(onCountySelect).toHaveBeenCalledWith(
      expect.objectContaining({ fips: "01003" })
    );
  });

  it("reports the available-data filter choice", async () => {
    const onAvailableDataChange = vi.fn<(value: EvidenceView) => void>();
    render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={counties}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips={null}
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={onAvailableDataChange}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("explorer-available-data"));
    await user.click(
      await screen.findByRole("option", {
        name: "Published Lyme case count available",
      })
    );

    expect(onAvailableDataChange).toHaveBeenCalledWith("human");
  });

  it("uses the singular for a single county and hides the count with no counties", () => {
    const view = render(
      <ExplorerCountyToolbar
        availableData="all"
        counties={[counties[0] as ExplorerCountyReference]}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips={null}
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );
    expect(screen.getByTestId("explorer-filter-count").textContent).toBe(
      "1 county"
    );

    view.rerender(
      <ExplorerCountyToolbar
        availableData="all"
        counties={[]}
        countyQuery=""
        scope="AL"
        scopeLabel="Alabama"
        selectedFips={null}
        stateOptions={[{ code: "AL", name: "Alabama" }]}
        onAvailableDataChange={vi.fn<(value: EvidenceView) => void>()}
        onClearSelection={vi.fn<() => void>()}
        onCountyQueryChange={vi.fn<(value: string) => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onScopeChange={vi.fn<() => void>()}
      />
    );
    expect(screen.queryByTestId("explorer-filter-count")).toBeNull();
  });
});
