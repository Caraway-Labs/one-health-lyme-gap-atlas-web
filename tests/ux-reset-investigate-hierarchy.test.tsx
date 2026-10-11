import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import {
  buildCountyEvidenceBundle,
  evidenceFamilyForMeasure,
  investigateEvidenceConflicts,
  investigateMultipleObservations,
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
  ValueState,
  type CountyDetail,
  type EnvironmentalContext,
  type Measure,
  type Observation,
} from "@/generated/models";

import {
  INVESTIGATE_RELEASE_ID,
  investigateGeographyFixture,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const yearMeasures = investigateMeasuresFixture as Measure[];

function coverageEntry(
  status: EnvironmentalContext["coverage_status"],
  fraction: string,
  observationId = "obs-precip",
  periodStart = "2023-01-01",
  periodEnd = "2023-12-31"
) {
  const observationPeriod = formatObservationPeriod(
    periodStart,
    periodEnd,
    "YEAR"
  );
  return {
    context: coverageContext(status, fraction),
    measureId: "precip",
    measureLabel: "Precipitation",
    observationId,
    provenance: {
      datasetVintage: "2026.1",
      evidenceType: "Observed",
      inspectSummary: "CDC surveillance covering the observation period.",
      limitations: [],
      materialCaveat: null,
      methodLabel: "County precipitation extract",
      methodVersion: "1.0.0",
      observationPeriod,
      sourceFamily: "CDC surveillance",
      sourcePublishedAt: "Jan 2, 2026, 12:00 AM",
      sourceUrl: "https://www.cdc.gov/example",
      technical: {
        methodologyVersion: "1.0.0",
        observationId,
        provenanceRef: `prov/${observationId}`,
        releaseId: INVESTIGATE_RELEASE_ID,
        sourceId: "cdc-surveillance",
      },
    },
  };
}

function coverageContext(
  status: EnvironmentalContext["coverage_status"],
  fraction: string
): EnvironmentalContext {
  return {
    coverage_status: status,
    day_convention: "labeled-24h",
    expected_area_m2: null,
    geometry_version: "g1",
    intersected_area_m2: null,
    metadata_revision_id: "m1",
    source_coverage_fraction: fraction,
    source_supported_area_m2: null,
    source_time_present: true,
    upstream_date_modified: null,
    valid_area_m2: null,
    valid_fraction_of_supported_area: null,
    weight_version: "w1",
  };
}

function casesBundle(observations: readonly Observation[]) {
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
      observations:
        measure.measure_id === "reported-cases" ? [...observations] : [],
      status: "ready" as const,
    })),
    releaseId: INVESTIGATE_RELEASE_ID,
  });
}

