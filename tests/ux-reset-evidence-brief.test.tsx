import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  evidenceBriefObservationOutcome,
  EVIDENCE_BRIEF_CATALOG_WITHHELD,
  EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID,
  EVIDENCE_BRIEF_LOCAL_CONTEXT_NOTE,
  EVIDENCE_BRIEF_NOT_LOADED,
  EVIDENCE_BRIEF_OBSERVATIONS_ABSENT,
  EVIDENCE_BRIEF_OBSERVATIONS_FAILED,
  EVIDENCE_BRIEF_UNRESOLVED,
} from "@/features/ux-reset/action/evidence-brief";
import { ActionEvidenceBrief } from "@/features/ux-reset/action/evidence-brief-panel";
import {
  buildCountyEvidenceBundle,
  investigateBundleWithoutObservations,
  resolveCountyIdentity,
  type CountyEvidenceBundle,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  CATALOG_REFRESH_FAILURE,
  COUNTY_RECORD_REFRESH_FAILURE,
  INDICATOR_REFRESH_FAILURE,
  INDICATOR_REQUEST_FAILURE,
  OBSERVATION_REFRESH_FAILURE,
  type InvestigateQueryOutcome,
} from "@/features/ux-reset/investigate/investigate-request-state";
import {
  COUNTY_RECORD_FINDING_FAILURE,
  COUNTY_RECORD_LIMITATION_FAILURE,
  COUNTY_RECORD_LOADING_FINDING,
  COUNTY_RECORD_LOADING_LIMITATION,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import { indicatorDomainsById } from "@/features/ux-reset/investigate/load-county-evidence";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { InvestigateRecovery } from "@/features/ux-reset/investigate/use-investigate-workspace";
import type { Measure } from "@/generated/models";

import {
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_RELEASE_ID,
  investigateGeographyFixture,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const RETURNED_EMPTY_FINDING =
  "No observed or limited finding was returned for this county.";
const RETURNED_EMPTY_LIMITATION =
  "No material limitation was returned on the observations for this county.";
const CASES_FINDING =
  "Reported Lyme cases: 12 cases. Available. Period 2023. Source CDC surveillance.";
const FAILED_FINDING =
  "County evidence could not be loaded. That is a request failure, not a statement that no finding was published.";
const FAILED_LIMITATION =
  "A limitation was not read because the evidence requests failed.";
const UNSUPPORTED_PERIOD =
  "The selected period is not a supported bound for the published measures, so no observation query was sent.";
const PDF_UNAVAILABLE =
  "No published measure can be included in the county report.";
const CASES_STAMP =
  "County 08001. Release alpha-2026. Periods 2023. Sources CDC surveillance.";
const EMPTY_STAMP = "County 08001. Release alpha-2026.";
const LOCAL_NOTE = "The clinic holds Tuesday office hours.";
const LOCAL_NOTE_TOO_LONG = `${LOCAL_NOTE} `.repeat(40);

const countyIdentity = resolveCountyIdentity(
  investigateGeographyFixture("08001")!,
  "08001"
);
const casesMeasure = investigateMeasuresFixture.find(
  (measure) => measure.measure_id === INVESTIGATE_CASES_MEASURE_ID
) as Measure;

const publishedRecord: PublishedCountyRecord = {
  burgdorferiStatus: "",
  evidenceCompleteness: 40,
  fips: "08001",
  methodologyVersion: null,
  pacificusStatus: null,
  population: null,
  releaseId: INVESTIGATE_RELEASE_ID,
  releaseLimitation: "",
  rucc: null,
  scapularisStatus: null,
  sources: [
    {
      key: "tick",
      label: "CDC ArboNET county tick status",
      note: "",
      url: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      vintage: "through 2025-12-31",
    },
  ],
  stateUnallocatedRecords: null,
  sviPercentile: null,
  tickStatus: "Established",
  uninsuredPercent: null,
};

type BundleKind =
  | "cases"
  | "cases-domains-failed"
  | "empty"
  | "failed"
  | "synthetic"
  | "unsupported";

type BriefRow = {
  bundle: BundleKind | null;
  catalogFailed: boolean;
  countyError: boolean;
  countyLoading: boolean;
  countyRecord: boolean;
  evidenceError: string | null;
  evidenceLoading: boolean;
  id: string;
  localContext: string;
  observationOutcome?: InvestigateQueryOutcome;
  recovery: InvestigateRecovery | null;
  expect: {
    ariaInvalid: string | null;
    blocker: string | null;
    finding: string | null;
    invalidAlert: string | null;
    limitation: string | null;
    pdf: "available" | "hidden" | "unavailable";
    stamp: string | null;
    state: string;
  };
};

function bundleFor(kind: BundleKind | null): CountyEvidenceBundle | null {
  if (kind === null) {
    return null;
  }
  if (kind === "empty" || kind === "synthetic") {
    return investigateBundleWithoutObservations({
      county: countyIdentity,
      releaseId: INVESTIGATE_RELEASE_ID,
    });
  }
  const [observation] = investigateObservationsFor({
    fips: "08001",
    measureId: INVESTIGATE_CASES_MEASURE_ID,
    scenario: "mixed",
  });
  if (!observation) {
    throw new Error("Reported-cases fixture is missing.");
  }
  const domainsRequestFailed = kind === "cases-domains-failed";
  const outcome =
    kind === "failed"
      ? {
          measureId: INVESTIGATE_CASES_MEASURE_ID,
          message: "This measure could not be loaded.",
          retryAtMs: null,
          status: "failed" as const,
        }
      : kind === "unsupported"
        ? {
            measureId: INVESTIGATE_CASES_MEASURE_ID,
            status: "unsupported_period" as const,
          }
        : {
            measureId: INVESTIGATE_CASES_MEASURE_ID,
            observations: [observation],
            status: "ready" as const,
          };
  return buildCountyEvidenceBundle({
    domainsRequestFailed,
    identity: countyIdentity,
    indicatorDomains: indicatorDomainsById(
      investigateIndicatorsFixture,
      INVESTIGATE_RELEASE_ID
    ),
    measures: [casesMeasure],
    outcomes: [outcome],
    releaseId: INVESTIGATE_RELEASE_ID,
  });
}

const readyCases = {
  ariaInvalid: null,
  blocker: null,
  finding: CASES_FINDING,
  invalidAlert: null,
  limitation: RETURNED_EMPTY_LIMITATION,
  pdf: "available" as const,
  stamp: CASES_STAMP,
  state: "ready",
};

const BRIEF_ROWS: BriefRow[] = [
  {
    bundle: null,
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: true,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_NOT_LOADED,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "observations_loading",
    },
    id: "observations-never-loaded",
    localContext: "",
    recovery: null,
  },
  {
    bundle: null,
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: "County evidence did not load for the requested county.",
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_OBSERVATIONS_FAILED,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "observations_failed",
    },
    id: "observations-failed-first-load",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "cases",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: OBSERVATION_REFRESH_FAILURE,
    evidenceLoading: false,
    expect: readyCases,
    id: "observations-refresh-failed-with-cache",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "cases",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: readyCases,
    id: "observations-loaded",
    localContext: "",
    recovery: null,
  },
  {
    bundle: null,
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_OBSERVATIONS_ABSENT,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "observations_absent",
    },
    id: "observations-settled-absent",
    localContext: "",
    observationOutcome: "settled-absent",
    recovery: null,
  },
  {
    bundle: "empty",
    catalogFailed: false,
    countyError: false,
    countyLoading: true,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding: COUNTY_RECORD_LOADING_FINDING,
      invalidAlert: null,
      limitation: COUNTY_RECORD_LOADING_LIMITATION,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "county-record-never-loaded",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "empty",
    catalogFailed: false,
    countyError: true,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding: COUNTY_RECORD_FINDING_FAILURE,
      invalidAlert: null,
      limitation: COUNTY_RECORD_LIMITATION_FAILURE,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "county-record-failed-first-load",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "empty",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding: RETURNED_EMPTY_FINDING,
      invalidAlert: null,
      limitation: RETURNED_EMPTY_LIMITATION,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "county-record-settled-absent",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "empty",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding: RETURNED_EMPTY_FINDING,
      invalidAlert: null,
      limitation: RETURNED_EMPTY_LIMITATION,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "county-record-refresh-failed-cached-absent",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "empty",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: true,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding:
        "Tick surveillance status: Established. Available. Period Unavailable. Source CDC ArboNET county tick status.",
      invalidAlert: null,
      limitation: RETURNED_EMPTY_LIMITATION,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "county-record-refresh-failed-cached-record",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "synthetic",
    catalogFailed: true,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_CATALOG_WITHHELD,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "catalog_withheld",
    },
    id: "catalog-failed-first-load",
    localContext: "",
    observationOutcome: "loaded",
    recovery: null,
  },
  {
    bundle: null,
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: true,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_NOT_LOADED,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "observations_loading",
    },
    id: "catalog-never-loaded",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "cases",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: readyCases,
    id: "catalog-refresh-failed-with-cache",
    localContext: "",
    recovery: null,
  },
  {
    bundle: null,
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: true,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_NOT_LOADED,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "observations_loading",
    },
    id: "indicators-never-loaded",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "cases-domains-failed",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: readyCases,
    id: "indicators-failed-first-load",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "cases",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: readyCases,
    id: "indicators-refresh-failed-with-cache",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "failed",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding: FAILED_FINDING,
      invalidAlert: null,
      limitation: FAILED_LIMITATION,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "export-withheld-when-measures-failed",
    localContext: "",
    recovery: null,
  },
  {
    bundle: "unsupported",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: null,
      finding: UNSUPPORTED_PERIOD,
      invalidAlert: null,
      limitation: UNSUPPORTED_PERIOD,
      pdf: "unavailable",
      stamp: EMPTY_STAMP,
      state: "ready",
    },
    id: "export-withheld-when-period-unsupported",
    localContext: "",
    recovery: null,
  },
  {
    bundle: null,
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ariaInvalid: null,
      blocker: EVIDENCE_BRIEF_UNRESOLVED,
      finding: null,
      invalidAlert: null,
      limitation: null,
      pdf: "hidden",
      stamp: null,
      state: "unresolved_county",
    },
    id: "recovery-missing-county",
    localContext: "",
    recovery: "missing",
  },
  {
    bundle: "cases",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ...readyCases,
      ariaInvalid: null,
    },
    id: "local-context-separated",
    localContext: LOCAL_NOTE,
    recovery: null,
  },
  {
    bundle: "cases",
    catalogFailed: false,
    countyError: false,
    countyLoading: false,
    countyRecord: false,
    evidenceError: null,
    evidenceLoading: false,
    expect: {
      ...readyCases,
      ariaInvalid: "true",
      invalidAlert: EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID,
    },
    id: "local-context-over-limit",
    localContext: LOCAL_NOTE_TOO_LONG,
    recovery: null,
  },
];

