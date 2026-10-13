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
  onCountySelect,
  onDownload,
}: {
  onCountySelect: (county: ExplorerCountyReference) => void;
  onDownload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [availableData, setAvailableData] = useState<EvidenceView>("all");
  return (
    <ExplorerCountyToolbar
      availableData={availableData}
      counties={counties}
      countyQuery={query}
      downloadDisabled={false}
      scope="AL"
      stateOptions={[{ code: "AL", name: "Alabama" }]}
      onAvailableDataChange={setAvailableData}
      onCountyQueryChange={setQuery}
      onCountySelect={onCountySelect}
      onDownload={onDownload}
      onScopeChange={vi.fn<() => void>()}
    />
  );
}

describe("explorer county toolbar", () => {
  afterEach(() => {
    cleanup();
  });

  it("selects an exact FIPS from the keyboard and names the export scope", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
        onCountySelect={onCountySelect}
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
    expect(screen.getByText(EXPLORER_COUNTY_EXPORT_NOTE)).toBeTruthy();
    const search = screen.getByTestId("explorer-county-search");
    fireEvent.change(search, { target: { value: "01001" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCountySelect).toHaveBeenCalledWith(
      expect.objectContaining({ fips: "01001" })
    );
  });

  it("moves the active county with the arrow keys before selecting it", () => {
    const onCountySelect = vi.fn<(county: ExplorerCountyReference) => void>();
    render(
      <ToolbarHarness
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
  });
});
