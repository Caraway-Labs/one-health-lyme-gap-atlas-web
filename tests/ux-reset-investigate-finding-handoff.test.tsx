import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { actionPlanPosture } from "@/features/ux-reset/action/action-context";
import { ResetActionExperience } from "@/features/ux-reset/action/reset-action-experience";
import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { InheritedContextNotice } from "@/features/ux-reset/ask-atlas/inherited-context-notice";
import {
  buildCountyEvidenceBundle,
  countyEvidenceLoadStates,
  investigateBundleWithoutObservations,
  resolveCountyIdentity,
  type CountyEvidenceBundle,
  type CountyEvidenceLoadState,
} from "@/features/ux-reset/investigate/county-evidence";
import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import { investigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigateNextSteps } from "@/features/ux-reset/investigate/investigate-next-steps";
import {
  publishedRowsForCounty,
  resolveInvestigateFinding,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import { indicatorDomainsById } from "@/features/ux-reset/investigate/load-county-evidence";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { InvestigateWorkspace } from "@/features/ux-reset/investigate/use-investigate-workspace";
import { buildReviewInvestigateHandoff } from "@/features/ux-reset/review/review-county-preview";
import type { Measure } from "@/generated/models";

import {
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_RELEASE_ID,
  investigateGeographyFixture,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const yearMeasures = investigateMeasuresFixture as Measure[];
const countyIdentity = resolveCountyIdentity(
  investigateGeographyFixture("08001")!,
  "08001"
);

const publishedRecord: PublishedCountyRecord = {
  burgdorferiStatus: "No records",
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

const FINDING_SCENARIOS = [
  "observation-only",
  "published-only",
  "both",
  "neither",
  "catalog-failed",
  "catalog-failed-published",
] as const;

type FindingScenario = (typeof FINDING_SCENARIOS)[number];

type FindingExpectation = {
  actionOffer: string | null;
  askPeriod: string | null;
  availability: string;
  catalogFailure: boolean;
  emptySentence: boolean;
  established: boolean;
  href: string | null;
  measure: string | null;
  observedCases: boolean;
  pdfOffered: boolean;
  source: string | null;
};

let activeWorkspace: InvestigateWorkspace;

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/action",
  useSearchParams: () =>
    new URLSearchParams("county=08001&scope=CO") as ReadonlyURLSearchParams,
}));

vi.mock(
  import("@/features/ux-reset/investigate/use-investigate-workspace"),
  () => ({
    useInvestigateWorkspace: () => activeWorkspace,
  })
);

function observationBundle(): CountyEvidenceBundle {
  const [observation] = investigateObservationsFor({
    fips: "08001",
    measureId: INVESTIGATE_CASES_MEASURE_ID,
    scenario: "mixed",
  });
  if (!observation) {
    throw new Error("Reported-cases fixture is missing.");
  }
  return buildCountyEvidenceBundle({
    domainsRequestFailed: false,
    identity: countyIdentity,
    indicatorDomains: indicatorDomainsById(
      investigateIndicatorsFixture,
      INVESTIGATE_RELEASE_ID
    ),
    measures: yearMeasures,
    outcomes: yearMeasures.map((measure) => ({
      measureId: measure.measure_id,
      observations:
        measure.measure_id === INVESTIGATE_CASES_MEASURE_ID
          ? [observation]
          : [],
      status: "ready" as const,
    })),
    releaseId: INVESTIGATE_RELEASE_ID,
  });
}

function emptyBundle(): CountyEvidenceBundle {
  return investigateBundleWithoutObservations({
    county: countyIdentity,
    releaseId: INVESTIGATE_RELEASE_ID,
  });
}

function observedFindingExpectation(): FindingExpectation {
  return {
    actionOffer: "Suggested follow-up",
    askPeriod: "2023",
    availability: "available",
    catalogFailure: false,
    emptySentence: false,
    established: false,
    href: "#investigate-observation-obs-cases-08001",
    measure: "Reported Lyme cases",
    observedCases: true,
    pdfOffered: true,
    source: "cdc-cases",
  };
}

