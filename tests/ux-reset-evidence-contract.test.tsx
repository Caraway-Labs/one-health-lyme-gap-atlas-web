import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  EvidenceObject,
  ReleaseEvidenceStateStrip,
  availabilityFromGovernedValueState,
  evidenceAvailabilityValues,
  evidenceInspectFreshness,
  evidenceInspectMethod,
  evidenceObjectFromObservation,
  formatGovernedEvidenceValue,
  formatObservationPeriod,
  releaseEvidenceContextFromMetadata,
  releaseEvidenceLoadStateValues,
} from "@/features/ux-reset/evidence";
import type { AtlasMetadata } from "@/generated/models";
import { ValueState } from "@/generated/models";
import { getDocsPageHref } from "@/lib/docs-config";

import {
  GOVERNED_MEASURE_TYPES,
  exactDecimalStringObservation,
  missingNumericObservation,
  noaaDailyPrecipitationObservation,
  noaaDailyPrecipitationWithoutVintage,
  publishedZeroObservation,
  suppressedNumericObservation,
  unavailableNumericObservation,
} from "./fixtures/ux-reset-evidence-observations";

const metadata: AtlasMetadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-08-06T05:37:16Z",
  limitations: "Population-level hypothesis generator.",
  loaded_at: "2026-08-15T00:00:00Z",
  methodology_version: "semantic-1.0.0",
  release_id: "governed-2026-09-18-unknown-coverage",
  schema_version: "0.2.0",
  scope: "Contiguous U.S. counties",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      note: "Published floor.",
      url: "https://cdc.gov",
      vintage: "2023",
    },
  ],
  states: [],
};

const evidenceDocsHref = getDocsPageHref("evidence-and-uncertainty");

function renderEvidenceObject(
  input: Parameters<typeof evidenceObjectFromObservation>[0]
) {
  const model = evidenceObjectFromObservation(input);
  const view = render(<EvidenceObject model={model} />);
  return { model, view };
}

function availabilityBadgeText(container: HTMLElement) {
  return container.querySelector(".ux-reset-evidence-availability")
    ?.textContent;
}

function disclosureValue(testId: string): string {
  return screen.getByTestId(testId).querySelector("dd")?.textContent ?? "";
}

