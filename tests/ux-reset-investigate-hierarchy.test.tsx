import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildCountyEvidenceBundle,
  evidenceFamilyForMeasure,
  investigateEvidenceConflicts,
  resolveCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import { indicatorDomainsById } from "@/features/ux-reset/investigate/load-county-evidence";
import {
  environmentalCoverageRows,
  publishedCountyHierarchy,
  publishedCountyRecordFromDetail,
  type PublishedCountyRecord,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import {
  EnvironmentalContextCoverageStatus,
  type CountyDetail,
  type Measure,
} from "@/generated/models";

import {
  INVESTIGATE_RELEASE_ID,
  investigateGeographyFixture,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const yearMeasures = investigateMeasuresFixture as Measure[];

function mixedBundle(scenario: "ambiguous" | "mixed" = "mixed") {
  const identity = resolveCountyIdentity(
    investigateGeographyFixture("08001")!,
    "08001"
  );
  return buildCountyEvidenceBundle({
    domainsRequestFailed: false,
    identity,
    indicatorDomains: indicatorDomainsById(
      investigateIndicatorsFixture,
      INVESTIGATE_RELEASE_ID
    ),
    measures: yearMeasures,
    outcomes: yearMeasures.map((measure) => ({
      measureId: measure.measure_id,
      observations: investigateObservationsFor({
        fips: "08001",
        measureId: measure.measure_id,
        scenario,
      }),
      status: "ready" as const,
    })),
    releaseId: INVESTIGATE_RELEASE_ID,
  });
}

const publishedRecord: PublishedCountyRecord = {
  burgdorferiStatus: "No records",
  evidenceCompleteness: 50,
  fips: "08001",
  pacificusStatus: "Established",
  population: null,
  releaseId: INVESTIGATE_RELEASE_ID,
  releaseLimitation: "Not a diagnosis or individual risk estimate.",
  rucc: 9,
  scapularisStatus: null,
  sources: [
    {
      key: "tick",
      label: "CDC ArboNET county tick status",
      note: "No records is not absence.",
      url: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      vintage: "through 2025-12-31",
    },
    {
      key: "pathogen",
      label: "CDC ArboNET tickborne pathogen status",
      note: "No records is not absence.",
      url: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      vintage: "through 2025-12-31",
    },
    {
      key: "context_rucc",
      label: "USDA ERS Rural-Urban Continuum Codes",
      note: "RUCC is contextual and not causal.",
      url: "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/",
      vintage: "2023",
    },
  ],
  stateUnallocatedRecords: 5,
  sviPercentile: null,
  tickStatus: "Established",
  uninsuredPercent: null,
};

describe("County Investigate evidence hierarchy", () => {
  afterEach(() => {
    cleanup();
  });

  it("places observed families before coverage, context, and explicit limits", () => {
    render(
      <InvestigateEvidenceHierarchy
        bundle={mixedBundle()}
        countyRecord={publishedRecord}
        measures={yearMeasures}
        modelAssisted={
          <p data-testid="investigate-model-slot">Model-assisted</p>
        }
      />
    );
    const human = screen.getByTestId("investigate-family-human");
    const vector = screen.getByTestId("investigate-family-vector_pathogen");
    const coverage = screen.getByTestId("investigate-coverage");
    const environmental = screen.getByTestId(
      "investigate-family-environmental_population"
    );
    const gaps = screen.getByTestId("investigate-gaps");
    const follows = (before: HTMLElement, after: HTMLElement) =>
      before.compareDocumentPosition(after) ===
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect({
      coverageAfterVector: follows(vector, coverage),
      coverageScore: coverage.textContent?.includes("84.6") ?? false,
      coverageText:
        coverage.textContent?.includes("Published input coverage is 50") ??
        false,
      environmentalClass: environmental.dataset.evidenceClass,
      gapsAfterContext: follows(environmental, gaps),
      gapsPopulation:
        gaps.textContent?.includes(
          "Population was not returned for this county. That is not zero."
        ) ?? false,
      gapsUnallocated:
        gaps.textContent?.includes("not allocated to a county") ?? false,
      humanClass: human.dataset.evidenceClass,
      modelInsideCoverage: coverage.contains(
        screen.getByTestId("investigate-model-slot")
      ),
      vectorAfterHuman: follows(human, vector),
      vectorDetections: vector.textContent?.includes("0 detections") ?? false,
      vectorStatus:
        vector.textContent?.includes("Published status: No records.") ?? false,
    }).toStrictEqual({
      coverageAfterVector: true,
      coverageScore: false,
      coverageText: true,
      environmentalClass: "contextual",
      gapsAfterContext: true,
      gapsPopulation: true,
      gapsUnallocated: true,
      humanClass: "observed",
      modelInsideCoverage: true,
      vectorAfterHuman: true,
      vectorDetections: false,
      vectorStatus: true,
    });
  });

  it("keeps disagreeing observations separate", () => {
    const bundle = mixedBundle("ambiguous");
    const conflicts = investigateEvidenceConflicts(bundle);
    expect(conflicts).toStrictEqual([
      {
        measureId: "reported-cases",
        measureLabel: "Reported Lyme cases",
        observationCount: 2,
      },
    ]);
    render(<InvestigateEvidenceHierarchy bundle={bundle} />);
    expect(screen.getByTestId("investigate-conflicts").textContent).toContain(
      "not combined"
    );
  });

  it("does not copy the review score into the published county record", () => {
    const detail = {
      burgdorferi_status: "Present",
      case_count_floor_2023: 15,
      color: "#e9602b",
      county: "Los Angeles",
      evidence_completeness: 100,
      fips: "06037",
      human_status: "published_count_floor",
      in_contiguous_tick_scope: true,
      incidence_floor_2023: 0.15,
      pacificus_status: "Established",
      population: 9_936_690,
      priority: "Priority 1 — Investigate",
      release: {
        bundle_sha256: "abc",
        generated_at: "2026-09-18T00:50:00-07:00",
        limitations: "Not a diagnosis.",
        loaded_at: "2026-09-18T00:50:00-07:00",
        methodology_version: "semantic-1.0.0",
        release_id: "governed-2026-09-18-unknown-coverage",
        schema_version: "1",
        scope: "US_COUNTIES",
        score_defaults: {},
        sources: [],
        states: [],
      },
      rucc_2023: 1,
      scapularis_status: "No records",
      score: {
        access_signal: 55,
        community: 59.7,
        ecological: 100,
        human_weakness: 98.5,
        pathogen_signal: 100,
        rural_signal: 0,
        score: 84.6,
        svi_signal: 86.3,
        tick_signal: 100,
      },
      state: "CA",
      state_name: "California",
      state_unallocated_records_2023: 43,
      svi_percentile: 0.8629,
      tick_status: "Established",
      uninsured_percent: 9,
      uninsured_percentile: 0.4,
    } satisfies CountyDetail;
    const record = publishedCountyRecordFromDetail(detail);
    const hierarchy = publishedCountyHierarchy({
      measures: [],
      observedMeasureIds: [],
      record,
    });
    expect({
      completeness: hierarchy.completeness,
      hasScore: Object.hasOwn(record, "score"),
      pacificus: hierarchy.rows.find(
        (row) => row.measureId === "pacificus_status"
      )?.evidence.displayValue,
      scapularis: hierarchy.rows.find(
        (row) => row.measureId === "scapularis_status"
      )?.evidence.displayValue,
    }).toStrictEqual({
      completeness: 100,
      hasScore: false,
      pacificus: "Established",
      scapularis: "Unavailable",
    });
    expect(
      evidenceFamilyForMeasure({
        domain: null,
        domainsRequestFailed: false,
        indicatorId: "human_disease_burden",
      })
    ).toBe("human");
  });

  it("shows partial environmental coverage as limited, not a score", () => {
    const [row] = environmentalCoverageRows({
      contexts: [
        {
          context: {
            coverage_status:
              EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
            day_convention: "labeled-24h",
            expected_area_m2: null,
            geometry_version: "g1",
            intersected_area_m2: null,
            metadata_revision_id: "m1",
            source_coverage_fraction: "0.50",
            source_supported_area_m2: null,
            source_time_present: true,
            upstream_date_modified: null,
            valid_area_m2: null,
            valid_fraction_of_supported_area: null,
            weight_version: "w1",
          },
          measureId: "precip",
          measureLabel: "Precipitation",
        },
      ],
    });
    expect({
      availability: row?.evidence.availability,
      display: row?.evidence.displayValue,
      fraction: row?.evidence.provenance.limitations[1],
    }).toStrictEqual({
      availability: "limited",
      display: "Partial coverage",
      fraction: "Source coverage fraction 0.50.",
    });
  });
});