function catalogFailedScenario(scenario: FindingScenario): boolean {
  switch (scenario) {
    case "catalog-failed": {
      return true;
    }
    case "catalog-failed-published": {
      return true;
    }
    case "observation-only": {
      return false;
    }
    case "published-only": {
      return false;
    }
    case "both": {
      return false;
    }
    case "neither": {
      return false;
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

function observationsLoadedFor(
  scenario: FindingScenario
): CountyEvidenceLoadState {
  return catalogFailedScenario(scenario)
    ? countyEvidenceLoadStates.withheld
    : countyEvidenceLoadStates.loaded;
}

function expectationFor(scenario: FindingScenario): FindingExpectation {
  switch (scenario) {
    case "observation-only": {
      return observedFindingExpectation();
    }
    case "both": {
      return observedFindingExpectation();
    }
    case "published-only": {
      return {
        actionOffer: "Suggested follow-up",
        askPeriod: null,
        availability: "available",
        catalogFailure: false,
        emptySentence: false,
        established: true,
        href: "#investigate-published-tick_status",
        measure: "Tick surveillance status",
        observedCases: false,
        pdfOffered: true,
        source: "tick",
      };
    }
    case "neither": {
      return {
        actionOffer: "Suggested follow-up",
        askPeriod: null,
        availability: "",
        catalogFailure: false,
        emptySentence: true,
        established: false,
        href: null,
        measure: null,
        observedCases: false,
        pdfOffered: true,
        source: null,
      };
    }
    case "catalog-failed": {
      return {
        actionOffer: null,
        askPeriod: null,
        availability: "",
        catalogFailure: true,
        emptySentence: false,
        established: false,
        href: null,
        measure: null,
        observedCases: false,
        pdfOffered: false,
        source: null,
      };
    }
    case "catalog-failed-published": {
      return {
        actionOffer: null,
        askPeriod: null,
        availability: "available",
        catalogFailure: false,
        emptySentence: false,
        established: true,
        href: "#investigate-published-tick_status",
        measure: null,
        observedCases: false,
        pdfOffered: false,
        source: null,
      };
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

function scenarioBundle(
  scenario: FindingScenario
): CountyEvidenceBundle | null {
  switch (scenario) {
    case "observation-only": {
      return observationBundle();
    }
    case "both": {
      return observationBundle();
    }
    case "published-only": {
      return emptyBundle();
    }
    case "neither": {
      return emptyBundle();
    }
    case "catalog-failed": {
      return null;
    }
    case "catalog-failed-published": {
      return null;
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

function scenarioRecord(
  scenario: FindingScenario
): PublishedCountyRecord | null {
  switch (scenario) {
    case "published-only": {
      return publishedRecord;
    }
    case "both": {
      return publishedRecord;
    }
    case "observation-only": {
      return null;
    }
    case "neither": {
      return null;
    }
    case "catalog-failed": {
      return null;
    }
    case "catalog-failed-published": {
      return publishedRecord;
    }
    default: {
      const exhaustive: never = scenario;
      return exhaustive;
    }
  }
}

function workspaceFor(
  scenario: FindingScenario,
  bundle: CountyEvidenceBundle | null
): InvestigateWorkspace {
  const countyRecord = scenarioRecord(scenario);
  return {
    bundle,
    catalogError: catalogFailedScenario(scenario)
      ? "Governed measures could not be loaded."
      : null,
    catalogRefreshError: null,
    compare: [],
    countyRecord,
    countyRecordAbsent: countyRecord === null,
    countyRecordError: null,
    countyRecordLoading: false,
    countyRecordRefreshError: null,
    directory: [],
    directoryError: null,
    directoryLoading: false,
    directoryRefreshError: null,
    evidenceError: null,
    evidenceFetching: false,
    evidenceLoading: false,
    observationOutcome: bundle ? "loaded" : "never-loaded",
    identity: countyIdentity,
    indicatorError: null,
    indicatorRefreshError: null,
    measures: [],
    metadata: null,
    metadataError: null,
    metadataLoading: false,
    metadataRefreshError: null,
    period: "2023-01-01",
    recovery: null,
    releaseId: INVESTIGATE_RELEASE_ID,
    requestedDataset: INVESTIGATE_RELEASE_ID,
    requestedFips: "08001",
    retryDirectory: () => {},
    retryEvidence: () => {},
    scope: "CO",
    scopeLabel: "Colorado",
    selection: { kind: "county", fips: "08001" },
    setCounty: () => {},
    stateLabel: "Colorado",
  };
}

function inheritedField(field: string): {
  id: string | null;
  label: string | null;
} {
  const root = screen.queryByTestId("ask-atlas-inherited-context");
  const node = root?.querySelector(`[data-field="${field}"]`);
  if (
    !(node instanceof HTMLElement) ||
    node.dataset.fieldState !== "validated"
  ) {
    return { id: null, label: null };
  }
  return {
    id: node.dataset.fieldId ?? null,
    label: node.querySelector("dd")?.textContent ?? null,
  };
}

function PublishedActionContext() {
  const context = useAskAtlasInheritedContext();
  return <InheritedContextNotice context={context} />;
}

function handoffCarriesFinding(text: string): string | null {
  const review = buildReviewInvestigateHandoff({
    period: "2023-01-01",
    releaseId: INVESTIGATE_RELEASE_ID,
    scopeCode: "CO",
    searchParams: new URLSearchParams("county=08001&scope=CO"),
    selectedFips: "08001",
  });
  const returnHref =
    screen.getByTestId("action-return").getAttribute("href") ?? "";
  const reviewParams = new URLSearchParams(review.href.split("?")[1] ?? "");
  const actionParams = new URLSearchParams(returnHref.split("?")[1] ?? "");
  const posture = actionPlanPosture(["evidence-brief"]);
  const brief = posture.kind === "unsupported" ? posture.plan : posture.kind;
  const carried =
    review.href.includes(text) ||
    reviewParams.has("finding") ||
    returnHref.includes(text) ||
    actionParams.has("finding") ||
    brief.includes(text);
  return carried ? text : null;
}

function pdfCarriesFinding(
  bundle: CountyEvidenceBundle | null,
  text: string
): string | null {
  if (!bundle) {
    return null;
  }
  const pdf = investigatePdfContext(bundle, "2023-01-01");
  return JSON.stringify(pdf).includes(text) ? text : null;
}

describe("Investigate finding handoff", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps one finding and availability on every downstream surface", () => {
    const rows = FINDING_SCENARIOS.map((scenario) => {
      const bundle = scenarioBundle(scenario);
      const countyRecord = scenarioRecord(scenario);
      const catalogFailed = catalogFailedScenario(scenario);
      const observationsLoaded = observationsLoadedFor(scenario);
      render(
        <InvestigateEvidenceHierarchy
          bundle={bundle ?? emptyBundle()}
          catalogFailed={catalogFailed}
          countyRecord={countyRecord}
        />
      );
      const investigate = screen.getByTestId("investigate-finding");
      const investigateText =
        screen.getByTestId("investigate-finding-text").textContent ?? "";
      const investigateLimitation =
        screen.getByTestId("investigate-limitation-text").textContent ?? "";
      const hierarchyHref =
        screen
          .queryByRole("link", { name: "Inspect this finding" })
          ?.getAttribute("href") ?? null;
      cleanup();

      const carriedBundle = bundle ?? emptyBundle();
      const carriedFinding = resolveInvestigateFinding({
        bundle: carriedBundle,
        catalogFailed,
        countyRecordPresent: countyRecord !== null,
        publishedRows: publishedRowsForCounty({
          bundle: carriedBundle,
          countyRecord,
          measures: [],
        }),
      });
      render(
        <InvestigateNextSteps
          actionHref="/app/action?county=08001"
          bundle={catalogFailed ? emptyBundle() : bundle}
          compare={[]}
          compareHref="/app/compare"
          countyFips="08001"
          finding={carriedFinding}
          findingCountyLabel={countyIdentity.label}
          observationsLoaded={observationsLoaded}
          requestedPeriod="2023-01-01"
          resolvedCounty="08001"
        />
      );
      const actionOffer =
        screen.queryByTestId("investigate-action")?.textContent ?? null;
      const pdfOffered =
        screen.queryByTestId("investigate-export-context") !== null;
      const nextHref =
        screen
          .queryByTestId("investigate-next-finding")
          ?.getAttribute("href") ?? null;
      cleanup();

      activeWorkspace = workspaceFor(scenario, bundle);
      render(
        <NuqsTestingAdapter hasMemory searchParams="county=08001&scope=CO">
          <AskAtlasInheritedContextProvider>
            <ResetActionExperience />
            <PublishedActionContext />
          </AskAtlasInheritedContextProvider>
        </NuqsTestingAdapter>
      );
      const action = screen.getByTestId("action-evidence");
      const actionText =
        screen.getByTestId("action-finding-text").textContent ?? "";
      const actionLimitation =
        screen.getByTestId("action-limitation-text").textContent ?? "";
      const askMeasure = inheritedField("measure").label;
      const askPeriod = inheritedField("period").label;
      const askSource = inheritedField("source").id;
      const row = {
        actionAvailability: action.dataset.evidenceState ?? null,
        actionLimitation,
        actionOffer,
        actionText,
        askMeasure,
        askPeriod,
        askSource,
        pdfOffered,
        availability: investigate.dataset.evidenceState ?? null,
        catalogFailure: investigateText.includes(
          "measure catalog could not be loaded"
        ),
        emptySentence: investigateText.includes(
          "No observed or limited finding was returned"
        ),
        established: investigateText.includes("Established"),
        handoffFinding: handoffCarriesFinding(investigateText),
        href: hierarchyHref,
        investigateLimitation,
        investigateText,
        nextHref,
        observedCases: investigateText.includes("12 cases"),
        pdfFinding: pdfCarriesFinding(bundle, investigateText),
        sameLimitation: investigateLimitation === actionLimitation,
        sameText: investigateText === actionText,
        scenario,
      };
      cleanup();
      return row;
    });

    expect(rows).toStrictEqual(
      FINDING_SCENARIOS.map((scenario) => {
        const expected = expectationFor(scenario);
        const matched = rows.find((row) => row.scenario === scenario);
        const investigateText = matched?.investigateText;
        return {
          actionAvailability: expected.availability,
          actionLimitation: matched?.investigateLimitation,
          actionOffer: expected.actionOffer,
          actionText: investigateText,
          askMeasure: expected.measure,
          askPeriod: expected.askPeriod,
          askSource: expected.source,
          pdfOffered: expected.pdfOffered,
          availability: expected.availability,
          catalogFailure: expected.catalogFailure,
          emptySentence: expected.emptySentence,
          established: expected.established,
          handoffFinding: null,
          href: expected.href,
          investigateLimitation: matched?.investigateLimitation,
          investigateText,
          nextHref: expected.href,
          observedCases: expected.observedCases,
          pdfFinding: null,
          sameLimitation: true,
          sameText: true,
          scenario,
        };
      })
    );
  });
});