describe("ux reset evidence contract", () => {
  afterEach(cleanup);

  it("maps governed value states to Available, Limited, and Unavailable", () => {
    expect(
      availabilityFromGovernedValueState({ valueState: ValueState.OBSERVED })
    ).toBe(evidenceAvailabilityValues.available);
    expect(
      availabilityFromGovernedValueState({ valueState: ValueState.ZERO })
    ).toBe(evidenceAvailabilityValues.available);
    expect(
      availabilityFromGovernedValueState({ valueState: ValueState.SUPPRESSED })
    ).toBe(evidenceAvailabilityValues.limited);
    expect(
      availabilityFromGovernedValueState({
        hasMaterialLimitations: true,
        valueState: ValueState.OBSERVED,
      })
    ).toBe(evidenceAvailabilityValues.limited);
    expect(
      availabilityFromGovernedValueState({ valueState: ValueState.MISSING })
    ).toBe(evidenceAvailabilityValues.unavailable);
  });

  it("never renders unavailable states as zero in the formatter", () => {
    for (const valueState of [
      ValueState.MISSING,
      ValueState.UNAVAILABLE,
      ValueState.NO_COUNTY_LINKED_RECORD,
    ]) {
      expect(
        formatGovernedEvidenceValue({
          value: 0,
          valueState,
          unit: "cases",
        })
      ).toBe("Unavailable");
    }
    expect(
      formatGovernedEvidenceValue({
        value: 0,
        valueState: ValueState.ZERO,
        unit: "cases",
      })
    ).toBe("0 cases");
  });

  it("preserves small nonzero observations and exact decimal strings with units", () => {
    expect(
      formatGovernedEvidenceValue({
        unit: "mm",
        value: 0.0001,
        valueState: ValueState.OBSERVED,
      })
    ).toBe("0.0001 mm");
    expect(
      formatGovernedEvidenceValue({
        unit: "mm",
        value: 0,
        valueState: ValueState.ZERO,
      })
    ).toBe("0 mm");
    expect(
      formatGovernedEvidenceValue({
        unit: "mm",
        value: "0.123456789012345678901234567890",
        valueState: ValueState.OBSERVED,
      })
    ).toBe("0.123456789012345678901234567890 mm");
  });

  it("collapses only full annual intervals to a year", () => {
    expect(formatObservationPeriod("2023-01-01", "2023-12-31", "annual")).toBe(
      "2023"
    );
    expect(formatObservationPeriod("2025-01-01", "2025-01-01", "daily")).toBe(
      "January 1, 2025 (daily)"
    );
  });

  it("uses governed measure_type for evidence type and Unavailable without catalog metadata", () => {
    const withType = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: noaaDailyPrecipitationObservation,
    });
    expect(withType.provenance.evidenceType).toBe("Continuous");

    const withoutType = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      observation: noaaDailyPrecipitationObservation,
    });
    expect(withoutType.provenance.evidenceType).toBe("Unavailable");
  });

  it("keeps NOAA daily observation period separate from dataset vintage", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: noaaDailyPrecipitationObservation,
    });

    expect(model.provenance.observationPeriod).toBe("January 1, 2025 (daily)");
    expect(model.provenance.datasetVintage).toBe("v1.0.0-scaled-202501");
    expect(model.displayValue).toBe("0.0001 mm");
    expect(model.provenance.materialCaveat).toBe(
      "Historical availability varies before 1981 for this station composite."
    );
    expect(model.provenance.limitations).toHaveLength(2);
  });

  it("preserves daily dates without dataset vintage", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      observation: noaaDailyPrecipitationWithoutVintage,
    });
    expect(model.provenance.observationPeriod).toBe("January 1, 2025 (daily)");
    expect(model.provenance.datasetVintage).toBeNull();
  });

  it("builds annual CDC observation evidence from period metadata", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Published Lyme cases",
      measureType: GOVERNED_MEASURE_TYPES.caseCount,
      observation: {
        atlas_acquired_at: null,
        atlas_processed_at: null,
        dataset_id: null,
        denominator: null,
        evidence: {
          provenance_ref: "prov/cdc-lyme/2023",
          resource_id: "cdc-lyme",
          resource_type: "source",
        },
        geography: { geography_id: "36061", geography_type: "county" },
        limitations: ["County allocation may be incomplete."],
        lineage_source_id: null,
        measure_id: "case-rate",
        methodology: null,
        methodology_id: "county-aggregation-v1",
        methodology_version: "1.0.0",
        observation_id: "obs-1",
        period_end: "2023-12-31",
        period_start: "2023-01-01",
        provenance_ref: "prov/cdc-lyme/2023",
        release_id: "release-2023",
        release_methodology_version: null,
        semantic_version: "2023.1",
        source_id: "cdc-lyme",
        source_label: "CDC Lyme surveillance",
        source_published_at: null,
        source_url: "https://cdc.gov",
        source_vintage: "2023",
        strata: undefined,
        temporal_grain: "annual",
        unit: "cases",
        value: 12,
        value_state: ValueState.OBSERVED,
      },
    });

    expect(model.availability).toBe(evidenceAvailabilityValues.limited);
    expect(model.provenance.sourceFamily).toBe("CDC Lyme surveillance");
    expect(model.provenance.observationPeriod).toBe("2023");
    expect(model.provenance.datasetVintage).toBe("2023");
    expect(model.provenance.evidenceType).toBe("Count");
  });

  it("renders adversarial value states without numeric leakage", () => {
    const cases = [
      {
        availability: "Limited",
        claimLabel: "Suppressed cell",
        display: "Suppressed",
        observation: suppressedNumericObservation,
      },
      {
        availability: "Unavailable",
        claimLabel: "Missing record",
        display: "Unavailable",
        observation: missingNumericObservation,
      },
      {
        availability: "Unavailable",
        claimLabel: "Unavailable field",
        display: "Unavailable",
        observation: unavailableNumericObservation,
      },
    ] as const;

    for (const caseEntry of cases) {
      cleanup();
      const { model } = renderEvidenceObject({
        claimLabel: caseEntry.claimLabel,
        measureType: GOVERNED_MEASURE_TYPES.precipitation,
        observation: caseEntry.observation,
      });
      const card = screen.getByTestId("ux-reset-evidence-object");
      expect({
        availability: availabilityBadgeText(card),
        display: screen.getByTestId("evidence-display-value").textContent,
        modelDisplay: model.displayValue,
      }).toStrictEqual({
        availability: caseEntry.availability,
        display: caseEntry.display,
        modelDisplay: caseEntry.display,
      });
    }
  });

  it("renders tiny positive NOAA observation with limited availability and caveat", () => {
    const { model: tiny } = renderEvidenceObject({
      claimLabel: "Tiny positive",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: noaaDailyPrecipitationObservation,
    });
    const card = screen.getByTestId("ux-reset-evidence-object");
    expect({
      availability: availabilityBadgeText(card),
      caveat: within(card).getByRole("note").textContent,
      display: screen.getByTestId("evidence-display-value").textContent,
      modelAvailability: tiny.availability,
    }).toStrictEqual({
      availability: "Limited",
      caveat:
        "Historical availability varies before 1981 for this station composite.",
      display: "0.0001 mm",
      modelAvailability: evidenceAvailabilityValues.limited,
    });
  });

  it("renders exact decimal and published zero observations", () => {
    renderEvidenceObject({
      claimLabel: "High-precision reading",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: exactDecimalStringObservation,
    });
    expect(screen.getByTestId("evidence-display-value").textContent).toContain(
      "0.123456789012345678901234567890 mm"
    );

    cleanup();
    renderEvidenceObject({
      claimLabel: "No precipitation",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: publishedZeroObservation,
    });
    expect({
      availability: availabilityBadgeText(
        screen.getByTestId("ux-reset-evidence-object")
      ),
      display: screen.getByTestId("evidence-display-value").textContent,
    }).toStrictEqual({ availability: "Available", display: "0 mm" });
  });

  it("summarizes release context and marks incomplete metadata unavailable", () => {
    const context = releaseEvidenceContextFromMetadata(metadata);
    expect(context.releaseSummary).toContain("September 18, 2026");
    expect(context.sourcePeriods).toBe("2023");
    expect(context.methodologyLabel).toContain("Semantic");
    expect(context.availability).toBe(evidenceAvailabilityValues.available);

    const incomplete = releaseEvidenceContextFromMetadata({
      ...metadata,
      release_id: "",
      sources: [],
    });
    expect(incomplete.availability).toBe(
      evidenceAvailabilityValues.unavailable
    );
  });

  it("omits availability badges while release context is loading or errored", () => {
    const { container: loadingContainer } = render(
      <ReleaseEvidenceStateStrip
        loadState={releaseEvidenceLoadStateValues.loading}
      />
    );
    expect(
      loadingContainer.querySelector(".ux-reset-evidence-availability")
    ).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading");

    cleanup();
    const { container: errorContainer } = render(
      <ReleaseEvidenceStateStrip
        errorMessage="Network error"
        loadState={releaseEvidenceLoadStateValues.error}
      />
    );
    expect(
      errorContainer.querySelector(".ux-reset-evidence-availability")
    ).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("shows governed availability on loaded complete and incomplete release context", () => {
    const complete = releaseEvidenceContextFromMetadata(metadata);
    const { container: completeContainer } = render(
      <ReleaseEvidenceStateStrip
        context={complete}
        loadState={releaseEvidenceLoadStateValues.ready}
      />
    );
    expect(
      completeContainer.querySelector(".ux-reset-evidence-availability")
        ?.textContent
    ).toBe("Available");

    cleanup();
    const incomplete = releaseEvidenceContextFromMetadata({
      ...metadata,
      release_id: "",
      sources: [],
    });
    const { container: incompleteContainer } = render(
      <ReleaseEvidenceStateStrip
        context={incomplete}
        loadState={releaseEvidenceLoadStateValues.ready}
      />
    );
    expect(
      incompleteContainer.querySelector(".ux-reset-evidence-availability")
        ?.textContent
    ).toBe("Unavailable");
  });

  it("renders provenance inspect with limitations while disclosure stays open", () => {
    renderEvidenceObject({
      claimLabel: "Daily precipitation",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: noaaDailyPrecipitationObservation,
    });

    const outerDetails = screen
      .getByText("Inspect provenance")
      .closest("details");
    expect(outerDetails?.open).toBeFalsy();

    fireEvent.click(screen.getByText("Inspect provenance"));
    expect(outerDetails?.open).toBeTruthy();

    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent)
    ).toStrictEqual([
      "Historical availability varies before 1981 for this station composite.",
      "Day boundaries follow UTC for this daily extract.",
    ]);

    fireEvent.click(screen.getByText("Technical reproducibility identifiers"));

    const docLinks = screen.getAllByRole("link", {
      name: /Atlas documentation/,
    });
    for (const link of docLinks) {
      expect(link.getAttribute("href")).toBe(evidenceDocsHref);
    }

    const sourceLink = screen.getByRole("link", {
      name: /Open source reference/,
    });
    expect({
      freshness: disclosureValue("evidence-provenance-freshness"),
      href: sourceLink.getAttribute("href"),
      method: disclosureValue("evidence-provenance-method"),
      state: disclosureValue("evidence-provenance-state"),
    }).toStrictEqual({
      freshness: expect.stringContaining("v1.0.0-scaled-202501"),
      href: "https://www.ncei.noaa.gov/",
      method: "Version 1.0.0",
      state: expect.stringContaining("Limited"),
    });
  });

  it("keeps missing optional provenance unavailable without a staleness judgment", () => {
    const { model } = renderEvidenceObject({
      claimLabel: "Observation without optional provenance",
      observation: {
        ...noaaDailyPrecipitationWithoutVintage,
        methodology: "   ",
        methodology_version: " ",
        source_id: "",
        source_label: null,
        source_published_at: "not-a-timestamp",
        source_url: "  ",
      },
    });
    fireEvent.click(screen.getByText("Inspect provenance"));
    const freshness = evidenceInspectFreshness(model.provenance);
    expect({
      freshness,
      freshnessRow: disclosureValue("evidence-provenance-freshness"),
      limitations: screen.getByTestId("evidence-provenance-limitations")
        .textContent,
      method: evidenceInspectMethod(model.provenance),
      methodLabel: model.provenance.methodLabel,
      methodRow: disclosureValue("evidence-provenance-method"),
      source: disclosureValue("evidence-provenance-source"),
      sourceLink: screen.queryByRole("link", { name: /Open source reference/ }),
      stale: freshness.toLowerCase().includes("stale"),
      state: disclosureValue("evidence-provenance-state"),
    }).toStrictEqual({
      freshness: "Unavailable",
      freshnessRow: "Unavailable",
      limitations: expect.stringContaining(
        "No governed limitations were returned."
      ),
      method: "Unavailable",
      methodLabel: null,
      methodRow: "Unavailable",
      source: "Unavailable",
      sourceLink: null,
      stale: false,
      state: "Available. Observed or published.",
    });
  });

  it("shows limited evidence and publisher limitations without rewriting freshness", () => {
    renderEvidenceObject({
      claimLabel: "Suppressed cell",
      measureType: GOVERNED_MEASURE_TYPES.precipitation,
      observation: {
        ...suppressedNumericObservation,
        methodology: "Privacy suppression rule",
        source_published_at: "2020-01-15T00:00:00Z",
      },
    });
    fireEvent.click(screen.getByText("Inspect provenance"));
    const freshness = disclosureValue("evidence-provenance-freshness");
    expect({
      freshnessStale: freshness.toLowerCase().includes("stale"),
      limitations: screen
        .getAllByRole("listitem")
        .map((item) => item.textContent),
      method: disclosureValue("evidence-provenance-method"),
      state: disclosureValue("evidence-provenance-state"),
      vintage: freshness.includes("v1.0.0-scaled-202501"),
    }).toStrictEqual({
      freshnessStale: false,
      limitations: ["Publisher suppressed this cell for privacy."],
      method: "Privacy suppression rule. Version 1.0.0.",
      state: "Limited. Suppressed or privacy-protected.",
      vintage: true,
    });
  });

  it("keeps distinct periods for two sources of the same measure", () => {
    const annual = evidenceObjectFromObservation({
      claimLabel: "Reported cases",
      measureType: GOVERNED_MEASURE_TYPES.caseCount,
      observation: {
        ...publishedZeroObservation,
        period_end: "2023-12-31",
        period_start: "2023-01-01",
        temporal_grain: "YEAR",
      },
    });
    const partial = evidenceObjectFromObservation({
      claimLabel: "Reported cases",
      measureType: GOVERNED_MEASURE_TYPES.caseCount,
      observation: {
        ...publishedZeroObservation,
        period_end: "2023-06-30",
        period_start: "2023-01-01",
        source_label: "State health department",
        temporal_grain: "YEAR",
      },
    });
    expect({
      annual: annual.provenance.observationPeriod,
      partial: partial.provenance.observationPeriod,
    }).toStrictEqual({
      annual: "2023",
      partial: "January 1, 2023 – June 30, 2023 (YEAR)",
    });
  });
});
