import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetActionExperience } from "@/features/ux-reset/action/reset-action-experience";
import { clearObservationRetryDeadlines } from "@/features/ux-reset/investigate/load-county-evidence";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  INVESTIGATE_CASES_LIMITATION,
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

const controls: {
  emptyObservations: boolean;
  failMeasureId: string | null;
  holdMetadata: boolean;
  metadataReleaseId: string | null;
  metadataStatus: number;
  scenario: InvestigateScenario;
} = {
  emptyObservations: false,
  failMeasureId: null,
  holdMetadata: false,
  metadataReleaseId: null,
  metadataStatus: 200,
  scenario: "mixed",
};

let metadataGate = Promise.withResolvers<boolean>();
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
      if (params?.page_token === null || params?.geography_type === "county") {
        return {
          data: { detail: "invalid catalog request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      return {
        data: {
          data: investigateMeasuresFixture.filter(
            (measure) => measure.geography_semantics === params?.geography_type
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
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      if (params.measure_id === controls.failMeasureId) {
        throw new AtlasApiError(
          "observations failed",
          "/v1/observations",
          500,
          null
        );
      }
      return {
        data: {
          data: controls.emptyObservations
            ? []
            : investigateObservationsFor({
                fips: params.geography_id[0] ?? "",
                measureId: params.measure_id,
                scenario: controls.scenario,
              }),
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
          data: investigateScoresFixture,
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

function renderAction(search: string) {
  setSearch(search);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory searchParams={search}>
        <ResetActionExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

async function waitForEvidence(county: string) {
  await waitFor(() => {
    if (screen.getByTestId("action-evidence").dataset.county !== county) {
      throw new Error(`Waiting for county ${county}.`);
    }
  });
}

describe("Action evidence handoff", () => {
  afterEach(() => {
    cleanup();
    controls.emptyObservations = false;
    controls.failMeasureId = null;
    controls.holdMetadata = false;
    controls.metadataReleaseId = null;
    controls.metadataStatus = 200;
    controls.scenario = "mixed";
    clearObservationRetryDeadlines();
    metadataGate.resolve(true);
    metadataGate = Promise.withResolvers<boolean>();
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
    renderAction("?county=08001&scope=CO");
    await waitForEvidence("08001");
    const finding = screen.getByTestId("action-finding-text").textContent ?? "";
    expect({
      evidenceState:
        screen.getByTestId("action-evidence").dataset.evidenceState,
      finding,
      zero: finding.includes("0"),
    }).toStrictEqual({
      evidenceState: "",
      finding: "No observed or limited finding was returned for this county.",
      zero: false,
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
});
