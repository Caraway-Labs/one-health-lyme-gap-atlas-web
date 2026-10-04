import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  EvidenceObject,
  ReleaseEvidenceStateStrip,
  availabilityFromGovernedValueState,
  evidenceAvailabilityValues,
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
  exactDecimalStringObservation,
  noaaDailyPrecipitationObservation,
  noaaDailyPrecipitationWithoutVintage,
  publishedZeroObservation,
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

  it("never renders unavailable states as zero", () => {
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

  it("keeps NOAA daily observation period separate from dataset vintage", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
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
    expect(model.provenance.datasetVintage).toBe("2025.1");
  });

  it("builds annual CDC observation evidence from period metadata", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Published Lyme cases",
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
    expect(model.provenance.evidenceType).toBe("Source");
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

  it("separates release loading and error from evidence availability", () => {
    render(
      <ReleaseEvidenceStateStrip
        loadState={releaseEvidenceLoadStateValues.loading}
      />
    );
    expect(screen.getByRole("status").textContent).toContain("Loading");

    cleanup();
    render(
      <ReleaseEvidenceStateStrip
        errorMessage="Network error"
        loadState={releaseEvidenceLoadStateValues.error}
      />
    );
    expect(screen.getByRole("alert").textContent).toContain("Network error");
  });

  it("renders EvidenceObject with provenance docs links, limitations, and disclosure state", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      observation: noaaDailyPrecipitationObservation,
    });

    render(<EvidenceObject model={model} />);

    const outerDetails = screen
      .getByText("Inspect provenance")
      .closest("details");
    expect(outerDetails?.open).toBeFalsy();

    fireEvent.click(screen.getByText("Inspect provenance"));
    expect(outerDetails?.open).toBeTruthy();

    const summary = screen.getByText("Inspect provenance");
    fireEvent.click(summary);
    expect(outerDetails?.open).toBeFalsy();
    summary.focus();
    expect(document.activeElement).toBe(summary);

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
      expect(link.getAttribute("href")).toContain(
        "/docs/evidence-and-uncertainty"
      );
      expect(link.getAttribute("href")).not.toContain(
        "#evidence-and-uncertainty"
      );
    }
  });

  it("renders exact decimal and published-zero fixtures end to end", () => {
    const decimalModel = evidenceObjectFromObservation({
      claimLabel: "High-precision reading",
      observation: exactDecimalStringObservation,
    });
    const zeroModel = evidenceObjectFromObservation({
      claimLabel: "No precipitation",
      observation: publishedZeroObservation,
    });

    render(
      <>
        <EvidenceObject model={decimalModel} />
        <EvidenceObject model={zeroModel} />
      </>
    );

    expect(
      screen.getByText("0.123456789012345678901234567890 mm")
    ).toBeTruthy();
    expect(screen.getByText("0 mm")).toBeTruthy();
  });
});
