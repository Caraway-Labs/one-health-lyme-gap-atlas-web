import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { alignCompareCountyProfiles } from "@/features/ux-reset/compare/compare-county-profile";
import {
  buildCompareVisualRows,
  type CompareVisualRow,
} from "@/features/ux-reset/compare/compare-visual-model";
import { CompareVisualRowView } from "@/features/ux-reset/compare/compare-visual-parts";
import type { CountyDetail } from "@/generated/models";

import { compareCountyDetail } from "./fixtures/compare-api-fixtures";

const counties = [
  { fips: "08001", label: "Denver, Colorado", letter: "A" },
  { fips: "08013", label: "Boulder, Colorado", letter: "B" },
] as const;

function detail(
  fips: string,
  county: string,
  rucc: number,
  svi: number
): CountyDetail {
  return {
    ...compareCountyDetail("08001"),
    county,
    fips,
    rucc_2023: rucc,
    svi_percentile: svi,
    uninsured_percent: 11.2,
  };
}

function row(id: string, rightRucc: number | null): CompareVisualRow {
  const rows = buildCompareVisualRows(
    alignCompareCountyProfiles({
      left: {
        detail: detail("08001", "Denver", 2, 0.12),
        status: "ready",
      },
      leftFips: "08001",
      right:
        rightRucc === null
          ? { status: "missing" }
          : {
              detail: detail("08013", "Boulder", rightRucc, 0.82),
              status: "ready",
            },
      rightFips: "08013",
    })
  );
  const found = rows.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Missing visual row ${id}`);
  }
  return found;
}

describe("community context rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("states whether rural classifications are the same or different", () => {
    const { rerender } = render(
      <CompareVisualRowView counties={counties} row={row("rucc_2023", 2)} />
    );
    const sameText = screen.getByTestId(
      "compare-community-summary-rucc_2023"
    ).textContent;
    rerender(
      <CompareVisualRowView counties={counties} row={row("rucc_2023", 8)} />
    );
    const different = screen.getByTestId("compare-community-summary-rucc_2023");
    const block = screen.getByTestId("compare-profile-row-rucc_2023");
    expect({
      classification: within(block).getAllByText("Classification").length,
      different: different.textContent,
      ranked: /better|worse|winner|higher|lower/i.test(
        different.textContent ?? ""
      ),
      rucc: within(block).getAllByText("RUCC").length,
      same: sameText,
    }).toStrictEqual({
      classification: 2,
      different: "A and B have different classifications.",
      ranked: false,
      rucc: 2,
      same: "A and B have the same classification.",
    });
  });

  it("draws a missing side as a dashed mark with words, never zero", () => {
    render(
      <CompareVisualRowView
        counties={counties}
        row={row("svi_percentile_2022", null)}
      />
    );
    const missing = screen.getByTestId(
      "compare-profile-cell-svi_percentile_2022-08013"
    );
    const mark = missing.querySelector(".ux-reset-compare-missing");
    const summary = screen.getByTestId(
      "compare-community-summary-svi_percentile_2022"
    );
    expect({
      gap: screen.getByTestId("compare-profile-row-svi_percentile_2022").dataset
        .gap,
      mark: mark?.textContent,
      relation: screen.getByTestId("compare-profile-row-svi_percentile_2022")
        .dataset.relation,
      summary: summary.textContent,
      zero: missing.querySelector(".ux-reset-compare-vlabel"),
    }).toStrictEqual({
      gap: "true",
      mark: "No recordNo published value. This absence is not zero.",
      relation: "incomparable",
      summary:
        "No difference is shown because a published value is missing or not readable.",
      zero: null,
    });
  });

  it("keeps A and B understandable without color and exposes provenance to the keyboard", () => {
    render(
      <CompareVisualRowView
        counties={counties}
        row={row("uninsured_percent_2022", 2)}
      />
    );
    const block = screen.getByTestId(
      "compare-profile-row-uninsured_percent_2022"
    );
    const button = within(block).getAllByRole("button", {
      name: /Sources and limitations for/,
    })[0];
    button?.focus();
    const described = block.querySelector(".sr-only");
    expect({
      described: described?.textContent ?? "",
      focused: document.activeElement === button,
      letters: [
        ...block.querySelectorAll("[data-slot-letter], [data-letter]"),
      ].map((marker) =>
        marker instanceof HTMLElement
          ? (marker.dataset.slotLetter ?? marker.dataset.letter)
          : ""
      ),
      scale: block.querySelector(".ux-reset-compare-cscale .sr-only")
        ?.textContent,
    }).toStrictEqual({
      described: expect.stringContaining("Denver, Colorado"),
      focused: true,
      letters: ["A", "B", "A", "B"],
      scale: expect.stringContaining("shared 0 to 100 scale"),
    });
  });
});
