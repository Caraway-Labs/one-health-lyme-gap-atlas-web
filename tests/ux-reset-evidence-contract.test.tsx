import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  EvidenceObject,
  availabilityFromGovernedValueState,
  evidenceAvailabilityValues,
  evidenceObjectFromObservation,
  formatGovernedEvidenceValue,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import type { AtlasMetadata } from "@/generated/models";
import { ValueState } from "@/generated/models";

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

  it("builds observation evidence from API metadata fields", () => {
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
    expect(model.provenance.evidenceType).toBe("Source");
  });

  it("summarizes release context without raw technical IDs in the strip", () => {
    const context = releaseEvidenceContextFromMetadata(metadata);
    expect(context.releaseSummary).toContain("September 18, 2026");
    expect(context.sourcePeriods).toBe("2023");
    expect(context.methodologyLabel).toContain("Semantic");
  });

  it("renders EvidenceObject with inspect provenance and nested technical disclosure", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Tick establishment",
      observation: {
        atlas_acquired_at: null,
        atlas_processed_at: null,
        dataset_id: null,
        denominator: null,
        evidence: {
          resource_id: "tick-surveillance",
          resource_type: "measure",
        },
        geography: { geography_id: "08001", geography_type: "county" },
        limitations: [],
        lineage_source_id: null,
        measure_id: "tick-status",
        methodology: null,
        methodology_id: null,
        methodology_version: "1.0.0",
        observation_id: "obs-tick",
        period_end: "2023-12-31",
        period_start: "2023-01-01",
        provenance_ref: "prov/tick/2023",
        release_id: "release-2023",
        release_methodology_version: null,
        semantic_version: "2023.1",
        source_id: "tick-surveillance",
        source_label: "Tick surveillance",
        source_published_at: null,
        source_url: null,
        source_vintage: null,
        strata: undefined,
        temporal_grain: "annual",
        unit: "status",
        value: null,
        value_state: ValueState.MISSING,
      },
    });

    render(<EvidenceObject model={model} />);

    expect(screen.getByTestId("evidence-display-value").textContent).toBe(
      "Unavailable"
    );
    expect(screen.getByText("Tick surveillance")).toBeTruthy();

    fireEvent.click(screen.getByText("Inspect provenance"));
    fireEvent.click(screen.getByText("Technical reproducibility identifiers"));
    expect(screen.getByText("obs-tick")).toBeTruthy();
    expect(screen.getByText(/Atlas documentation/)).toBeTruthy();
  });
});
