import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetActionExperience } from "@/features/ux-reset/action/reset-action-experience";
import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { InheritedContextNotice } from "@/features/ux-reset/ask-atlas/inherited-context-notice";
import { clearObservationRetryDeadlines } from "@/features/ux-reset/investigate/load-county-evidence";
import { ValueState } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  INVESTIGATE_CASES_LIMITATION,
  INVESTIGATE_CONTEXT_MEASURE_ID,
  INVESTIGATE_RELEASE_ID,
  INVESTIGATE_TICK_LIMITATION,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateMetadataFixture,
  investigateObservationsFor,
  investigateScoresFixture,
  type InvestigateScenario,
} from "./fixtures/investigate-api-fixtures";

const washingtonTemplate = investigateScoresFixture.counties[0];
const actionScoresFixture = {
  ...investigateScoresFixture,
  counties: [
    ...investigateScoresFixture.counties,
    {
      ...washingtonTemplate,
      county: "Washington",
      fips: "44009",
      state: "RI",
      state_name: "Rhode Island",
    },
    {
      ...washingtonTemplate,
      county: "Washington",
      fips: "27163",
      state: "MN",
      state_name: "Minnesota",
    },
  ],
};

const controls: {
  canopyValueState: (typeof ValueState)[keyof typeof ValueState] | null;
  emptyObservations: boolean;
  failAllMeasures: boolean;
  failMeasureId: string | null;
  failMeasures: boolean;
  holdMetadata: boolean;
  holdObservations: boolean;
  metadataReleaseId: string | null;
  metadataStatus: number;
  scenario: InvestigateScenario;
  unavailableOnly: boolean;
  unsupportedPeriod: boolean;
} = {
  canopyValueState: null,
  emptyObservations: false,
  failAllMeasures: false,
  failMeasureId: null,
  failMeasures: false,
  holdMetadata: false,
  holdObservations: false,
  metadataReleaseId: null,
  metadataStatus: 200,
  scenario: "mixed",
  unavailableOnly: false,
  unsupportedPeriod: false,
};