function renderedBrief(row: BriefRow) {
  const realBundle = bundleFor(row.bundle);
  const observationOutcome =
    row.observationOutcome ??
    evidenceBriefObservationOutcome({
      bundle: realBundle,
      evidenceError: row.evidenceError,
      evidenceLoading: row.evidenceLoading,
    });
  render(
    <ActionEvidenceBrief
      catalogFailed={row.catalogFailed}
      countyRecord={row.countyRecord ? publishedRecord : null}
      countyRecordError={
        row.countyError
          ? "The published county record could not be loaded. That is a request failure, not missing evidence."
          : null
      }
      countyRecordLoading={row.countyLoading}
      localContext={row.localContext}
      measures={[]}
      observationOutcome={observationOutcome}
      onLocalContextChange={() => {}}
      period="2023-01-01"
      realBundle={realBundle}
      recovery={row.recovery}
    />
  );
  const brief = screen.getByTestId("action-evidence-brief");
  const textarea = screen.queryByTestId("action-brief-local-context");
  const governed = screen.queryByTestId("action-brief-governed");
  const pdf = screen.queryByTestId("investigate-export-context");
  const text = brief.textContent ?? "";
  return {
    ariaInvalid: textarea?.getAttribute("aria-invalid") ?? null,
    blocker: screen.queryByTestId("action-brief-blocker")?.textContent ?? null,
    blockerRole:
      screen.queryByTestId("action-brief-blocker")?.getAttribute("role") ??
      null,
    finding: screen.queryByTestId("action-brief-finding")?.textContent ?? null,
    governedHasNote:
      row.localContext.length > 0 &&
      (governed?.textContent ?? "").includes(LOCAL_NOTE),
    id: row.id,
    invalidAlert:
      screen.queryByTestId("action-brief-local-error")?.textContent ?? null,
    limitation:
      screen.queryByTestId("action-brief-limitation")?.textContent ?? null,
    localNote: governed
      ? (screen.queryByTestId("action-brief-local-note")?.textContent ?? null)
      : null,
    localValue: textarea instanceof HTMLTextAreaElement ? textarea.value : null,
    pdf: pdf ? (pdf.dataset.exportState ?? "hidden") : "hidden",
    pdfHasNote: (pdf?.textContent ?? "").includes(LOCAL_NOTE),
    pdfSentence:
      pdf?.dataset.exportState === "unavailable"
        ? (screen
            .getByTestId("investigate-pdf-empty")
            .textContent?.includes(PDF_UNAVAILABLE) ?? false)
        : pdf?.dataset.exportState === "available"
          ? (screen
              .getByTestId("investigate-pdf-included")
              .textContent?.includes("Reported Lyme cases") ?? false)
          : null,
    requestFailureCopy:
      text.includes(INDICATOR_REQUEST_FAILURE) ||
      text.includes(INDICATOR_REFRESH_FAILURE) ||
      text.includes(CATALOG_REFRESH_FAILURE) ||
      text.includes(COUNTY_RECORD_REFRESH_FAILURE) ||
      text.includes(OBSERVATION_REFRESH_FAILURE),
    stamp: screen.queryByTestId("action-brief-stamp")?.textContent ?? null,
    state: brief.dataset.state ?? null,
  };
}

