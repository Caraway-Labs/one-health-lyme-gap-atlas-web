import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ExplorerCountyReference,
  EXPLORER_COUNTY_EXPORT_NOTE,
} from "@/features/ux-reset/review/explorer-county-reference";
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
];

function ToolbarHarness({
  onClearSelection,
  onCountySelect,
  onDownload,
}: {
  onClearSelection: () => void;
  onCountySelect: (county: ExplorerCountyReference) => void;
  onDownload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [availableData, setAvailableData] = useState<EvidenceView>("all");
  return (
    <ExplorerCountyToolbar
      availableData={availableData}
      counties={counties}
      countyQuery={query}
      downloadDisabled={false}
      scope="AL"
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
      onDownload={onDownload}
      onScopeChange={vi.fn<() => void>()}
    />
  );
}

describe("explorer county toolbar", () => {
  afterEach(() => {
    cleanup();
  });

  it("names the four controls and keeps the export note out of the row", () => {
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={vi.fn<(county: ExplorerCountyReference) => void>()}
        onDownload={vi.fn<() => void>()}
      />
    );
    expect(screen.getByRole("combobox", { name: "State" })).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "County name or five-digit FIPS" })
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Available data" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Download county list as CSV" })
    ).toBeTruthy();
    const note = screen.getByTestId("explorer-county-export-note");
    expect({
      hidden: note.className.includes("sr-only"),
      note: note.textContent,
    }).toStrictEqual({ hidden: true, note: EXPLORER_COUNTY_EXPORT_NOTE });
  });

  it("selects an exact FIPS and shows the county name", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onClearSelection={vi.fn<() => void>()}
        onCountySelect={onCountySelect}
        onDownload={vi.fn<() => void>()}
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
        onDownload={vi.fn<() => void>()}
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
        onDownload={vi.fn<() => void>()}
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
});