let metadataGate = Promise.withResolvers<boolean>();
let observationGate = Promise.withResolvers<boolean>();
let navigationSearchParams = new URLSearchParams("county=08001&scope=CO");

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/action",
  useSearchParams: () => navigationSearchParams as ReadonlyURLSearchParams,
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    indicatorsV1IndicatorsGet: vi.fn<
      typeof import("@/generated/atlas").indicatorsV1IndicatorsGet
    >(
      async () =>
        ({
          data: {
            data: investigateIndicatorsFixture,
            links: { self: "/v1/indicators" },
            meta: {},
          },
          headers: new Headers(),
          status: 200,
        }) as never
    ),
    measuresV1MeasuresGet: vi.fn<
      typeof import("@/generated/atlas").measuresV1MeasuresGet
    >(async (params) => {
      if (controls.failMeasures) {
        return {
          data: { detail: "measures unavailable" },
          headers: new Headers(),
          status: 503,
        } as never;
      }
      if (params?.page_token === null || params?.geography_type === "county") {
        return {
          data: { detail: "invalid catalog request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      return {
        data: {
          data: investigateMeasuresFixture
            .filter(
              (measure) =>
                measure.geography_semantics === params?.geography_type
            )
            .map((measure) =>
              controls.unsupportedPeriod
                ? { ...measure, temporal_semantics: "seasonal" }
                : measure
            ),
          links: { self: "/v1/measures" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    metadataV1AtlasMetadataGet: vi.fn<
      typeof import("@/generated/atlas").metadataV1AtlasMetadataGet
    >(async () => {
      if (controls.holdMetadata) {
        await metadataGate.promise;
      }
      if (controls.metadataStatus !== 200) {
        return {
          data: { detail: "metadata unavailable" },
          headers: new Headers(),
          status: controls.metadataStatus,
        } as never;
      }
      return {
        data: {
          ...investigateMetadataFixture,
          release_id:
            controls.metadataReleaseId ?? investigateMetadataFixture.release_id,
          states: [
            ...investigateMetadataFixture.states,
            { code: "RI", name: "Rhode Island" },
            { code: "MN", name: "Minnesota" },
          ],
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      if (controls.holdObservations) {
        await observationGate.promise;
      }
      if (controls.failAllMeasures) {
        return {
          data: { detail: "observations unavailable" },
          headers: new Headers(),
          status: 503,
        } as never;
      }
      if (params.measure_id === controls.failMeasureId) {
        throw new AtlasApiError(
          "observations failed",
          "/v1/observations",
          500,
          null
        );
      }
      const withhold =
        controls.emptyObservations ||
        (controls.unavailableOnly &&
          params.measure_id !== INVESTIGATE_CONTEXT_MEASURE_ID);
      const rows = withhold
        ? []
        : investigateObservationsFor({
            fips: params.geography_id[0] ?? "",
            measureId: params.measure_id,
            scenario: controls.scenario,
          });
      const canopyState = controls.canopyValueState;
      return {
        data: {
          data:
            canopyState && params.measure_id === INVESTIGATE_CONTEXT_MEASURE_ID
              ? rows.map((row) => ({
                  ...row,
                  limitations: [],
                  value_state: canopyState,
                }))
              : rows,
          links: { self: "/v1/observations" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    scoresV1AtlasScoresGet: vi.fn<
      typeof import("@/generated/atlas").scoresV1AtlasScoresGet
    >(
      async () =>
        ({
          data: actionScoresFixture,
          headers: new Headers(),
          status: 200,
        }) as never
    ),
  };
});

function setSearch(search: string) {
  navigationSearchParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
}

function PublishedActionContext() {
  const context = useAskAtlasInheritedContext();
  return <InheritedContextNotice context={context} />;
}

function inheritedFieldValue(
  root: HTMLElement,
  field: string,
  attribute: "fieldId" | "fieldState"
): string | null {
  const node = root.querySelector(`[data-field="${field}"]`);
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  return node.dataset[attribute] ?? null;
}

function renderAction(
  search: string,
  options?: { client?: QueryClient; showContext?: boolean }
) {
  setSearch(search);
  const client =
    options?.client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  const experience = options?.showContext ? (
    <AskAtlasInheritedContextProvider>
      <ResetActionExperience />
      <PublishedActionContext />
    </AskAtlasInheritedContextProvider>
  ) : (
    <ResetActionExperience />
  );
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory searchParams={search}>
        {experience}
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

async function waitForEvidence(county: string, timeout = 1000) {
  await waitFor(
    () => {
      if (screen.getByTestId("action-evidence").dataset.county !== county) {
        throw new Error(`Waiting for county ${county}.`);
      }
    },
    { timeout }
  );
}

describe("Action evidence handoff", () => {
  afterEach(() => {
    cleanup();
    controls.canopyValueState = null;
    controls.emptyObservations = false;
    controls.failAllMeasures = false;
    controls.failMeasureId = null;
    controls.failMeasures = false;
    controls.holdMetadata = false;
    controls.holdObservations = false;
    controls.metadataReleaseId = null;
    controls.metadataStatus = 200;
    controls.scenario = "mixed";
    controls.unavailableOnly = false;
    controls.unsupportedPeriod = false;
    clearObservationRetryDeadlines();
    metadataGate.resolve(true);
    metadataGate = Promise.withResolvers<boolean>();
    observationGate.resolve(true);
    observationGate = Promise.withResolvers<boolean>();
  });

  it("repeats the Investigate summary and returns to that county", async () => {
    renderAction(
      "?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01&compare=08001,08013"
    );
    await waitForEvidence("08001");
    const evidence = screen.getByTestId("action-evidence");
    const finding = screen.getByTestId("action-finding-text").textContent ?? "";
    const limitation =
      screen.getByTestId("action-limitation-text").textContent ?? "";
    const returnHref =
      screen.getByTestId("action-return").getAttribute("href") ?? "";
    expect({
      availability: finding.includes("Available"),
      cases: finding.includes("12 cases"),
      evidenceState: evidence.dataset.evidenceState,
      heading: screen.getByRole("heading", { level: 1 }).textContent,
      limitation: limitation.includes(INVESTIGATE_TICK_LIMITATION),
      period: finding.includes("Period 2023"),
      periodState: evidence.dataset.periodState,
      release: evidence.dataset.release,
      returnCompare: returnHref.includes("compare=08001%2C08013"),
      returnCounty: returnHref.includes("county=08001"),
      returnPath: returnHref.includes("/app/investigate"),
      returnPeriod: returnHref.includes("period=2023-01-01"),
      returnPlan: returnHref.includes("plan="),
      surveillanceLink: screen.queryByRole("link", {
        name: /Surveillance Planning/,
      }),
      workflowButton: screen.queryByRole("button", {
        name: /Surveillance Planning|Evidence Brief/,
      }),
    }).toStrictEqual({
      availability: true,
      cases: true,
      evidenceState: "available",
      heading: "Denver",
      limitation: true,
      period: true,
      periodState: "matched",
      release: INVESTIGATE_RELEASE_ID,
      returnCompare: true,
      returnCounty: true,
      returnPath: true,
      returnPeriod: true,
      returnPlan: false,
      surveillanceLink: null,
      workflowButton: null,
    });
    expect(screen.getByTestId("action-surveillance").textContent).toContain(
      "not available"
    );
  });

  it("keeps the evidence period when the link period is stale", async () => {
    renderAction("?county=08001&scope=CO&period=1999-01-01");
    await waitForEvidence("08001");
    const evidence = screen.getByTestId("action-evidence");
    const finding = screen.getByTestId("action-finding-text").textContent ?? "";
    expect({
      findingPeriod: finding.includes("Period 2023"),
      requestedYear: finding.includes("1999"),
      stale: evidence.dataset.periodState,
      staleCopy: screen.getByTestId("action-stale-period").textContent,
    }).toStrictEqual({
      findingPeriod: true,
      requestedYear: false,
      stale: "stale",
      staleCopy: expect.stringContaining("2023"),
    });
  });

  it("keeps limited evidence distinct from a missing county", async () => {
    controls.scenario = "sparse";
    renderAction("?county=08001&scope=CO");
    await waitForEvidence("08001");
    const finding = screen.getByTestId("action-finding-text").textContent ?? "";
    const limitation =
      screen.getByTestId("action-limitation-text").textContent ?? "";
    expect({
      evidenceState:
        screen.getByTestId("action-evidence").dataset.evidenceState,
      finding: finding.includes("7 cases"),
      limitation: limitation.includes(INVESTIGATE_CASES_LIMITATION),
      limited: finding.includes("Limited"),
    }).toStrictEqual({
      evidenceState: "limited",
      finding: true,
      limitation: true,
      limited: true,
    });
  });

  it("shows an empty bundle without turning it into unavailable evidence", async () => {
    controls.emptyObservations = true;
    renderAction("?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01");
    await waitForEvidence("08001");
    const evidence = screen.getByTestId("action-evidence");
    const finding = screen.getByTestId("action-finding-text").textContent ?? "";
    expect({
      evidenceObject: screen.queryByTestId("ux-reset-evidence-object"),
      evidenceState: evidence.dataset.evidenceState,
      finding,
      periodState: evidence.dataset.periodState,
      stale: screen.queryByTestId("action-stale-period"),
      zero: finding.includes("0"),
    }).toStrictEqual({
      evidenceObject: null,
      evidenceState: "",
      finding: "No observed or limited finding was returned for this county.",
      periodState: "unspecified",
      stale: null,
      zero: false,
    });
  });

  it("keeps a governed unavailable observation when no finding or caveat exists", async () => {
    const valueStates = [
      ValueState.UNAVAILABLE,
      ValueState.MISSING,
      ValueState.NO_COUNTY_LINKED_RECORD,
    ] as const;
    for (const valueState of valueStates) {
      cleanup();
      controls.unavailableOnly = true;
      controls.canopyValueState = valueState;
      renderAction(
        "?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
      );
      await waitForEvidence("08001");
      const evidence = screen.getByTestId("action-evidence");
      const object = screen.getByTestId("ux-reset-evidence-object");
      const display =
        screen.getByTestId("evidence-display-value").textContent ?? "";
      expect({
        display,
        evidenceState: evidence.dataset.evidenceState,
        objects: screen.getAllByTestId("ux-reset-evidence-object").length,
        period: object.textContent?.includes("2023"),
        periodState: evidence.dataset.periodState,
        source: object.textContent?.includes("National land cover"),
        stale: screen.queryByTestId("action-stale-period"),
        valueState,
        zeroPercent: object.textContent?.includes("0 percent"),
      }).toStrictEqual({
        display: "Unavailable",
        evidenceState: "unavailable",
        objects: 1,
        period: true,
        periodState: "matched",
        source: true,
        stale: null,
        valueState,
        zeroPercent: false,
      });
    }
  });

  it("does not call an empty, failed, or unsupported period stale", async () => {
    controls.failAllMeasures = true;
    renderAction("?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01");
    await waitForEvidence("08001", 4000);
    const failed = screen.getByTestId("action-evidence");
    expect({
      evidenceObject: screen.queryByTestId("ux-reset-evidence-object"),
      evidenceState: failed.dataset.evidenceState,
      finding: screen.getByTestId("action-finding-text").textContent,
      periodState: failed.dataset.periodState,
      stale: screen.queryByTestId("action-stale-period"),
    }).toStrictEqual({
      evidenceObject: null,
      evidenceState: "",
      finding:
        "County evidence could not be loaded. That is a request failure, not a statement that no finding was published.",
      periodState: "unspecified",
      stale: null,
    });
    cleanup();

    controls.failAllMeasures = false;
    controls.unsupportedPeriod = true;
    renderAction("?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01");
    await waitForEvidence("08001");
    const unsupported = screen.getByTestId("action-evidence");
    expect({
      evidenceObject: screen.queryByTestId("ux-reset-evidence-object"),
      evidenceState: unsupported.dataset.evidenceState,
      finding: screen.getByTestId("action-finding-text").textContent,
      periodState: unsupported.dataset.periodState,
      stale: screen.queryByTestId("action-stale-period"),
    }).toStrictEqual({
      evidenceObject: null,
      evidenceState: "",
      finding:
        "The selected period is not a supported bound for the published measures, so no observation query was sent.",
      periodState: "unspecified",
      stale: null,
    });
  });

  it("reports missing, malformed, and unpublished counties without a workflow", async () => {
    renderAction("?scope=CO");
    await waitFor(() => {
      if (
        screen.getByTestId("action-recovery").dataset.recovery !== "missing"
      ) {
        throw new Error("Missing recovery has not rendered.");
      }
    });
    expect(screen.queryByTestId("action-evidence")).toBeNull();
    cleanup();

    renderAction("?county=12&scope=CO");
    await waitFor(() => {
      if (
        screen.getByTestId("action-recovery").dataset.recovery !== "malformed"
      ) {
        throw new Error("Malformed recovery has not rendered.");
      }
    });
    expect(screen.queryByTestId("action-evidence")).toBeNull();
    cleanup();

    renderAction("?county=08014&scope=CO");
    await waitFor(() => {
      if (
        screen.getByTestId("action-recovery").dataset.recovery !== "unsupported"
      ) {
        throw new Error("Unsupported recovery has not rendered.");
      }
    });
    expect(
      screen.queryByRole("link", { name: "Surveillance Planning" })
    ).toBeNull();
  });

  it("keeps a release mismatch and a metadata error off the evidence summary", async () => {
    controls.metadataReleaseId = "other-release";
    renderAction("?county=08001&dataset=alpha-2026");
    await waitFor(() => {
      if (
        screen.getByTestId("action-recovery").dataset.recovery !==
        "release_mismatch"
      ) {
        throw new Error("Release mismatch has not rendered.");
      }
    });
    expect(screen.queryByTestId("action-evidence")).toBeNull();
    cleanup();

    controls.metadataReleaseId = null;
    controls.metadataStatus = 503;
    renderAction("?county=08001&dataset=alpha-2026");
    await waitFor(() => {
      const alerts = screen
        .getAllByRole("alert")
        .map((alert) => alert.textContent ?? "")
        .join(" ");
      if (!alerts.includes("alpha-2026")) {
        throw new Error("Metadata error has not rendered.");
      }
    });
    expect(screen.queryByTestId("action-evidence")).toBeNull();
    expect(screen.queryByText("Unavailable")).toBeNull();
  });

  it("shows loading before metadata and keeps a failed measure as an error", async () => {
    controls.holdMetadata = true;
    renderAction("?county=08001&scope=CO");
    expect(
      screen
        .getAllByRole("status")
        .some((status) => status.textContent?.includes("Loading"))
    ).toBeTruthy();
    expect(screen.queryByTestId("action-evidence")).toBeNull();
    metadataGate.resolve(true);
    await waitForEvidence("08001");
    cleanup();

    controls.holdMetadata = false;
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    renderAction("?county=08001&scope=CO");
    await waitForEvidence("08001");
    const finding = screen.getByTestId("action-finding-text").textContent ?? "";
    expect({
      alert: screen.getByTestId("action-partial-failure").textContent,
      cases: finding.includes("12 cases"),
      unavailableFinding: finding.includes("Unavailable"),
    }).toStrictEqual({
      alert: expect.stringContaining("not marked unavailable"),
      cases: true,
      unavailableFinding: false,
    });
  });

  it("names an unsupported plan without opening it", async () => {
    renderAction("?county=08001&scope=CO&plan=brief");
    await waitForEvidence("08001");
    expect(screen.getByTestId("action-workflows").dataset.plan).toBe(
      "unsupported"
    );
    expect(screen.getByTestId("action-unsupported-plan").textContent).toContain(
      "brief"
    );
    expect(screen.queryByRole("link", { name: /brief/i })).toBeNull();
    expect(screen.getByTestId("action-surveillance").textContent).toContain(
      "not available"
    );
  });

  it("names each Washington county by its own state and FIPS", async () => {
    renderAction("?county=44009&scope=CO&dataset=alpha-2026");
    await screen.findByText("FIPS 44009 · Rhode Island (RI).");
    const rhodeIsland = screen.getByTestId("action-header").textContent ?? "";
    cleanup();
    renderAction("?county=27163&scope=CO&dataset=alpha-2026");
    await screen.findByText("FIPS 27163 · Minnesota (MN).");
    const minnesota = screen.getByTestId("action-header").textContent ?? "";
    expect({
      minnesotaColorado: minnesota.includes("Colorado"),
      minnesotaHeading: screen.getByRole("heading", { level: 1 }).textContent,
      minnesotaRhodeIsland: minnesota.includes("Rhode Island"),
      rhodeIslandColorado: rhodeIsland.includes("Colorado"),
      rhodeIslandHeading: rhodeIsland.includes("Washington"),
      rhodeIslandMinnesota: rhodeIsland.includes("Minnesota"),
    }).toStrictEqual({
      minnesotaColorado: false,
      minnesotaHeading: "Washington",
      minnesotaRhodeIsland: false,
      rhodeIslandColorado: false,
      rhodeIslandHeading: true,
      rhodeIslandMinnesota: false,
    });
  });

  it("drops the previous county state and FIPS when the next county is unresolved", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = renderAction("?county=44009&scope=CO&dataset=alpha-2026", {
      client,
      showContext: true,
    });
    await screen.findByText("FIPS 44009 · Rhode Island (RI).");
    first.unmount();
    renderAction("?county=99999&scope=CO&dataset=alpha-2026", {
      client,
      showContext: true,
    });
    await waitFor(() => {
      if (
        screen.getByTestId("action-recovery").dataset.recovery !== "unsupported"
      ) {
        throw new Error("Unresolved county has not rendered.");
      }
    });
    const header = screen.getByTestId("action-header").textContent ?? "";
    const context = screen.getByTestId("ask-atlas-inherited-context");
    expect({
      geography: inheritedFieldValue(context, "geography", "fieldState"),
      identity: screen.queryByTestId("action-county-identity"),
      minnesota: header.includes("Minnesota"),
      previousFips: header.includes("44009"),
      rhodeIsland: header.includes("Rhode Island"),
      washington: header.includes("Washington"),
    }).toStrictEqual({
      geography: "absent",
      identity: null,
      minnesota: false,
      previousFips: false,
      rhodeIsland: false,
      washington: false,
    });
  });

  it("keeps geography and release in Ask Atlas context before a bundle exists", async () => {
    controls.holdObservations = true;
    renderAction("?county=08001&scope=CO&dataset=alpha-2026", {
      showContext: true,
    });
    await screen.findByText("FIPS 08001 · Colorado (CO).");
    await screen.findByText("Loading county evidence…");
    const loadingContext = screen.getByTestId("ask-atlas-inherited-context");
    expect({
      evidence: screen.queryByTestId("action-evidence"),
      geography: inheritedFieldValue(loadingContext, "geography", "fieldId"),
      none: screen.queryByTestId("ask-atlas-no-context"),
      release: inheritedFieldValue(loadingContext, "release", "fieldId"),
    }).toStrictEqual({
      evidence: null,
      geography: "08001",
      none: null,
      release: INVESTIGATE_RELEASE_ID,
    });
    cleanup();
    controls.holdObservations = false;
    controls.failMeasures = true;
    renderAction("?county=08001&scope=CO&dataset=alpha-2026", {
      showContext: true,
    });
    await screen.findByText("Governed measures could not be loaded.");
    const failedContext = screen.getByTestId("ask-atlas-inherited-context");
    expect({
      evidence: screen.queryByTestId("action-evidence"),
      geography: inheritedFieldValue(failedContext, "geography", "fieldId"),
      identity: screen.getByTestId("action-county-identity").textContent,
      none: screen.queryByTestId("ask-atlas-no-context"),
      release: inheritedFieldValue(failedContext, "release", "fieldId"),
    }).toStrictEqual({
      evidence: null,
      geography: "08001",
      identity: "FIPS 08001 · Colorado (CO).",
      none: null,
      release: INVESTIGATE_RELEASE_ID,
    });
  });
});