describe("Evidence brief rendered states", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses one sentence for every observation, county, catalog, indicator, and export state", () => {
    const rows = BRIEF_ROWS.map((row) => {
      const rendered = renderedBrief(row);
      cleanup();
      return rendered;
    });

    expect(rows).toStrictEqual(
      BRIEF_ROWS.map((row) => ({
        ariaInvalid: row.expect.ariaInvalid,
        blocker: row.expect.blocker,
        blockerRole: null,
        finding: row.expect.finding,
        governedHasNote: false,
        id: row.id,
        invalidAlert: row.expect.invalidAlert,
        limitation: row.expect.limitation,
        localNote:
          row.expect.state === "ready"
            ? EVIDENCE_BRIEF_LOCAL_CONTEXT_NOTE
            : null,
        localValue: row.expect.state === "ready" ? row.localContext : null,
        pdf: row.expect.pdf,
        pdfHasNote: false,
        pdfSentence: row.expect.pdf === "hidden" ? null : true,
        requestFailureCopy: false,
        stamp: row.expect.stamp,
        state: row.expect.state,
      }))
    );
  });

  it("keeps a typed local note out of the governed finding and the export", () => {
    const notes: string[] = [];
    render(
      <ActionEvidenceBrief
        catalogFailed={false}
        countyRecord={null}
        countyRecordError={null}
        countyRecordLoading={false}
        localContext=""
        measures={[]}
        observationOutcome="loaded"
        onLocalContextChange={(value) => {
          notes.push(value);
        }}
        period="2023-01-01"
        realBundle={bundleFor("cases")}
        recovery={null}
      />
    );
    fireEvent.change(screen.getByTestId("action-brief-local-context"), {
      target: { value: LOCAL_NOTE },
    });
    expect({
      alert: screen.queryByRole("alert"),
      ariaInvalid: screen
        .getByTestId("action-brief-local-context")
        .getAttribute("aria-invalid"),
      export: screen.getByTestId("investigate-export-context").textContent,
      finding: screen.getByTestId("action-brief-finding").textContent,
      governed: screen.getByTestId("action-brief-governed").dataset.governed,
      included: screen.getByTestId("investigate-pdf-included").textContent,
      local: screen.getByTestId("action-brief-local").dataset.governed,
      notes,
    }).toStrictEqual({
      alert: null,
      ariaInvalid: null,
      export: expect.not.stringContaining(LOCAL_NOTE),
      finding: CASES_FINDING,
      governed: "true",
      included: expect.stringContaining("Reported Lyme cases"),
      local: "false",
      notes: [LOCAL_NOTE],
    });
  });

  it("does not describe a cached refresh failure as a first load or an empty finding", () => {
    expect(
      evidenceBriefObservationOutcome({
        bundle: bundleFor("cases"),
        evidenceError: OBSERVATION_REFRESH_FAILURE,
        evidenceLoading: false,
      })
    ).toBe("refresh-failed");
    expect(
      evidenceBriefObservationOutcome({
        bundle: null,
        evidenceError: "County evidence did not load for the requested county.",
        evidenceLoading: false,
      })
    ).toBe("failed-first-load");
    expect(
      evidenceBriefObservationOutcome({
        bundle: null,
        evidenceError: null,
        evidenceLoading: true,
      })
    ).toBe("never-loaded");
    expect(
      evidenceBriefObservationOutcome({
        bundle: bundleFor("cases"),
        evidenceError: null,
        evidenceLoading: true,
      })
    ).toBe("loaded");
  });
});