function caseObservation(
  id: string,
  value: number,
  periodStart: string,
  periodEnd: string
): Observation {
  const [base] = investigateObservationsFor({
    fips: "08001",
    measureId: "reported-cases",
    scenario: "sparse",
  });
  if (!base) {
    throw new Error("Reported-cases fixture is missing.");
  }
  return {
    ...base,
    observation_id: id,
    period_end: periodEnd,
    period_start: periodStart,
    value,
  };
}

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
        coverage.textContent?.includes("Published input coverage is 50%.") ??
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

  it("does not call a monthly series a conflict", () => {
    const bundle = casesBundle([
      caseObservation("jan", 1, "2023-01-01", "2023-01-31"),
      caseObservation("feb", 4, "2023-02-01", "2023-02-28"),
      caseObservation("mar", 2, "2023-03-01", "2023-03-31"),
    ]);
    render(<InvestigateEvidenceHierarchy bundle={bundle} />);
    expect({
      conflicts: investigateEvidenceConflicts(bundle),
      multiple: screen
        .getByTestId("investigate-multiple-observations")
        .textContent?.includes("multiple observations, not a conflict"),
    }).toStrictEqual({
      conflicts: [],
      multiple: true,
    });
  });

  it("flags different raw values that share display text", () => {
    const close = casesBundle([
      caseObservation("a", 1.0000001, "2023-01-01", "2023-12-31"),
      caseObservation("b", 1.0000002, "2023-01-01", "2023-12-31"),
    ]);
    const equal = casesBundle([
      caseObservation("a", 1.0000001, "2023-01-01", "2023-12-31"),
      caseObservation("b", 1.0000001, "2023-01-01", "2023-12-31"),
    ]);
    const periods = casesBundle([
      caseObservation("a", 1.0000001, "2023-01-01", "2023-01-31"),
      caseObservation("b", 1.0000002, "2023-02-01", "2023-02-28"),
    ]);
    const states = casesBundle([
      caseObservation("a", 1.0000001, "2023-01-01", "2023-12-31"),
      {
        ...caseObservation("b", 1.0000001, "2023-01-01", "2023-12-31"),
        value_state: ValueState.SUPPRESSED,
      },
    ]);
    const displays = close.families.flatMap((family) =>
      family.observations.map((record) => record.evidence.displayValue)
    );
    const conflict = [
      {
        measureId: "reported-cases",
        measureLabel: "Reported Lyme cases",
        observationCount: 2,
      },
    ];
    expect({
      closeConflict: investigateEvidenceConflicts(close),
      displays,
      equalConflict: investigateEvidenceConflicts(equal),
      periodConflict: investigateEvidenceConflicts(periods),
      stateConflict: investigateEvidenceConflicts(states),
    }).toStrictEqual({
      closeConflict: conflict,
      displays: ["1 cases", "1 cases"],
      equalConflict: [],
      periodConflict: [],
      stateConflict: conflict,
    });
  });

  it("flags same-period values that disagree", () => {
    const bundle = casesBundle([
      caseObservation("cdc", 12, "2023-01-01", "2023-12-31"),
      caseObservation("state", 3, "2023-01-01", "2023-12-31"),
    ]);
    render(<InvestigateEvidenceHierarchy bundle={bundle} />);
    expect({
      conflicts: investigateEvidenceConflicts(bundle),
      keptSeparate: screen
        .getByTestId("investigate-conflicts")
        .textContent?.includes("not combined"),
      multiples: investigateMultipleObservations(bundle),
    }).toStrictEqual({
      conflicts: [
        {
          measureId: "reported-cases",
          measureLabel: "Reported Lyme cases",
          observationCount: 2,
        },
      ],
      keptSeparate: true,
      multiples: [],
    });
  });

  it("holds the empty finding until the county record settles", () => {
    const bundle = casesBundle([]);
    const view = render(
      <InvestigateEvidenceHierarchy bundle={bundle} countyRecordLoading />
    );
    const pending =
      screen.getByTestId("investigate-finding-text").textContent ?? "";
    const pendingGaps =
      screen.queryByText(
        "No conflict, gap, or extra limitation was returned for this county."
      ) !== null;
    const pendingFamilies = screen.queryAllByTestId(
      "investigate-family-empty"
    ).length;
    view.rerender(
      <InvestigateEvidenceHierarchy
        bundle={bundle}
        countyRecord={publishedRecord}
      />
    );
    const settled =
      screen.getByTestId("investigate-finding-text").textContent ?? "";
    view.rerender(
      <InvestigateEvidenceHierarchy
        bundle={bundle}
        countyRecordError="The published county record could not be loaded. That is a request failure, not missing evidence."
      />
    );
    const errored =
      screen.getByTestId("investigate-finding-text").textContent ?? "";
    expect({
      erroredEmpty: errored.includes("No observed or limited finding"),
      pendingEmpty: pending.includes("No observed or limited finding"),
      pendingFamilies,
      pendingGaps,
      pendingLoading: pending.includes("still loading"),
      settledEmpty: settled.includes("No observed or limited finding"),
      settledValue: settled.includes("Established"),
    }).toStrictEqual({
      erroredEmpty: true,
      pendingEmpty: false,
      pendingFamilies: 0,
      pendingGaps: false,
      pendingLoading: true,
      settledEmpty: false,
      settledValue: true,
    });
  });

  it("shows an observation finding while the county record is still loading", () => {
    render(
      <InvestigateEvidenceHierarchy
        bundle={casesBundle([
          caseObservation("a", 12, "2023-01-01", "2023-12-31"),
        ])}
        countyRecordLoading
      />
    );
    const text =
      screen.getByTestId("investigate-finding-text").textContent ?? "";
    expect({
      held: text.includes("still loading"),
      value: text.includes("12"),
    }).toStrictEqual({
      held: false,
      value: true,
    });
  });

  it("leads with a published county row when observations have no finding", () => {
    const bundle = casesBundle([]);
    render(
      <InvestigateEvidenceHierarchy
        bundle={bundle}
        countyRecord={publishedRecord}
      />
    );
    const text = screen.getByTestId("investigate-finding-text").textContent;
    expect({
      deniesFinding: text?.includes("No observed or limited finding") ?? false,
      value: text?.includes("Established") ?? false,
    }).toStrictEqual({
      deniesFinding: false,
      value: true,
    });
  });

  it("keeps a suppressed published status limited", () => {
    const hierarchy = publishedCountyHierarchy({
      measures: [],
      observedMeasureIds: [],
      record: {
        ...publishedRecord,
        burgdorferiStatus: "No records",
        pacificusStatus: null,
        population: null,
        rucc: null,
        scapularisStatus: null,
        sources: [],
        sviPercentile: null,
        tickStatus: "SUPPRESSED",
        uninsuredPercent: null,
      },
    });
    const row = hierarchy.rows.find(
      (entry) => entry.measureId === "tick_status"
    );
    expect({
      availability: row?.evidence.availability,
      display: row?.evidence.displayValue,
      reason: row?.evidence.reasonCode,
    }).toStrictEqual({
      availability: "limited",
      display: "Suppressed",
      reason: "SUPPRESSED",
    });
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
        coverageEntry(
          EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
          "0.50"
        ),
      ],
    });
    expect({
      availability: row?.evidence.availability,
      display: row?.evidence.displayValue,
      fraction: row?.evidence.provenance.inspectSummary,
      limitations: row?.evidence.provenance.limitations,
    }).toStrictEqual({
      availability: "limited",
      display: "Partial coverage",
      fraction:
        "Precipitation coverage is Partial coverage. Environmental context. CDC surveillance covering the observation period. Source coverage fraction 0.50.",
      limitations: ["Partial coverage."],
    });
  });

  it("keeps complete coverage available when the fraction is 1.0", () => {
    const [row] = environmentalCoverageRows({
      contexts: [
        coverageEntry(EnvironmentalContextCoverageStatus.COMPLETE, "1.0"),
      ],
    });
    expect({
      availability: row?.evidence.availability,
      display: row?.evidence.displayValue,
      fraction: row?.evidence.provenance.inspectSummary,
      limitations: row?.evidence.provenance.limitations,
      reason: row?.evidence.reasonCode,
    }).toStrictEqual({
      availability: "available",
      display: "Complete",
      fraction:
        "Precipitation coverage is Complete. Environmental context. CDC surveillance covering the observation period. Source coverage fraction 1.0.",
      limitations: [],
      reason: "OBSERVED",
    });
  });

  it("keeps the observation source on a coverage row", () => {
    const [row] = environmentalCoverageRows({
      contexts: [
        {
          ...coverageEntry(
            EnvironmentalContextCoverageStatus.COMPLETE,
            "1.0",
            "obs-prism"
          ),
          provenance: {
            ...coverageEntry(
              EnvironmentalContextCoverageStatus.COMPLETE,
              "1.0",
              "obs-prism"
            ).provenance,
            datasetVintage: "PRISM 2023",
            inspectSummary: "PRISM precipitation covering 2023.",
            methodLabel: "PRISM county extract",
            sourceFamily: "PRISM precipitation",
            sourcePublishedAt: "Mar 1, 2024, 12:00 AM",
            sourceUrl: "https://prism.oregonstate.edu/",
            technical: {
              methodologyVersion: "prism-1",
              observationId: "obs-prism",
              provenanceRef: "prov/obs-prism",
              releaseId: INVESTIGATE_RELEASE_ID,
              sourceId: "prism",
            },
          },
        },
      ],
    });
    expect({
      method: row?.evidence.provenance.methodLabel ?? null,
      period: row?.evidence.provenance.observationPeriod,
      provenanceRef: row?.evidence.provenance.technical?.provenanceRef ?? null,
      published: row?.evidence.provenance.sourcePublishedAt ?? null,
      release: row?.evidence.provenance.technical?.releaseId ?? null,
      source: row?.evidence.provenance.sourceFamily,
      sourceId: row?.evidence.provenance.technical?.sourceId ?? null,
      summary: row?.evidence.provenance.inspectSummary,
      url: row?.evidence.provenance.sourceUrl ?? null,
      vintage: row?.evidence.provenance.datasetVintage ?? null,
    }).toStrictEqual({
      method: "PRISM county extract",
      period: "2023",
      provenanceRef: "prov/obs-prism",
      published: "Mar 1, 2024, 12:00 AM",
      release: INVESTIGATE_RELEASE_ID,
      source: "PRISM precipitation",
      sourceId: "prism",
      summary:
        "Precipitation coverage is Complete. Environmental context. PRISM precipitation covering 2023. Source coverage fraction 1.0.",
      url: "https://prism.oregonstate.edu/",
      vintage: "PRISM 2023",
    });
  });

  it("keeps each coverage observation's period and identity", () => {
    const rows = environmentalCoverageRows({
      contexts: [
        coverageEntry(
          EnvironmentalContextCoverageStatus.COMPLETE,
          "1.0",
          "obs-jan",
          "2023-01-01",
          "2023-01-31"
        ),
        coverageEntry(
          EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
          "0.50",
          "obs-feb",
          "2023-02-01",
          "2023-02-28"
        ),
      ],
    });
    expect({
      identities: rows.map((row) => row.observationId),
      periods: rows.map((row) => row.evidence.provenance.observationPeriod),
      releases: rows.map(
        (row) => row.evidence.provenance.technical?.releaseId ?? null
      ),
      statuses: rows.map((row) => row.coverageStatus),
    }).toStrictEqual({
      identities: ["obs-jan", "obs-feb"],
      periods: [
        "January 1, 2023 – January 31, 2023 (YEAR)",
        "February 1, 2023 – February 28, 2023 (YEAR)",
      ],
      releases: [INVESTIGATE_RELEASE_ID, INVESTIGATE_RELEASE_ID],
      statuses: [
        EnvironmentalContextCoverageStatus.COMPLETE,
        EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
      ],
    });
  });

  it("carries the validated release into published row provenance", () => {
    const hierarchy = publishedCountyHierarchy({
      measures: [],
      observedMeasureIds: [],
      record: {
        ...publishedRecord,
        population: 100,
        sources: publishedRecord.sources.filter(
          (source) => source.key === "tick"
        ),
      },
    });
    const pacificus = hierarchy.rows.find(
      (row) => row.measureId === "pacificus_status"
    );
    const population = hierarchy.rows.find(
      (row) => row.measureId === "population_2022"
    );
    expect({
      pacificusRelease:
        pacificus?.evidence.provenance.technical?.releaseId ?? null,
      populationRelease:
        population?.evidence.provenance.technical?.releaseId ?? null,
    }).toStrictEqual({
      pacificusRelease: INVESTIGATE_RELEASE_ID,
      populationRelease: INVESTIGATE_RELEASE_ID,
    });
  });

  it("converts the SVI fraction to a percentile and keeps neighboring units", () => {
    const measure = yearMeasures[0];
    if (!measure) {
      throw new Error("Measure fixture is missing.");
    }
    const hierarchy = publishedCountyHierarchy({
      measures: [
        {
          ...measure,
          label: "Social vulnerability percentile",
          measure_id: "svi_percentile_2022",
          unit: "fraction",
        },
        {
          ...measure,
          label: "Uninsured percent",
          measure_id: "uninsured_percent_2022",
          unit: "fraction",
        },
      ],
      observedMeasureIds: [],
      record: {
        ...publishedRecord,
        population: 1000,
        rucc: 2,
        sviPercentile: 0.8629,
        uninsuredPercent: 9,
      },
    });
    const display = (measureId: string) =>
      hierarchy.rows.find((row) => row.measureId === measureId)?.evidence
        .displayValue ?? null;
    expect({
      population: display("population_2022"),
      rucc: display("rucc_2023"),
      svi: display("svi_percentile_2022"),
      uninsured: display("uninsured_percent_2022"),
    }).toStrictEqual({
      population: "1,000",
      rucc: "2",
      svi: "86th percentile",
      uninsured: "9%",
    });
  });
});
