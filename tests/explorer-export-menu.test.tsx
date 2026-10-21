import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EXPLORER_COUNTY_EXPORT_NOTE } from "@/features/ux-reset/review/explorer-county-reference";
import { ExplorerExportMenu } from "@/features/ux-reset/review/explorer-export-menu";

const county = {
  countyName: "Bullock County",
  fips: "01011",
  releaseId: "alpha-2026",
  stateCode: "AL",
};

describe("Explorer export menu", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the governed export scope note for assistive technology", () => {
    render(
      <ExplorerExportMenu
        county={null}
        csvDisabled={false}
        onDownloadCsv={vi.fn<() => void>()}
      />
    );
    const trigger = screen.getByTestId("explorer-export-menu");
    expect(trigger).toHaveAccessibleName("Export");
    expect(trigger).toHaveAttribute(
      "aria-describedby",
      "explorer-county-export-note"
    );
    const note = screen.getByTestId("explorer-county-export-note");
    expect(note).toHaveClass("sr-only");
    expect(note).toHaveTextContent(EXPLORER_COUNTY_EXPORT_NOTE);
    expect(EXPLORER_COUNTY_EXPORT_NOTE).toContain("Scores are not included");
  });

  it("downloads the county list from the menu", async () => {
    const onDownloadCsv = vi.fn<() => void>();
    render(
      <ExplorerExportMenu
        county={county}
        csvDisabled={false}
        onDownloadCsv={onDownloadCsv}
      />
    );
    fireEvent.click(screen.getByTestId("explorer-export-menu"));
    const item = await screen.findByTestId("explorer-download-counties");
    expect(item).toHaveTextContent("County list (CSV)");
    expect(item).toHaveTextContent("No scores.");
    fireEvent.click(item);
    expect(onDownloadCsv).toHaveBeenCalledOnce();
  });

  it("says a county report needs a selected county instead of explaining it", async () => {
    render(
      <ExplorerExportMenu
        county={null}
        csvDisabled={false}
        onDownloadCsv={vi.fn<() => void>()}
      />
    );
    fireEvent.click(screen.getByTestId("explorer-export-menu"));
    const pdf = await screen.findByTestId("explorer-export-pdf");
    expect(pdf).toHaveAttribute("aria-disabled", "true");
    expect(pdf).toHaveTextContent("Select a county");
  });

  it("offers the county report when a county and release are known", async () => {
    render(
      <ExplorerExportMenu
        county={county}
        csvDisabled
        onDownloadCsv={vi.fn<() => void>()}
      />
    );
    fireEvent.click(screen.getByTestId("explorer-export-menu"));
    const pdf = await screen.findByTestId("explorer-export-pdf");
    expect(pdf).not.toHaveAttribute("aria-disabled", "true");
    expect(pdf).toHaveTextContent("County report (PDF)");
    expect(screen.getByTestId("explorer-download-counties")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});
