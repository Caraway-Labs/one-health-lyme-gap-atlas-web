import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import {
  buildCountyEvidenceBundle,
  evidenceFamilyForMeasure,
  investigateBundleWithoutObservations,
  investigateEvidenceConflicts,
  investigateMultipleObservations,
  resolveCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import { settledInvestigateHierarchy } from "@/features/ux-reset/investigate/investigate-settled-view";
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

const NO_MATERIAL_LIMITATION = "No material limitation";

function unavailableCountyGap(claim: string): string {
  return `${claim} is unavailable for this county. That is not zero.`;
}

function quietRecord(
  overrides: Partial<PublishedCountyRecord>
): PublishedCountyRecord {
  return {
    burgdorferiStatus: "Present",
    evidenceCompleteness: 100,
    fips: "08001",
    pacificusStatus: null,
    population: 1000,
    releaseId: INVESTIGATE_RELEASE_ID,
    releaseLimitation: "",
    rucc: 1,
    scapularisStatus: null,
    sources: [],
    stateUnallocatedRecords: null,
    sviPercentile: 0.5,
    tickStatus: "Established",
    uninsuredPercent: 9,
    ...overrides,
  };
}

function plainObservation(
  context: EnvironmentalContext | null = null,
  observationId = "obs-plain"
): Observation {
  return {
    ...caseObservation(observationId, 4, "2023-01-01", "2023-12-31"),
    environmental_context: context,
    limitations: [],
  };
}

const PUBLISHED_STATUS_TOKENS = [
  "Established",
  "SUPPRESSED",
  "No records",
  "missing",
  "unavailable",
  "unknown",
  "no_county_linked_record",
] as const;

type PublishedStatusToken = (typeof PUBLISHED_STATUS_TOKENS)[number];

type GovernedStateCase = {
  anchor: string;
  availability: string;
  display: string;
  gapLine: string | null;
  href: string | null;
  id: string;
  limitation: string;
  provenance: string;
  reasonCode: string;
  valueState: ValueState;
} & (
  | {
      kind: "coverage";
      status: EnvironmentalContext["coverage_status"];
    }
  | { kind: "pathogen"; status: string }
  | { kind: "svi"; value: number }
  | { kind: "tick"; status: string }
  | { kind: "uninsured"; value: number }
);

const tickClaim = "Tick surveillance status";
const pathogenClaim = "Borrelia burgdorferi status";
const coverageClaim = "Reported Lyme cases coverage";

const GOVERNED_STATE_CASES: readonly GovernedStateCase[] = [
  {
    anchor: "investigate-published-uninsured_percent_2022",
    availability: "available",
    display: "9%",
    gapLine: null,
    href: null,
    id: "numeric-observed",
    kind: "uninsured",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Available. Observed or published.",
    reasonCode: ValueState.OBSERVED,
    value: 9,
    valueState: ValueState.OBSERVED,
  },
  {
    anchor: "investigate-published-uninsured_percent_2022",
    availability: "available",
    display: "0%",
    gapLine: null,
    href: null,
    id: "numeric-zero",
    kind: "uninsured",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Available. Published zero.",
    reasonCode: ValueState.ZERO,
    value: 0,
    valueState: ValueState.ZERO,
  },
  {
    anchor: "investigate-published-svi_percentile_2022",
    availability: "available",
    display: "0th percentile",
    gapLine: null,
    href: null,
    id: "svi-zero",
    kind: "svi",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Available. Published zero.",
    reasonCode: ValueState.ZERO,
    value: 0,
    valueState: ValueState.ZERO,
  },
  {
    anchor: "investigate-published-tick_status",
    availability: "available",
    display: "Established",
    gapLine: null,
    href: null,
    id: "status-observed",
    kind: "tick",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Available. Observed or published.",
    reasonCode: ValueState.OBSERVED,
    status: "Established",
    valueState: ValueState.OBSERVED,
  },
  {
    anchor: "investigate-published-tick_status",
    availability: "limited",
    display: "Suppressed",
    gapLine: `${tickClaim}: Suppressed or privacy-protected.`,
    href: "#investigate-published-tick_status",
    id: "status-suppressed",
    kind: "tick",
    limitation: "Suppressed or privacy-protected",
    provenance: "Limited. Suppressed or privacy-protected.",
    reasonCode: ValueState.SUPPRESSED,
    status: "SUPPRESSED",
    valueState: ValueState.SUPPRESSED,
  },
  {
    anchor: "investigate-published-burgdorferi_status",
    availability: "unavailable",
    display: "Unavailable",
    gapLine: unavailableCountyGap(pathogenClaim),
    href: null,
    id: "status-no-records",
    kind: "pathogen",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. No county-linked record.",
    reasonCode: ValueState.NO_COUNTY_LINKED_RECORD,
    status: "No records",
    valueState: ValueState.NO_COUNTY_LINKED_RECORD,
  },
  {
    anchor: "investigate-published-burgdorferi_status",
    availability: "unavailable",
    display: "Unavailable",
    gapLine: unavailableCountyGap(pathogenClaim),
    href: null,
    id: "status-no-county-linked",
    kind: "pathogen",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. No county-linked record.",
    reasonCode: ValueState.NO_COUNTY_LINKED_RECORD,
    status: "no_county_linked_record",
    valueState: ValueState.NO_COUNTY_LINKED_RECORD,
  },
  {
    anchor: "investigate-published-burgdorferi_status",
    availability: "unavailable",
    display: "Unavailable",
    gapLine: unavailableCountyGap(pathogenClaim),
    href: null,
    id: "status-missing",
    kind: "pathogen",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. No county record.",
    reasonCode: ValueState.MISSING,
    status: "missing",
    valueState: ValueState.MISSING,
  },
  {
    anchor: "investigate-published-burgdorferi_status",
    availability: "unavailable",
    display: "Unavailable",
    gapLine: unavailableCountyGap(pathogenClaim),
    href: null,
    id: "status-unavailable",
    kind: "pathogen",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. Unavailable for this release.",
    reasonCode: ValueState.UNAVAILABLE,
    status: "unavailable",
    valueState: ValueState.UNAVAILABLE,
  },
  {
    anchor: "investigate-published-burgdorferi_status",
    availability: "unavailable",
    display: "Unavailable",
    gapLine: unavailableCountyGap(pathogenClaim),
    href: null,
    id: "status-unknown",
    kind: "pathogen",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. Unavailable for this release.",
    reasonCode: ValueState.UNAVAILABLE,
    status: "unknown",
    valueState: ValueState.UNAVAILABLE,
  },
  {
    anchor: `investigate-coverage-obs-${EnvironmentalContextCoverageStatus.COMPLETE}`,
    availability: "available",
    display: "Complete",
    gapLine: null,
    href: null,
    id: "coverage-complete",
    kind: "coverage",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Available. Observed or published.",
    reasonCode: ValueState.OBSERVED,
    status: EnvironmentalContextCoverageStatus.COMPLETE,
    valueState: ValueState.OBSERVED,
  },
  {
    anchor: `investigate-coverage-obs-${EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE}`,
    availability: "limited",
    display: "Partial coverage",
    gapLine: `${coverageClaim}: Partial coverage.`,
    href: `#investigate-coverage-obs-${EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE}`,
    id: "coverage-partial",
    kind: "coverage",
    limitation: "Partial coverage.",
    provenance: "Limited. Coverage or methodology limits apply.",
    reasonCode: "MATERIAL_LIMITATION",
    status: EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
    valueState: ValueState.OBSERVED,
  },
  {
    anchor: `investigate-coverage-obs-${EnvironmentalContextCoverageStatus.SOURCE_MISSING}`,
    availability: "unavailable",
    display: "Source missing",
    gapLine: unavailableCountyGap(coverageClaim),
    href: null,
    id: "coverage-source-missing",
    kind: "coverage",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. Environmental source missing.",
    reasonCode: "ENVIRONMENTAL_SOURCE_MISSING",
    status: EnvironmentalContextCoverageStatus.SOURCE_MISSING,
    valueState: ValueState.UNAVAILABLE,
  },
  {
    anchor: `investigate-coverage-obs-${EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE}`,
    availability: "unavailable",
    display: "Out of source coverage",
    gapLine: unavailableCountyGap(coverageClaim),
    href: null,
    id: "coverage-out-of-source",
    kind: "coverage",
    limitation: NO_MATERIAL_LIMITATION,
    provenance: "Unavailable. Unavailable for this release.",
    reasonCode: ValueState.UNAVAILABLE,
    status: EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE,
    valueState: ValueState.UNAVAILABLE,
  },
];

function renderGovernedStateCase(entry: GovernedStateCase): void {
  switch (entry.kind) {
    case "uninsured": {
      render(
        <InvestigateEvidenceHierarchy
          bundle={casesBundle([plainObservation()])}
          countyRecord={quietRecord({ uninsuredPercent: entry.value })}
        />
      );
      return;
    }
    case "svi": {
      render(
        <InvestigateEvidenceHierarchy
          bundle={casesBundle([plainObservation()])}
          countyRecord={quietRecord({ sviPercentile: entry.value })}
        />
      );
      return;
    }
    case "tick": {
      render(
        <InvestigateEvidenceHierarchy
          bundle={casesBundle([plainObservation()])}
          countyRecord={quietRecord({ tickStatus: entry.status })}
        />
      );
      return;
    }
    case "pathogen": {
      render(
        <InvestigateEvidenceHierarchy
          bundle={casesBundle([plainObservation()])}
          countyRecord={quietRecord({ burgdorferiStatus: entry.status })}
        />
      );
      return;
    }
    case "coverage": {
      render(
        <InvestigateEvidenceHierarchy
          bundle={casesBundle([
            plainObservation(
              coverageContext(
                entry.status,
                entry.status === EnvironmentalContextCoverageStatus.COMPLETE
                  ? "1.0"
                  : "0.5"
              ),
              `obs-${entry.status}`
            ),
          ])}
          countyRecord={quietRecord({})}
        />
      );
      return;
    }
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function readGovernedState(entry: GovernedStateCase) {
  const card = document.querySelector<HTMLElement>(`#${entry.anchor}`);
  const link = screen.queryByRole("link", { name: "Inspect this limitation" });
  const href = link?.getAttribute("href") ?? null;
  const target = href ? document.querySelector<HTMLElement>(href) : null;
  const gaps = screen.queryByTestId("investigate-gap-list")?.textContent ?? "";
  const summary =
    screen.getByTestId("investigate-limitation-text").textContent ?? "";
  return {
    availability:
      card?.querySelector<HTMLElement>("[data-evidence-availability]")?.dataset
        .evidenceAvailability ?? null,
    coverage: card?.dataset.coverage ?? null,
    deniesGap:
      screen.queryByText(
        "No conflict, gap, or extra limitation was returned for this county."
      ) !== null,
    display:
      card?.querySelector("[data-testid='evidence-display-value']")
        ?.textContent ?? null,
    gap:
      entry.gapLine === null ? gaps.length > 0 : gaps.includes(entry.gapLine),
    href,
    id: entry.id,
    limitation: summary.includes(entry.limitation),
    provenance:
      card?.querySelector("[data-testid='evidence-provenance-state'] dd")
        ?.textContent ?? null,
    reasonCode: card?.dataset.reasonCode ?? null,
    targetValueState: target?.dataset.valueState ?? null,
    valueState: card?.dataset.valueState ?? null,
  };
}

function valueStatesSeen(
  rows: readonly { valueState: string | null }[]
): Record<ValueState, boolean> {
  const seen = new Set(rows.map((row) => row.valueState));
  return {
    [ValueState.MISSING]: seen.has(ValueState.MISSING),
    [ValueState.NO_COUNTY_LINKED_RECORD]: seen.has(
      ValueState.NO_COUNTY_LINKED_RECORD
    ),
    [ValueState.OBSERVED]: seen.has(ValueState.OBSERVED),
    [ValueState.SUPPRESSED]: seen.has(ValueState.SUPPRESSED),
    [ValueState.UNAVAILABLE]: seen.has(ValueState.UNAVAILABLE),
    [ValueState.ZERO]: seen.has(ValueState.ZERO),
  };
}

function coverageStatesSeen(
  rows: readonly { coverage: string | null }[]
): Record<EnvironmentalContextCoverageStatus, boolean> {
  const seen = new Set(
    rows.flatMap((row) => (row.coverage ? [row.coverage] : []))
  );
  return {
    [EnvironmentalContextCoverageStatus.COMPLETE]: seen.has(
      EnvironmentalContextCoverageStatus.COMPLETE
    ),
    [EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE]: seen.has(
      EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE
    ),
    [EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE]: seen.has(
      EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE
    ),
    [EnvironmentalContextCoverageStatus.SOURCE_MISSING]: seen.has(
      EnvironmentalContextCoverageStatus.SOURCE_MISSING
    ),
  };
}

function publishedStatusTokensSeen(): Record<PublishedStatusToken, boolean> {
  const statuses = new Set(
    GOVERNED_STATE_CASES.flatMap((entry) =>
      entry.kind === "tick" || entry.kind === "pathogen" ? [entry.status] : []
    )
  );
  return {
    Established: statusTokenSeen("Established", statuses),
    "No records": statusTokenSeen("No records", statuses),
    SUPPRESSED: statusTokenSeen("SUPPRESSED", statuses),
    missing: statusTokenSeen("missing", statuses),
    no_county_linked_record: statusTokenSeen(
      "no_county_linked_record",
      statuses
    ),
    unavailable: statusTokenSeen("unavailable", statuses),
    unknown: statusTokenSeen("unknown", statuses),
  };
}

function statusTokenSeen(
  token: PublishedStatusToken,
  statuses: ReadonlySet<string>
): boolean {
  switch (token) {
    case "Established":
    case "No records":
    case "SUPPRESSED":
    case "missing":
    case "no_county_linked_record":
    case "unavailable":
    case "unknown": {
      return statuses.has(token);
    }
    default: {
      const exhaustive: never = token;
      return exhaustive;
    }
  }
}

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

  it("ignores placeholder payloads on unavailable observations", () => {
    const missing = casesBundle([
      {
        ...caseObservation("a", 0, "2023-01-01", "2023-12-31"),
        value_state: ValueState.MISSING,
      },
      {
        ...caseObservation("b", 0, "2023-01-01", "2023-12-31"),
        value: null,
        value_state: ValueState.MISSING,
      },
    ]);
    const states = casesBundle([
      {
        ...caseObservation("a", 0, "2023-01-01", "2023-12-31"),
        value: null,
        value_state: ValueState.MISSING,
      },
      {
        ...caseObservation("b", 0, "2023-01-01", "2023-12-31"),
        value: null,
        value_state: ValueState.UNAVAILABLE,
      },
    ]);
    const suppressed = casesBundle([
      {
        ...caseObservation("a", 0, "2023-01-01", "2023-12-31"),
        value_state: ValueState.SUPPRESSED,
      },
      {
        ...caseObservation("b", 1, "2023-01-01", "2023-12-31"),
        value_state: ValueState.SUPPRESSED,
      },
    ]);
    expect({
      missing: investigateEvidenceConflicts(missing),
      states: investigateEvidenceConflicts(states).map(
        (conflict) => conflict.observationCount
      ),
      suppressed: investigateEvidenceConflicts(suppressed),
    }).toStrictEqual({
      missing: [],
      states: [2],
      suppressed: [],
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
        periodEnd: "2023-12-31",
        periodStart: "2023-01-01",
        temporalGrain: "YEAR",
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
          periodEnd: "2023-12-31",
          periodStart: "2023-01-01",
          temporalGrain: "YEAR",
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
    const pendingLimitation =
      screen.getByTestId("investigate-limitation-text").textContent ?? "";
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
    const settledLimitation =
      screen.getByTestId("investigate-limitation-text").textContent ?? "";
    view.rerender(
      <InvestigateEvidenceHierarchy
        bundle={bundle}
        countyRecordError="The published county record could not be loaded. That is a request failure, not missing evidence."
      />
    );
    const errored =
      screen.getByTestId("investigate-finding-text").textContent ?? "";
    const erroredLimitation =
      screen.getByTestId("investigate-limitation-text").textContent ?? "";
    const erroredGaps =
      screen.queryByText(
        "No conflict, gap, or extra limitation was returned for this county."
      ) !== null;
    expect({
      erroredEmpty: errored.includes("No observed or limited finding"),
      erroredFailure: errored.includes("could not be loaded"),
      erroredGaps,
      erroredLimitation: erroredLimitation.includes("may be incomplete"),
      pendingEmpty: pending.includes("No observed or limited finding"),
      pendingFamilies,
      pendingGaps,
      pendingLimitation: pendingLimitation.includes("still loading"),
      pendingLoading: pending.includes("still loading"),
      settledCaveat: settledLimitation.includes("No records is not absence."),
      settledEmpty: settled.includes("No observed or limited finding"),
      settledValue: settled.includes("Established"),
    }).toStrictEqual({
      erroredEmpty: false,
      erroredFailure: true,
      erroredGaps: false,
      erroredLimitation: erroredLimitation.includes("may be incomplete"),
      pendingEmpty: false,
      pendingFamilies: 0,
      pendingGaps: false,
      pendingLimitation: true,
      pendingLoading: true,
      settledCaveat: true,
      settledEmpty: false,
      settledValue: true,
    });
  });

  it("keeps each disagreeing period as its own conflict count", () => {
    const bundle = casesBundle([
      caseObservation("jan-a", 12, "2023-01-01", "2023-01-31"),
      caseObservation("jan-b", 3, "2023-01-01", "2023-01-31"),
      caseObservation("feb-a", 8, "2023-02-01", "2023-02-28"),
      caseObservation("feb-b", 1, "2023-02-01", "2023-02-28"),
    ]);
    render(<InvestigateEvidenceHierarchy bundle={bundle} />);
    const text = screen.getByTestId("investigate-conflicts").textContent ?? "";
    expect({
      conflicts: investigateEvidenceConflicts(bundle),
      namesFebruary: text.includes("February 1, 2023"),
      namesJanuary: text.includes("January 1, 2023"),
      spansPeriods: text.includes("4 observations"),
    }).toStrictEqual({
      conflicts: [
        {
          measureId: "reported-cases",
          measureLabel: "Reported Lyme cases",
          observationCount: 2,
          periodEnd: "2023-01-31",
          periodStart: "2023-01-01",
          temporalGrain: "YEAR",
        },
        {
          measureId: "reported-cases",
          measureLabel: "Reported Lyme cases",
          observationCount: 2,
          periodEnd: "2023-02-28",
          periodStart: "2023-02-01",
          temporalGrain: "YEAR",
        },
      ],
      namesFebruary: true,
      namesJanuary: true,
      spansPeriods: false,
    });
  });

  it("shows published county rows when the measure catalog failed", () => {
    const identity = resolveCountyIdentity(
      investigateGeographyFixture("08001")!,
      "08001"
    );
    render(
      <InvestigateEvidenceHierarchy
        bundle={investigateBundleWithoutObservations({
          county: identity,
          releaseId: INVESTIGATE_RELEASE_ID,
        })}
        catalogFailed
        countyRecord={publishedRecord}
      />
    );
    const evidence =
      screen.getByTestId("investigate-evidence").textContent ?? "";
    const human =
      screen.getByTestId("investigate-family-human").textContent ?? "";
    const limitation =
      screen.getByTestId("investigate-limitation-text").textContent ?? "";
    expect({
      catalog: evidence.includes("measure catalog could not be loaded"),
      caveat: limitation.includes("No records is not absence."),
      deniesLimitation: limitation.includes("No returned limitation"),
      established: evidence.includes("Established"),
      falseAbsence: evidence.includes("does not publish measures"),
      humanHeld: human.includes("measure catalog failed"),
      negativeFinding: evidence.includes("No observed or limited finding"),
    }).toStrictEqual({
      catalog: true,
      caveat: true,
      deniesLimitation: false,
      established: true,
      falseAbsence: false,
      humanHeld: true,
      negativeFinding: false,
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
    const limitation =
      screen.getByTestId("investigate-limitation-text").textContent ?? "";
    expect({
      caveat: limitation.includes("No records is not absence."),
      deniesFinding: text?.includes("No observed or limited finding") ?? false,
      deniesLimitation: limitation.includes("No returned limitation"),
      findingHref: screen
        .getByRole("link", { name: "Inspect this finding" })
        .getAttribute("href"),
      value: text?.includes("Established") ?? false,
    }).toStrictEqual({
      caveat: true,
      deniesFinding: false,
      deniesLimitation: false,
      findingHref: "#investigate-published-pacificus_status",
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

  it("limits complete coverage when the observation already has limitations", () => {
    const complete = coverageEntry(
      EnvironmentalContextCoverageStatus.COMPLETE,
      "1.0",
      "obs-limited"
    );
    const blank = coverageEntry(
      EnvironmentalContextCoverageStatus.COMPLETE,
      "1.0",
      "obs-blank"
    );
    const missing = coverageEntry(
      EnvironmentalContextCoverageStatus.SOURCE_MISSING,
      "0",
      "obs-missing"
    );
    const [limited, whitespace, unavailable] = environmentalCoverageRows({
      contexts: [
        {
          ...complete,
          provenance: {
            ...complete.provenance,
            limitations: ["Provisional extract."],
            materialCaveat: "Provisional extract.",
          },
        },
        {
          ...blank,
          provenance: {
            ...blank.provenance,
            limitations: ["  "],
          },
        },
        {
          ...missing,
          provenance: {
            ...missing.provenance,
            limitations: ["Source gap."],
          },
        },
      ],
    });
    expect({
      blankAvailability: whitespace?.evidence.availability,
      blankReason: whitespace?.evidence.reasonCode,
      limitedAvailability: limited?.evidence.availability,
      limitedCaveat: limited?.evidence.provenance.materialCaveat,
      limitedLimitations: limited?.evidence.provenance.limitations,
      limitedReason: limited?.evidence.reasonCode,
      missingAvailability: unavailable?.evidence.availability,
      missingLimitations: unavailable?.evidence.provenance.limitations,
      missingReason: unavailable?.evidence.reasonCode,
    }).toStrictEqual({
      blankAvailability: "available",
      blankReason: "OBSERVED",
      limitedAvailability: "limited",
      limitedCaveat: "Provisional extract.",
      limitedLimitations: ["Provisional extract."],
      limitedReason: "MATERIAL_LIMITATION",
      missingAvailability: "unavailable",
      missingLimitations: ["Source gap."],
      missingReason: "ENVIRONMENTAL_SOURCE_MISSING",
    });
  });

  it("keeps every published and coverage state consistent on the card, gaps, and inspect link", () => {
    const rows = GOVERNED_STATE_CASES.map((entry) => {
      cleanup();
      renderGovernedStateCase(entry);
      return readGovernedState(entry);
    });
    expect({
      coverage: coverageStatesSeen(rows),
      rows,
      tokens: publishedStatusTokensSeen(),
      valueStates: valueStatesSeen(rows),
    }).toStrictEqual({
      coverage: {
        [EnvironmentalContextCoverageStatus.COMPLETE]: true,
        [EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE]: true,
        [EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE]: true,
        [EnvironmentalContextCoverageStatus.SOURCE_MISSING]: true,
      },
      rows: GOVERNED_STATE_CASES.map((entry) => ({
        availability: entry.availability,
        coverage: entry.kind === "coverage" ? entry.status : null,
        deniesGap: entry.gapLine === null,
        display: entry.display,
        gap: entry.gapLine !== null,
        href: entry.href,
        id: entry.id,
        limitation: true,
        provenance: entry.provenance,
        reasonCode: entry.reasonCode,
        targetValueState: entry.href ? entry.valueState : null,
        valueState: entry.valueState,
      })),
      tokens: {
        Established: true,
        "No records": true,
        SUPPRESSED: true,
        missing: true,
        no_county_linked_record: true,
        unavailable: true,
        unknown: true,
      },
      valueStates: {
        [ValueState.MISSING]: true,
        [ValueState.NO_COUNTY_LINKED_RECORD]: true,
        [ValueState.OBSERVED]: true,
        [ValueState.SUPPRESSED]: true,
        [ValueState.UNAVAILABLE]: true,
        [ValueState.ZERO]: true,
      },
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

  it("renders every settled catalog, county, and observation state", () => {
    const catalogs = ["ok", "failed"] as const;
    const counties = ["found", "absent", "error"] as const;
    const observationModes = ["present", "absent"] as const;
    const caveats = ["present", "absent"] as const;
    const settled = catalogs.flatMap((catalog) =>
      counties.flatMap((county) =>
        observationModes.map((observations) => {
          cleanup();
          return readSettledInvestigateState({ catalog, county, observations });
        })
      )
    );
    const loading = catalogs.flatMap((catalog) =>
      observationModes.flatMap((observations) =>
        caveats.map((coverageCaveat) => {
          cleanup();
          return readLoadingInvestigateState({
            catalog,
            coverageCaveat,
            observations,
          });
        })
      )
    );
    expect({ loading, settled }).toStrictEqual({
      loading: catalogs.flatMap((catalog) =>
        observationModes.flatMap((observations) =>
          caveats.map((coverageCaveat) =>
            expectedLoadingInvestigateState({
              catalog,
              coverageCaveat,
              observations,
            })
          )
        )
      ),
      settled: catalogs.flatMap((catalog) =>
        counties.flatMap((county) =>
          observationModes.map((observations) =>
            expectedSettledInvestigateState({ catalog, county, observations })
          )
        )
      ),
    });
  });
});

const SETTLED_COUNTY_ERROR =
  "The published county record could not be loaded. That is a request failure, not missing evidence.";
const OBSERVATION_FINDING =
  "Reported Lyme cases: 4 cases. Available. Period 2023. Source CDC surveillance.";
const PUBLISHED_FINDING =
  "Tick surveillance status: Established. Available. Period Unavailable. Source Unavailable.";
const EMPTY_FINDING =
  "No observed or limited finding was returned for this county.";
const EMPTY_LIMITATION =
  "No material limitation was returned on the observations for this county.";
const COVERAGE_CAVEAT = "Reported Lyme cases coverage: Partial coverage.";
const LOADING_FINDING =
  "The published county record is still loading, so an empty finding is not shown yet.";
const LOADING_LIMITATION =
  "The published county record is still loading, so an empty limitation is not shown yet.";
const LOADING_GAPS = "Published county gaps are still loading.";
const COUNTY_FINDING_FAILURE =
  "The published county record could not be loaded, so findings may be incomplete. That is a request failure, not a statement that no finding was returned.";
const COUNTY_LIMITATION_FAILURE =
  "The published county record could not be loaded, so limitations may be incomplete. That is a request failure, not a statement that no limitation was returned.";
const CATALOG_FINDING =
  "The measure catalog could not be loaded, so no observation finding was requested. That is a request failure, not a statement that no finding was returned.";
const CATALOG_LIMITATION =
  "The measure catalog could not be loaded, so no observation limitation was requested. That is a request failure, not a statement that no limitation was returned.";
const CATALOG_GAPS =
  "The measure catalog could not be loaded, so observation gaps were not requested. That is a request failure, not a statement that no gap was returned.";
const EMPTY_GAPS =
  "No conflict, gap, or extra limitation was returned for this county.";
const CATALOG_NOTICE =
  "The measure catalog could not be loaded. Published county rows are shown without an observation series.";
const COVERAGE_ABSENT =
  "Published input coverage was not returned for this county. That is not zero coverage.";
const COVERAGE_KNOWN =
  "Published input coverage is 100%. This is not a disease risk score. A lower number is not zero evidence.";

function sentence(text: string | null | undefined): string | null {
  const normalized = text?.replaceAll(/\s+/g, " ").trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function readSettledInvestigateState(input: {
  catalog: "failed" | "ok";
  county: "absent" | "error" | "found";
  observations: "absent" | "present";
}) {
  const observationBundle =
    input.observations === "present"
      ? casesBundle([
          plainObservation(
            coverageContext(
              EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
              "0.5"
            ),
            "obs-partial"
          ),
        ])
      : casesBundle([]);
  const catalogError =
    input.catalog === "failed"
      ? "Governed measures could not be loaded."
      : null;
  const view = settledInvestigateHierarchy({
    bundle:
      input.catalog === "failed" && input.observations === "absent"
        ? null
        : observationBundle,
    catalogError,
    countyRecord: input.county === "found" ? quietRecord({}) : null,
    countyRecordAbsent: input.county === "absent",
    countyRecordError: input.county === "error" ? SETTLED_COUNTY_ERROR : null,
    countyRecordLoading: false,
    identity: observationBundle.county,
    releaseId: observationBundle.releaseId,
  });
  render(
    <>
      {catalogError ? <p data-testid="catalog-banner">{catalogError}</p> : null}
      {view ? (
        <InvestigateEvidenceHierarchy
          bundle={view.bundle}
          catalogFailed={view.catalogFailed}
          countyRecord={view.countyRecord}
          countyRecordError={view.countyRecordError}
          countyRecordLoading={view.countyRecordLoading}
        />
      ) : (
        <p data-testid="hierarchy-withheld">withheld</p>
      )}
    </>
  );
  return {
    catalog: input.catalog,
    catalogNotice: sentence(
      screen.queryByTestId("investigate-catalog-notice")?.textContent
    ),
    county: input.county,
    coverage: sentence(
      screen.queryByTestId("investigate-coverage-value")?.textContent
    ),
    finding: sentence(
      screen.queryByTestId("investigate-finding-text")?.textContent
    ),
    gaps: sentence(gapSentence()),
    limitation: sentence(
      screen.queryByTestId("investigate-limitation-text")?.textContent
    ),
    observations: input.observations,
    withheld: screen.queryByTestId("hierarchy-withheld") !== null,
  };
}

function gapSentence(): string | null {
  return (
    screen.queryByTestId("investigate-gaps-pending")?.textContent ??
    screen.queryByTestId("investigate-gaps-catalog")?.textContent ??
    screen.queryByTestId("investigate-gaps-empty")?.textContent ??
    null
  );
}

function expectedSettledInvestigateState(input: {
  catalog: "failed" | "ok";
  county: "absent" | "error" | "found";
  observations: "absent" | "present";
}) {
  const observationsAbsent = input.observations === "absent";
  const catalogOnly = input.catalog === "failed" && observationsAbsent;
  const finding = observationsAbsent
    ? input.county === "error"
      ? COUNTY_FINDING_FAILURE
      : input.county === "found"
        ? PUBLISHED_FINDING
        : catalogOnly
          ? CATALOG_FINDING
          : EMPTY_FINDING
    : OBSERVATION_FINDING;
  const limitation = observationsAbsent
    ? input.county === "error"
      ? COUNTY_LIMITATION_FAILURE
      : catalogOnly
        ? CATALOG_LIMITATION
        : EMPTY_LIMITATION
    : COVERAGE_CAVEAT;
  const gaps =
    observationsAbsent && input.county !== "error"
      ? catalogOnly
        ? CATALOG_GAPS
        : EMPTY_GAPS
      : null;
  const coverage =
    input.county === "found"
      ? COVERAGE_KNOWN
      : input.county === "absent"
        ? COVERAGE_ABSENT
        : null;
  return {
    catalog: input.catalog,
    catalogNotice: catalogOnly ? CATALOG_NOTICE : null,
    county: input.county,
    coverage,
    finding,
    gaps,
    limitation,
    observations: input.observations,
    withheld: false,
  };
}

function readLoadingInvestigateState(input: {
  catalog: "failed" | "ok";
  coverageCaveat: "absent" | "present";
  observations: "absent" | "present";
}) {
  const coverageStatus =
    input.coverageCaveat === "present"
      ? EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE
      : EnvironmentalContextCoverageStatus.COMPLETE;
  const observationBundle =
    input.observations === "present"
      ? casesBundle([
          plainObservation(
            coverageContext(coverageStatus, "0.5"),
            "obs-loading"
          ),
        ])
      : casesBundle([]);
  const catalogError =
    input.catalog === "failed"
      ? "Governed measures could not be loaded."
      : null;
  const view = settledInvestigateHierarchy({
    bundle:
      input.catalog === "failed" && input.observations === "absent"
        ? null
        : observationBundle,
    catalogError,
    countyRecord: null,
    countyRecordAbsent: false,
    countyRecordError: null,
    countyRecordLoading: true,
    identity: observationBundle.county,
    releaseId: observationBundle.releaseId,
  });
  render(
    <>
      {catalogError ? <p data-testid="catalog-banner">{catalogError}</p> : null}
      {view ? (
        <InvestigateEvidenceHierarchy
          bundle={view.bundle}
          catalogFailed={view.catalogFailed}
          countyRecord={view.countyRecord}
          countyRecordError={view.countyRecordError}
          countyRecordLoading={view.countyRecordLoading}
        />
      ) : (
        <p data-testid="hierarchy-withheld">withheld</p>
      )}
    </>
  );
  return {
    catalog: input.catalog,
    catalogNotice: sentence(
      screen.queryByTestId("investigate-catalog-notice")?.textContent
    ),
    coverageCaveat: input.coverageCaveat,
    finding: sentence(
      screen.queryByTestId("investigate-finding-text")?.textContent
    ),
    gaps: sentence(gapSentence()),
    limitation: sentence(
      screen.queryByTestId("investigate-limitation-text")?.textContent
    ),
    observations: input.observations,
    withheld: screen.queryByTestId("hierarchy-withheld") !== null,
  };
}

function expectedLoadingInvestigateState(input: {
  catalog: "failed" | "ok";
  coverageCaveat: "absent" | "present";
  observations: "absent" | "present";
}) {
  const withheld =
    input.catalog === "failed" && input.observations === "absent";
  const caveatShown =
    !withheld &&
    input.observations === "present" &&
    input.coverageCaveat === "present";
  return {
    catalog: input.catalog,
    catalogNotice: null,
    coverageCaveat: input.coverageCaveat,
    finding: withheld
      ? null
      : input.observations === "present"
        ? OBSERVATION_FINDING
        : LOADING_FINDING,
    gaps: withheld || caveatShown ? null : LOADING_GAPS,
    limitation: withheld
      ? null
      : caveatShown
        ? COVERAGE_CAVEAT
        : LOADING_LIMITATION,
    observations: input.observations,
    withheld,
  };
}
