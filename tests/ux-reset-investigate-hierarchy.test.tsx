import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import { evidenceInspectState } from "@/features/ux-reset/evidence/from-observation";
import { formatGovernedEvidenceValue } from "@/features/ux-reset/evidence/value-state-contract";
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
import {
  indicatorDomainsById,
  loadInvestigateCountyRecord,
} from "@/features/ux-reset/investigate/load-county-evidence";
import {
  environmentalCoverageRows,
  mapPublishedRow,
  publishedCountyHierarchy,
  publishedCountyRecordFromDetail,
  publishedValueStateRole,
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
import { ApiResponseValidationError } from "@/lib/api-response-validation";

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
  methodologyVersion: null,
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
    methodologyVersion: null,
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

const INHERITED_SOURCE_NOTE = "Inherited source note.";
const INHERITED_MEASURE_LIMITATION = "Inherited measure limitation.";
const INHERITED_RELEASE_LIMITATION = "Inherited release limitation.";
const EMPTY_LIMITATION_SUMMARY =
  "No material limitation was returned on the observations for this county.";

const INHERITED_CAVEAT_SOURCES = [
  "none",
  "source-note",
  "measure-limitation",
  "source-note-and-measure-limitation",
  "release-limitation",
] as const;

type InheritedCaveatSource = (typeof INHERITED_CAVEAT_SOURCES)[number];

type CaveatRowStatus = {
  claim: string;
  coverage: EnvironmentalContext["coverage_status"] | null;
  id: string;
  measureId: string;
  sourceKey: string;
  statusParts: readonly string[];
  value: number | string | null;
};

const CAVEAT_ROW_STATUSES: readonly CaveatRowStatus[] = [
  {
    claim: "Tick surveillance status",
    coverage: null,
    id: "observed",
    measureId: "tick_status",
    sourceKey: "tick",
    statusParts: [],
    value: "Established",
  },
  {
    claim: "Tick surveillance status",
    coverage: null,
    id: "suppressed",
    measureId: "tick_status",
    sourceKey: "tick",
    statusParts: ["Suppressed or privacy-protected"],
    value: "SUPPRESSED",
  },
  {
    claim: "Borrelia burgdorferi status",
    coverage: null,
    id: "missing",
    measureId: "burgdorferi_status",
    sourceKey: "pathogen",
    statusParts: ["No county record"],
    value: "missing",
  },
  {
    claim: "Borrelia burgdorferi status",
    coverage: null,
    id: "no-records",
    measureId: "burgdorferi_status",
    sourceKey: "pathogen",
    statusParts: ["No county-linked record"],
    value: "No records",
  },
  {
    claim: "Borrelia burgdorferi status",
    coverage: null,
    id: "unavailable",
    measureId: "burgdorferi_status",
    sourceKey: "pathogen",
    statusParts: ["Unavailable for this release"],
    value: "unavailable",
  },
  {
    claim: "Borrelia burgdorferi status",
    coverage: null,
    id: "unknown",
    measureId: "burgdorferi_status",
    sourceKey: "pathogen",
    statusParts: ["Unavailable for this release"],
    value: "unknown",
  },
  {
    claim: "Borrelia burgdorferi status",
    coverage: null,
    id: "no-county-linked",
    measureId: "burgdorferi_status",
    sourceKey: "pathogen",
    statusParts: ["No county-linked record"],
    value: "no_county_linked_record",
  },
  {
    claim: "Uninsured percent",
    coverage: null,
    id: "zero",
    measureId: "uninsured_percent_2022",
    sourceKey: "context_svi",
    statusParts: [],
    value: 0,
  },
  {
    claim: "Uninsured percent",
    coverage: null,
    id: "numeric",
    measureId: "uninsured_percent_2022",
    sourceKey: "context_svi",
    statusParts: [],
    value: 9,
  },
  {
    claim: "Reported Lyme cases coverage",
    coverage: EnvironmentalContextCoverageStatus.COMPLETE,
    id: "coverage-complete",
    measureId: "reported-cases",
    sourceKey: "coverage",
    statusParts: [],
    value: null,
  },
  {
    claim: "Reported Lyme cases coverage",
    coverage: EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE,
    id: "coverage-partial",
    measureId: "reported-cases",
    sourceKey: "coverage",
    statusParts: ["Partial coverage."],
    value: null,
  },
  {
    claim: "Reported Lyme cases coverage",
    coverage: EnvironmentalContextCoverageStatus.SOURCE_MISSING,
    id: "coverage-source-missing",
    measureId: "reported-cases",
    sourceKey: "coverage",
    statusParts: ["Environmental source missing"],
    value: null,
  },
  {
    claim: "Reported Lyme cases coverage",
    coverage: EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE,
    id: "coverage-out-of-source",
    measureId: "reported-cases",
    sourceKey: "coverage",
    statusParts: ["Outside environmental source coverage"],
    value: null,
  },
];

function inheritedCaveatSelection(source: InheritedCaveatSource): {
  measureLimitation: string | null;
  release: string | null;
  sourceNote: string | null;
} {
  switch (source) {
    case "none": {
      return { measureLimitation: null, release: null, sourceNote: null };
    }
    case "source-note": {
      return {
        measureLimitation: null,
        release: null,
        sourceNote: INHERITED_SOURCE_NOTE,
      };
    }
    case "measure-limitation": {
      return {
        measureLimitation: INHERITED_MEASURE_LIMITATION,
        release: null,
        sourceNote: null,
      };
    }
    case "source-note-and-measure-limitation": {
      return {
        measureLimitation: INHERITED_MEASURE_LIMITATION,
        release: null,
        sourceNote: INHERITED_SOURCE_NOTE,
      };
    }
    case "release-limitation": {
      return {
        measureLimitation: null,
        release: INHERITED_RELEASE_LIMITATION,
        sourceNote: null,
      };
    }
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

function caveatSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function normalizeSummary(text: string | null): string {
  return (text ?? "").replaceAll(/\s+/g, " ").trim();
}

function expectedCaveatSummary(
  status: CaveatRowStatus,
  source: InheritedCaveatSource
): string {
  const inherited = inheritedCaveatSelection(source);
  const inheritedLines = [
    inherited.sourceNote,
    inherited.measureLimitation,
  ].flatMap((line) => (line ? [caveatSentence(line)] : []));
  const rowParts = [
    ...status.statusParts.map((part) => caveatSentence(part)),
    ...inheritedLines,
  ];
  const rowText =
    rowParts.length > 0 ? `${status.claim}: ${rowParts.join(" ")}` : null;
  const observationText =
    status.coverage && inheritedLines.length > 0
      ? `Reported Lyme cases: ${inheritedLines[0]}`
      : null;
  const releaseText = inherited.release
    ? caveatSentence(inherited.release)
    : null;
  const combined = [observationText, rowText, releaseText]
    .filter((part) => part !== null)
    .join(" ");
  return combined || EMPTY_LIMITATION_SUMMARY;
}

function blankCaveatRecord(
  overrides: Partial<PublishedCountyRecord>
): PublishedCountyRecord {
  return {
    burgdorferiStatus: "",
    evidenceCompleteness: 100,
    fips: "08001",
    methodologyVersion: null,
    pacificusStatus: null,
    population: null,
    releaseId: INVESTIGATE_RELEASE_ID,
    releaseLimitation: "",
    rucc: null,
    scapularisStatus: null,
    sources: [],
    stateUnallocatedRecords: null,
    sviPercentile: null,
    tickStatus: "",
    uninsuredPercent: null,
    ...overrides,
  };
}

function caveatMeasure(
  measureId: string,
  label: string,
  limitations: readonly string[]
): Measure {
  const base = yearMeasures[0];
  if (!base) {
    throw new Error("Measure fixture is missing.");
  }
  return {
    ...base,
    label,
    limitations: [...limitations],
    measure_id: measureId,
  };
}

function renderCaveatSummaryCell(
  status: CaveatRowStatus,
  source: InheritedCaveatSource
): void {
  const inherited = inheritedCaveatSelection(source);
  const inheritedLines = [
    inherited.sourceNote,
    inherited.measureLimitation,
  ].flatMap((line) => (line ? [line] : []));
  if (status.coverage) {
    render(
      <InvestigateEvidenceHierarchy
        bundle={casesBundle([
          {
            ...plainObservation(
              coverageContext(status.coverage, "0.5"),
              `obs-${status.coverage}`
            ),
            limitations: inheritedLines,
          },
        ])}
        countyRecord={blankCaveatRecord({
          releaseLimitation: inherited.release ?? "",
        })}
      />
    );
    return;
  }
  const sourceNote = inherited.sourceNote;
  const record = blankCaveatRecord({
    releaseLimitation: inherited.release ?? "",
    sources: sourceNote
      ? [
          {
            key: status.sourceKey,
            label: "Governed source",
            note: sourceNote,
            url: "https://example.com/source",
            vintage: "2025",
          },
        ]
      : [],
    ...(status.measureId === "tick_status"
      ? { tickStatus: String(status.value) }
      : {}),
    ...(status.measureId === "burgdorferi_status"
      ? { burgdorferiStatus: String(status.value) }
      : {}),
    ...(status.measureId === "uninsured_percent_2022"
      ? { uninsuredPercent: Number(status.value) }
      : {}),
  });
  const measures =
    inherited.measureLimitation === null
      ? []
      : [
          caveatMeasure(status.measureId, status.claim, [
            inherited.measureLimitation,
          ]),
        ];
  render(
    <InvestigateEvidenceHierarchy
      bundle={casesBundle([plainObservation()])}
      countyRecord={record}
      measures={measures}
    />
  );
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
    href: "#investigate-published-burgdorferi_status",
    id: "status-no-records",
    kind: "pathogen",
    limitation: "No county-linked record",
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
    href: "#investigate-published-burgdorferi_status",
    id: "status-no-county-linked",
    kind: "pathogen",
    limitation: "No county-linked record",
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
    href: "#investigate-published-burgdorferi_status",
    id: "status-missing",
    kind: "pathogen",
    limitation: "No county record",
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
    href: "#investigate-published-burgdorferi_status",
    id: "status-unavailable",
    kind: "pathogen",
    limitation: "Unavailable for this release",
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
    href: "#investigate-published-burgdorferi_status",
    id: "status-unknown",
    kind: "pathogen",
    limitation: "Unavailable for this release",
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
    href: `#investigate-coverage-obs-${EnvironmentalContextCoverageStatus.SOURCE_MISSING}`,
    id: "coverage-source-missing",
    kind: "coverage",
    limitation: "Environmental source missing",
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
    href: `#investigate-coverage-obs-${EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE}`,
    id: "coverage-out-of-source",
    kind: "coverage",
    limitation: "Outside environmental source coverage",
    provenance: "Unavailable. Outside environmental source coverage.",
    reasonCode: "ENVIRONMENTAL_OUT_OF_SOURCE_COVERAGE",
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
    [ValueState.NO_RECORDS]: seen.has(ValueState.NO_RECORDS),
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

const COUNTY_DETAIL_VALIDATION_FAILURE =
  "County detail could not be verified. Please try again later.";

type AcceptedMethodologyVersion = {
  governed: string | null;
  method: string;
  name: string;
  outcome: "accepted";
  raw: string;
};

type RejectedMethodologyVersion = {
  name: string;
  outcome: "rejected";
  raw: "null" | "omitted";
};

/**
 * The county contract requires methodology_version to be a string.
 * Empty and whitespace-only strings validate and stay unset. Null and
 * omission fail CountyV1CountiesFipsGetResponse before row mapping.
 */
const METHODOLOGY_VERSION_CASES = [
  {
    governed: "semantic-1.0.0",
    method: "Version semantic-1.0.0",
    name: "present",
    outcome: "accepted",
    raw: "semantic-1.0.0",
  },
  {
    governed: "semantic-1.0.0",
    method: "Version semantic-1.0.0",
    name: "whitespace-padded",
    outcome: "accepted",
    raw: "  semantic-1.0.0  ",
  },
  {
    governed: null,
    method: "Unavailable",
    name: "empty string",
    outcome: "accepted",
    raw: "",
  },
  {
    governed: null,
    method: "Unavailable",
    name: "whitespace-only",
    outcome: "accepted",
    raw: " \n\t ",
  },
  {
    name: "null",
    outcome: "rejected",
    raw: "null",
  },
  {
    name: "omitted",
    outcome: "rejected",
    raw: "omitted",
  },
];

const COUNTY_RECORD_ONLY_ROWS = [
  {
    freshness: "Dataset vintage 2025.",
    measureId: "tick_status",
    source: "CDC ArboNET county tick status",
    state: "Available. Observed or published.",
  },
  {
    freshness: "Unavailable",
    measureId: "burgdorferi_status",
    source: "Unavailable",
    state: "Unavailable. No county record.",
  },
  {
    freshness: "Unavailable",
    measureId: "population_2022",
    source: "Unavailable",
    state: "Available. Published zero.",
  },
  {
    freshness: "Unavailable",
    measureId: "svi_percentile_2022",
    source: "Unavailable",
    state: "Available. Observed or published.",
  },
  {
    freshness: "Unavailable",
    measureId: "uninsured_percent_2022",
    source: "Unavailable",
    state: "Available. Published zero.",
  },
  {
    freshness: "Unavailable",
    measureId: "rucc_2023",
    source: "Unavailable",
    state: "Available. Observed or published.",
  },
] as const;

function disclosureValue(root: ParentNode, testId: string): string {
  return root.querySelector(`[data-testid='${testId}'] dd`)?.textContent ?? "";
}

function labeledValue(root: ParentNode, label: string): string | null {
  for (const term of root.querySelectorAll("dt")) {
    if (term.textContent !== label) {
      continue;
    }
    return term.nextElementSibling?.textContent ?? null;
  }
  return null;
}

function inspectProvenanceText(root: ParentNode): string {
  const lines = [
    `Source: ${disclosureValue(root, "evidence-provenance-source")}`,
    `Period: ${disclosureValue(root, "evidence-provenance-period")}`,
    `Availability / freshness: ${disclosureValue(root, "evidence-provenance-freshness")}`,
    `Method: ${disclosureValue(root, "evidence-provenance-method")}`,
    `Evidence state: ${disclosureValue(root, "evidence-provenance-state")}`,
    `Governed limitations: ${
      root.querySelector(
        "[data-testid='evidence-provenance-limitations'] p:last-of-type"
      )?.textContent ?? ""
    }`,
    `Release ID: ${labeledValue(root, "Release ID") ?? ""}`,
  ];
  const methodology = labeledValue(root, "Methodology version");
  if (methodology !== null) {
    lines.push(`Methodology version: ${methodology}`);
  }
  return lines.join("\n");
}

function countyRecordPayload(
  methodologyVersion: string | "null" | "omitted"
): unknown {
  const release: Record<string, unknown> = {
    bundle_sha256: "abc",
    generated_at: "2026-09-18T00:50:00-07:00",
    limitations: "",
    loaded_at: "2026-09-18T00:50:00-07:00",
    methodology_version: "semantic-1.0.0",
    release_id: INVESTIGATE_RELEASE_ID,
    schema_version: "1",
    scope: "US_COUNTIES",
    score_defaults: {},
    sources: [
      {
        key: "tick",
        label: "CDC ArboNET county tick status",
        note: "",
        url: "",
        vintage: "2025",
      },
    ],
    states: [],
  };
  if (methodologyVersion === "omitted") {
    delete release.methodology_version;
  } else if (methodologyVersion === "null") {
    release.methodology_version = null;
  } else {
    release.methodology_version = methodologyVersion;
  }
  return {
    burgdorferi_status: "missing",
    case_count_floor_2023: null,
    color: "#e9602b",
    county: "Denver",
    evidence_completeness: 50,
    fips: "08001",
    human_status: "missing",
    in_contiguous_tick_scope: true,
    incidence_floor_2023: null,
    pacificus_status: null,
    population: 0,
    priority: "not evidence",
    release,
    rucc_2023: 1,
    scapularis_status: null,
    score: {
      access_signal: 0,
      community: 0,
      ecological: 0,
      human_weakness: 0,
      pathogen_signal: 0,
      rural_signal: 0,
      score: 0,
      svi_signal: 0,
      tick_signal: 0,
    },
    state: "CO",
    state_name: "Colorado",
    state_unallocated_records_2023: null,
    svi_percentile: 0.5,
    tick_status: "Established",
    uninsured_percent: 0,
    uninsured_percentile: null,
  };
}

function expectedInspectProvenance(
  row: (typeof COUNTY_RECORD_ONLY_ROWS)[number],
  versionCase: AcceptedMethodologyVersion
): string {
  const lines = [
    `Source: ${row.source}`,
    "Period: Unavailable",
    `Availability / freshness: ${row.freshness}`,
    `Method: ${versionCase.method}`,
    `Evidence state: ${row.state}`,
    "Governed limitations: No governed limitations were returned.",
    `Release ID: ${INVESTIGATE_RELEASE_ID}`,
  ];
  if (versionCase.governed !== null) {
    lines.push(`Methodology version: ${versionCase.governed}`);
  }
  return lines.join("\n");
}

describe("County Investigate evidence hierarchy", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
    const period = {
      measureId: "reported-cases",
      measureLabel: "Reported Lyme cases",
      observationCount: 2,
      periodEnd: "2023-12-31",
      periodStart: "2023-01-01",
      temporalGrain: "YEAR",
    };
    expect({
      closeConflict: investigateEvidenceConflicts(close),
      displays,
      equalConflict: investigateEvidenceConflicts(equal),
      periodConflict: investigateEvidenceConflicts(periods),
      stateConflict: investigateEvidenceConflicts(states),
    }).toStrictEqual({
      closeConflict: [{ ...period, disagreement: "values" }],
      displays: ["1 cases", "1 cases"],
      equalConflict: [],
      periodConflict: [],
      stateConflict: [{ ...period, disagreement: "states" }],
    });
  });

  it("names value and evidence-state disagreements separately", () => {
    const sentence = (observations: readonly Observation[]) => {
      cleanup();
      render(
        <InvestigateEvidenceHierarchy bundle={casesBundle(observations)} />
      );
      return screen.getByTestId("investigate-conflicts").textContent ?? "";
    };
    const samePeriod = "2023-01-01";
    const yearEnd = "2023-12-31";
    expect({
      both: sentence([
        caseObservation("observed", 12, samePeriod, yearEnd),
        {
          ...caseObservation("zero", 0, samePeriod, yearEnd),
          value_state: ValueState.ZERO,
        },
      ]),
      mixed: sentence([
        caseObservation("low", 4, samePeriod, yearEnd),
        caseObservation("high", 9, samePeriod, yearEnd),
        {
          ...caseObservation("missing", 0, samePeriod, yearEnd),
          value: null,
          value_state: ValueState.MISSING,
        },
      ]),
      states: sentence([
        {
          ...caseObservation("missing", 0, samePeriod, yearEnd),
          value: null,
          value_state: ValueState.MISSING,
        },
        {
          ...caseObservation("unavailable", 0, samePeriod, yearEnd),
          value: null,
          value_state: ValueState.UNAVAILABLE,
        },
      ]),
      values: sentence([
        caseObservation("cdc", 12, samePeriod, yearEnd),
        caseObservation("state", 3, samePeriod, yearEnd),
      ]),
      zeroState: sentence([
        caseObservation("observed-zero", 0, samePeriod, yearEnd),
        {
          ...caseObservation("published-zero", 0, samePeriod, yearEnd),
          value_state: ValueState.ZERO,
        },
      ]),
    }).toStrictEqual({
      both: "Reported Lyme cases returned 2 observations for the same period (2023) with different values and evidence states. They stay separate and are not combined.",
      mixed:
        "Reported Lyme cases returned 3 observations for the same period (2023) with different values and evidence states. They stay separate and are not combined.",
      states:
        "Reported Lyme cases returned 2 observations for the same period (2023) with different evidence states. They stay separate and are not combined.",
      values:
        "Reported Lyme cases returned 2 observations for the same period (2023) with different values. They stay separate and are not combined.",
      zeroState:
        "Reported Lyme cases returned 2 observations for the same period (2023) with different evidence states. They stay separate and are not combined.",
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
          disagreement: "values",
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
          disagreement: "values",
          measureId: "reported-cases",
          measureLabel: "Reported Lyme cases",
          observationCount: 2,
          periodEnd: "2023-01-31",
          periodStart: "2023-01-01",
          temporalGrain: "YEAR",
        },
        {
          disagreement: "values",
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

  it.each(
    METHODOLOGY_VERSION_CASES.filter(
      (entry): entry is AcceptedMethodologyVersion =>
        entry.outcome === "accepted"
    )
  )(
    "keeps Inspect provenance exact for county-record-only rows when methodology_version is $name",
    async (versionCase) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(countyRecordPayload(versionCase.raw))
      );
      const detail = await loadInvestigateCountyRecord({
        fips: "08001",
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: new AbortController().signal,
      });
      if (!detail) {
        throw new Error("The county record validator rejected a string.");
      }
      const geography = investigateGeographyFixture("08001");
      if (!geography) {
        throw new Error("Denver County fixture is missing.");
      }
      const record = publishedCountyRecordFromDetail(detail);
      render(
        <InvestigateEvidenceHierarchy
          bundle={investigateBundleWithoutObservations({
            county: resolveCountyIdentity(geography, "08001"),
            releaseId: INVESTIGATE_RELEASE_ID,
          })}
          countyRecord={record}
          measures={[]}
        />
      );
      const measureIds: string[] = [];
      for (const node of document.querySelectorAll("[data-measure-id]")) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        const measureId = node.dataset.measureId;
        if (measureId) {
          measureIds.push(measureId);
        }
      }
      expect({
        methodologyVersion: record.methodologyVersion,
        observationRows: document.querySelector("[data-observation-id]"),
        rows: measureIds,
      }).toStrictEqual({
        methodologyVersion: versionCase.governed,
        observationRows: null,
        rows: COUNTY_RECORD_ONLY_ROWS.map((row) => row.measureId),
      });
      for (const row of COUNTY_RECORD_ONLY_ROWS) {
        const rendered = document.querySelector(
          `[data-measure-id='${row.measureId}']`
        );
        if (!(rendered instanceof HTMLElement)) {
          throw new Error(`Missing county-record row ${row.measureId}.`);
        }
        fireEvent.click(within(rendered).getByText("Inspect provenance"));
        expect(inspectProvenanceText(rendered)).toBe(
          expectedInspectProvenance(row, versionCase)
        );
      }
    }
  );

  it.each(
    METHODOLOGY_VERSION_CASES.filter(
      (entry): entry is RejectedMethodologyVersion =>
        entry.outcome === "rejected"
    )
  )(
    "rejects a contract-invalid methodology_version when it is $name",
    async (versionCase) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(countyRecordPayload(versionCase.raw))
      );
      const error = await loadInvestigateCountyRecord({
        fips: "08001",
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: new AbortController().signal,
      }).then(
        () => null,
        (error: unknown) => error
      );
      if (!(error instanceof ApiResponseValidationError)) {
        throw new Error("County detail validation did not fail.");
      }
      expect({
        message: error.message,
        name: error.name,
      }).toStrictEqual({
        message: COUNTY_DETAIL_VALIDATION_FAILURE,
        name: "ApiResponseValidationError",
      });
    }
  );

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
        [ValueState.NO_RECORDS]: false,
        [ValueState.OBSERVED]: true,
        [ValueState.SUPPRESSED]: true,
        [ValueState.UNAVAILABLE]: true,
        [ValueState.ZERO]: true,
      },
    });
  });

  it("states every contract coverage status and published status token", () => {
    // EnvironmentalContext.coverage_status in contracts/openapi.json is
    // COMPLETE, PARTIAL_COVERAGE, SOURCE_MISSING, OUT_OF_SOURCE_COVERAGE.
    // CountyDetail status fields are unconstrained strings. The published
    // rows are every statusValueState branch, including the empty string,
    // plus the observed publisher labels the county payload carries.
    const coverageClaimLabel = "Reported Lyme cases coverage";
    const statusClaim = "Borrelia burgdorferi status";
    const emptySummary =
      "No material limitation was returned on the observations for this county.";
    const unavailableGap = `${statusClaim} is unavailable for this county. That is not zero.`;
    const coverageGap = `${coverageClaimLabel} is unavailable for this county. That is not zero.`;
    const observed = {
      availability: "available",
      gapLine: null,
      inspector: "Available. Observed or published.",
      reasonCode: ValueState.OBSERVED,
      summary: emptySummary,
      valueState: ValueState.OBSERVED,
    };
    const coverageActual = Object.fromEntries(
      Object.values(EnvironmentalContextCoverageStatus).map((status) => {
        const [row] = environmentalCoverageRows({
          contexts: [
            {
              ...coverageEntry(status, "0.5", `enum-${status}`),
              measureLabel: "Reported Lyme cases",
            },
          ],
        });
        if (!row) {
          throw new Error(`Missing coverage row for ${status}.`);
        }
        const summary = row.state.limitationText
          ? `${coverageClaimLabel}: ${row.state.limitationText}`
          : emptySummary;
        return [
          status,
          {
            availability: row.state.availability,
            display: row.evidence.displayValue,
            gapLine: row.state.gapLine,
            inspector: evidenceInspectState(
              row.state.availability,
              row.state.reasonCode
            ),
            reasonCode: row.state.reasonCode,
            summary,
            valueState: row.state.valueState,
          },
        ];
      })
    );
    const publishedTokens = [
      "",
      "Established",
      "Present",
      "Reported",
      "SUPPRESSED",
      "Unknown",
      "missing",
      "no_county_linked_record",
      "published_count_floor",
      "suppressed",
      "unavailable",
      "No records",
    ] as const;
    const publishedActual = publishedTokens.map((token) => {
      const state = mapPublishedRow({
        claimLabel: statusClaim,
        inspectAnchor: "investigate-published-burgdorferi_status",
        subject: { kind: "status", status: token },
      });
      const summary = state.limitationText
        ? `${statusClaim}: ${state.limitationText}`
        : emptySummary;
      return {
        availability: state.availability,
        display: formatGovernedEvidenceValue({
          unit: null,
          value: token,
          valueState: state.valueState,
        }),
        gapLine: state.gapLine,
        inspector: evidenceInspectState(state.availability, state.reasonCode),
        reasonCode: state.reasonCode,
        summary,
        token,
        valueState: state.valueState,
      };
    });
    expect({
      coverage: coverageActual,
      coverageStatuses: Object.values(
        EnvironmentalContextCoverageStatus
      ).sort(),
      published: publishedActual,
    }).toStrictEqual({
      coverage: {
        [EnvironmentalContextCoverageStatus.COMPLETE]: {
          ...observed,
          display: "Complete",
        },
        [EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE]: {
          availability: "unavailable",
          display: "Out of source coverage",
          gapLine: coverageGap,
          inspector: "Unavailable. Outside environmental source coverage.",
          reasonCode: "ENVIRONMENTAL_OUT_OF_SOURCE_COVERAGE",
          summary: `${coverageClaimLabel}: Outside environmental source coverage.`,
          valueState: ValueState.UNAVAILABLE,
        },
        [EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE]: {
          availability: "limited",
          display: "Partial coverage",
          gapLine: `${coverageClaimLabel}: Partial coverage.`,
          inspector: "Limited. Coverage or methodology limits apply.",
          reasonCode: "MATERIAL_LIMITATION",
          summary: `${coverageClaimLabel}: Partial coverage.`,
          valueState: ValueState.OBSERVED,
        },
        [EnvironmentalContextCoverageStatus.SOURCE_MISSING]: {
          availability: "unavailable",
          display: "Source missing",
          gapLine: coverageGap,
          inspector: "Unavailable. Environmental source missing.",
          reasonCode: "ENVIRONMENTAL_SOURCE_MISSING",
          summary: `${coverageClaimLabel}: Environmental source missing.`,
          valueState: ValueState.UNAVAILABLE,
        },
      },
      coverageStatuses: [
        "COMPLETE",
        "OUT_OF_SOURCE_COVERAGE",
        "PARTIAL_COVERAGE",
        "SOURCE_MISSING",
      ],
      published: [
        {
          availability: "unavailable",
          display: "Unavailable",
          gapLine: unavailableGap,
          inspector: "Unavailable. Unavailable for this release.",
          reasonCode: ValueState.UNAVAILABLE,
          summary: `${statusClaim}: Unavailable for this release.`,
          token: "",
          valueState: ValueState.UNAVAILABLE,
        },
        {
          ...observed,
          display: "Established",
          token: "Established",
        },
        {
          ...observed,
          display: "Present",
          token: "Present",
        },
        {
          ...observed,
          display: "Reported",
          token: "Reported",
        },
        {
          availability: "limited",
          display: "Suppressed",
          gapLine: `${statusClaim}: Suppressed or privacy-protected.`,
          inspector: "Limited. Suppressed or privacy-protected.",
          reasonCode: ValueState.SUPPRESSED,
          summary: `${statusClaim}: Suppressed or privacy-protected.`,
          token: "SUPPRESSED",
          valueState: ValueState.SUPPRESSED,
        },
        {
          availability: "unavailable",
          display: "Unavailable",
          gapLine: unavailableGap,
          inspector: "Unavailable. Unavailable for this release.",
          reasonCode: ValueState.UNAVAILABLE,
          summary: `${statusClaim}: Unavailable for this release.`,
          token: "Unknown",
          valueState: ValueState.UNAVAILABLE,
        },
        {
          availability: "unavailable",
          display: "Unavailable",
          gapLine: unavailableGap,
          inspector: "Unavailable. No county record.",
          reasonCode: ValueState.MISSING,
          summary: `${statusClaim}: No county record.`,
          token: "missing",
          valueState: ValueState.MISSING,
        },
        {
          availability: "unavailable",
          display: "Unavailable",
          gapLine: unavailableGap,
          inspector: "Unavailable. No county-linked record.",
          reasonCode: ValueState.NO_COUNTY_LINKED_RECORD,
          summary: `${statusClaim}: No county-linked record.`,
          token: "no_county_linked_record",
          valueState: ValueState.NO_COUNTY_LINKED_RECORD,
        },
        {
          ...observed,
          display: "published_count_floor",
          token: "published_count_floor",
        },
        {
          availability: "limited",
          display: "Suppressed",
          gapLine: `${statusClaim}: Suppressed or privacy-protected.`,
          inspector: "Limited. Suppressed or privacy-protected.",
          reasonCode: ValueState.SUPPRESSED,
          summary: `${statusClaim}: Suppressed or privacy-protected.`,
          token: "suppressed",
          valueState: ValueState.SUPPRESSED,
        },
        {
          availability: "unavailable",
          display: "Unavailable",
          gapLine: unavailableGap,
          inspector: "Unavailable. Unavailable for this release.",
          reasonCode: ValueState.UNAVAILABLE,
          summary: `${statusClaim}: Unavailable for this release.`,
          token: "unavailable",
          valueState: ValueState.UNAVAILABLE,
        },
        {
          availability: "unavailable",
          display: "Unavailable",
          gapLine: unavailableGap,
          inspector: "Unavailable. No county-linked record.",
          reasonCode: ValueState.NO_COUNTY_LINKED_RECORD,
          summary: `${statusClaim}: No county-linked record.`,
          token: "No records",
          valueState: ValueState.NO_COUNTY_LINKED_RECORD,
        },
      ],
    });
  });

  it("counts every observation value state in the lead, uncertainty, and closing sentences", () => {
    const caveat = "Count is provisional.";
    const claim = "Reported Lyme cases";
    const emptyFinding =
      "No observed or limited finding was returned for this county.";
    const emptyLimitation =
      "No material limitation was returned on the observations for this county.";
    const emptyGaps =
      "No conflict, gap, or extra limitation was returned for this county.";
    const unavailableGap = `${claim} is unavailable for this county. That is not zero.`;
    const suppressedGap = `${claim}: Suppressed or privacy-protected.`;
    const caveatGap = `${claim}: ${caveat}`;
    const leadFor = (display: string, availability: string) =>
      `${claim}: ${display}. ${availability}. Period 2023. Source CDC surveillance.`;
    const states = [
      ValueState.OBSERVED,
      ValueState.ZERO,
      ValueState.SUPPRESSED,
      ValueState.MISSING,
      ValueState.UNAVAILABLE,
      ValueState.NO_COUNTY_LINKED_RECORD,
    ] as const;
    const limitationModes = ["empty", "present"] as const;
    const rendered: Record<
      string,
      { closing: string[]; lead: string; uncertainty: string }
    > = {};
    for (const valueState of states) {
      for (const mode of limitationModes) {
        cleanup();
        render(
          <InvestigateEvidenceHierarchy
            bundle={casesBundle([
              {
                ...caseObservation(
                  `${valueState}-${mode}`,
                  valueState === ValueState.ZERO ? 0 : 4,
                  "2023-01-01",
                  "2023-12-31"
                ),
                limitations: mode === "present" ? [caveat] : [],
                value_state: valueState,
              },
            ])}
          />
        );
        const gapList = screen.queryByTestId("investigate-gap-list");
        const closing = gapList
          ? [...gapList.querySelectorAll("li")].map(
              (item) => item.textContent ?? ""
            )
          : [screen.getByTestId("investigate-gaps-empty").textContent ?? ""];
        rendered[`${valueState}|${mode}`] = {
          closing: closing.map((line) => line.replaceAll(/\s+/g, " ").trim()),
          lead: normalizeSummary(
            screen.getByTestId("investigate-finding-text").textContent
          ),
          uncertainty: normalizeSummary(
            screen.getByTestId("investigate-limitation-text").textContent
          ),
        };
      }
    }
    const expected: Record<
      string,
      { closing: string[]; lead: string; uncertainty: string }
    > = {};
    for (const valueState of states) {
      for (const mode of limitationModes) {
        const hasLimitation = mode === "present";
        let lead = emptyFinding;
        let uncertainty = emptyLimitation;
        let closing = [emptyGaps];
        switch (valueState) {
          case ValueState.OBSERVED: {
            lead = leadFor("4 cases", hasLimitation ? "Limited" : "Available");
            uncertainty = hasLimitation
              ? `${claim}: ${caveat}`
              : emptyLimitation;
            closing = hasLimitation ? [caveatGap] : [emptyGaps];
            break;
          }
          case ValueState.ZERO: {
            lead = leadFor("0 cases", hasLimitation ? "Limited" : "Available");
            uncertainty = hasLimitation
              ? `${claim}: ${caveat}`
              : emptyLimitation;
            closing = hasLimitation ? [caveatGap] : [emptyGaps];
            break;
          }
          case ValueState.SUPPRESSED: {
            lead = leadFor("Suppressed", "Limited");
            uncertainty = hasLimitation
              ? `${claim}: Suppressed or privacy-protected. ${caveat}`
              : suppressedGap;
            closing = hasLimitation
              ? [caveatGap, suppressedGap]
              : [suppressedGap];
            break;
          }
          case ValueState.MISSING: {
            uncertainty = hasLimitation
              ? `${claim}: No county record. ${caveat}`
              : `${claim}: No county record.`;
            closing = hasLimitation
              ? [caveatGap, unavailableGap]
              : [unavailableGap];
            break;
          }
          case ValueState.UNAVAILABLE: {
            uncertainty = hasLimitation
              ? `${claim}: Unavailable for this release. ${caveat}`
              : `${claim}: Unavailable for this release.`;
            closing = hasLimitation
              ? [caveatGap, unavailableGap]
              : [unavailableGap];
            break;
          }
          case ValueState.NO_COUNTY_LINKED_RECORD: {
            uncertainty = hasLimitation
              ? `${claim}: No county-linked record. ${caveat}`
              : `${claim}: No county-linked record.`;
            closing = hasLimitation
              ? [caveatGap, unavailableGap]
              : [unavailableGap];
            break;
          }
          default: {
            const exhaustive: never = valueState;
            throw new Error(exhaustive);
          }
        }
        expected[`${valueState}|${mode}`] = { closing, lead, uncertainty };
      }
    }
    expect(rendered).toStrictEqual(expected);
  });

  it("keeps every status reason beside each inherited caveat in the uncertainty summary", () => {
    const rows: Record<string, string> = {};
    for (const status of CAVEAT_ROW_STATUSES) {
      for (const inherited of INHERITED_CAVEAT_SOURCES) {
        cleanup();
        renderCaveatSummaryCell(status, inherited);
        rows[`${status.id}|${inherited}`] = normalizeSummary(
          screen.getByTestId("investigate-limitation-text").textContent
        );
      }
    }
    const expected: Record<string, string> = {};
    for (const status of CAVEAT_ROW_STATUSES) {
      for (const inherited of INHERITED_CAVEAT_SOURCES) {
        expected[`${status.id}|${inherited}`] = expectedCaveatSummary(
          status,
          inherited
        );
      }
    }
    expect({
      roles: {
        [ValueState.MISSING]: publishedValueStateRole(ValueState.MISSING),
        [ValueState.NO_COUNTY_LINKED_RECORD]: publishedValueStateRole(
          ValueState.NO_COUNTY_LINKED_RECORD
        ),
        [ValueState.OBSERVED]: publishedValueStateRole(ValueState.OBSERVED),
        [ValueState.SUPPRESSED]: publishedValueStateRole(ValueState.SUPPRESSED),
        [ValueState.UNAVAILABLE]: publishedValueStateRole(
          ValueState.UNAVAILABLE
        ),
        [ValueState.ZERO]: publishedValueStateRole(ValueState.ZERO),
      },
      rows,
    }).toStrictEqual({
      roles: {
        [ValueState.MISSING]: "uncertainty",
        [ValueState.NO_COUNTY_LINKED_RECORD]: "uncertainty",
        [ValueState.OBSERVED]: "informational",
        [ValueState.SUPPRESSED]: "uncertainty",
        [ValueState.UNAVAILABLE]: "uncertainty",
        [ValueState.ZERO]: "informational",
      },
      rows: expected,
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

  it("uses an ordinal suffix for every social vulnerability percentile", () => {
    const ordinal = (percentile: number) => {
      const hundred = percentile % 100;
      if (hundred >= 11 && hundred <= 13) {
        return `${percentile}th percentile`;
      }
      const ten = percentile % 10;
      if (ten === 1) {
        return `${percentile}st percentile`;
      }
      if (ten === 2) {
        return `${percentile}nd percentile`;
      }
      if (ten === 3) {
        return `${percentile}rd percentile`;
      }
      return `${percentile}th percentile`;
    };
    const labels = Array.from({ length: 101 }, (_, percentile) => {
      const hierarchy = publishedCountyHierarchy({
        measures: [],
        observedMeasureIds: [],
        record: quietRecord({ sviPercentile: percentile / 100 }),
      });
      return (
        hierarchy.rows.find((row) => row.measureId === "svi_percentile_2022")
          ?.evidence.displayValue ?? null
      );
    });
    expect({
      labels,
      samples: {
        eleventh: labels[11],
        first: labels[1],
        hundredth: labels[100],
        second: labels[2],
        third: labels[3],
        thirteenth: labels[13],
        twelfth: labels[12],
        twentyFirst: labels[21],
        twentySecond: labels[22],
        twentyThird: labels[23],
        zeroth: labels[0],
      },
    }).toStrictEqual({
      labels: Array.from({ length: 101 }, (_, percentile) =>
        ordinal(percentile)
      ),
      samples: {
        eleventh: "11th percentile",
        first: "1st percentile",
        hundredth: "100th percentile",
        second: "2nd percentile",
        third: "3rd percentile",
        thirteenth: "13th percentile",
        twelfth: "12th percentile",
        twentyFirst: "21st percentile",
        twentySecond: "22nd percentile",
        twentyThird: "23rd percentile",
        zeroth: "0th percentile",
      },
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
    countyRecordRefreshError: null,
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
          countyRecordRefreshError={view.countyRecordRefreshError}
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
    countyRecordRefreshError: null,
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
          countyRecordRefreshError={view.countyRecordRefreshError}
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
