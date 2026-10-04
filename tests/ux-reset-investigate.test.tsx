import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetInvestigateExperience } from "@/features/ux-reset/investigate/reset-investigate-experience";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_TICK_LIMITATION,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateGeographyFixture,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateMetadataFixture,
  investigateObservationsFor,
  investigateScoresFixture,
  type InvestigateScenario,
} from "./fixtures/investigate-api-fixtures";

const controls: {
  delayFips: string | null;
  failMeasureId: string | null;
  geographyStatus: "identity" | "ok";
  scenario: InvestigateScenario;
} = {
  delayFips: null,
  failMeasureId: null,
  geographyStatus: "ok",
  scenario: "mixed",
};

let releaseDelayed = () => {};
let delayedObservations: Promise<void> = Promise.resolve();
let delayedCompletions = 0;
let navigationSearchParams = new URLSearchParams("county=08001&scope=CO");
const observationRequests: string[] = [];

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/investigate",
  useSearchParams: () => navigationSearchParams as ReadonlyURLSearchParams,
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    geographyV1GeographiesGeographyTypeGeographyIdGet: vi.fn<
      typeof import("@/generated/atlas").geographyV1GeographiesGeographyTypeGeographyIdGet
    >(async (_type, geographyId) => {
      if (!/^\d{5}$/.test(geographyId)) {
        return {
          data: { detail: "invalid geography" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      const geography = investigateGeographyFixture(geographyId);
      if (!geography) {
        return {
          data: { detail: "not found" },
          headers: new Headers(),
          status: 404,
        } as never;
      }
      const body =
        controls.geographyStatus === "identity" && geographyId === "08001"
          ? {
              ...geography,
              geography: {
                geography_id: "08013",
                geography_type: "county" as const,
              },
              label: "Boulder County",
            }
          : geography;
      return {
        data: { data: body },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
    indicatorsV1IndicatorsGet: vi.fn<
      typeof import("@/generated/atlas").indicatorsV1IndicatorsGet
    >(async (params) => {
      if (params?.page_token === null) {
        return {
          data: { detail: "invalid indicators request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      return {
        data: {
          data: investigateIndicatorsFixture,
          links: { self: "/v1/indicators" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
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
    >(
      async () =>
        ({
          data: investigateMetadataFixture,
          headers: new Headers(),
          status: 200,
        }) as never
    ),
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      observationRequests.push(JSON.stringify(params));
      const hasYear = typeof params.year === "number";
      const hasRange = Boolean(params.start_date && params.end_date);
      if (
        params.page_token === null ||
        params.geography_type !== "county" ||
        hasYear === hasRange ||
        params.geography_id.some((fips) => !/^\d{5}$/.test(fips))
      ) {
        return {
          data: { detail: "invalid observation request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      const fips = params.geography_id[0] ?? "";
      if (fips === controls.delayFips) {
        await delayedObservations;
        delayedCompletions += 1;
      }
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
          data: investigateObservationsFor({
            fips,
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

function renderInvestigate(search: string) {
  setSearch(search);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory searchParams={search}>
        <ResetInvestigateExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return {
    ...view,
    async rerenderSearch(next: string) {
      setSearch(next);
      view.rerender(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter hasMemory searchParams={next}>
            <ResetInvestigateExperience />
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    },
  };
}

async function waitForCounty(fips: string) {
  await waitFor(() => {
    if (screen.getByTestId("investigate-header").dataset.county !== fips) {
      throw new Error(`Waiting for county ${fips}.`);
    }
  });
}

function pageSnapshot() {
  const environmental = screen.queryByTestId(
    "investigate-family-environmental_population"
  );
  const returnLink = screen.queryByTestId("investigate-return");
  return {
    askAtlas: screen.getByTestId("investigate-workspace").dataset.askAtlas,
    county: screen.getByTestId("investigate-header").dataset.county,
    environmental: environmental?.textContent ?? "",
    evidence: screen.queryByTestId("investigate-evidence")?.textContent ?? "",
    finding:
      screen.queryByTestId("investigate-finding-text")?.textContent ?? "",
    heading: screen.getByRole("heading", { level: 1 }).textContent,
    limitation:
      screen.queryByTestId("investigate-limitation-text")?.textContent ?? "",
    nextCounty: screen.getByTestId("investigate-next-steps").dataset.county,
    nextReturn:
      screen.queryByTestId("investigate-next-return")?.getAttribute("href") ??
      "",
    recovery: screen.queryByTestId("investigate-recovery")?.dataset.recovery,
    returnHref: returnLink?.getAttribute("href") ?? "",
  };
}

describe("County Investigate workspace", () => {
  afterEach(() => {
    cleanup();
    controls.delayFips = null;
    controls.failMeasureId = null;
    controls.geographyStatus = "ok";
    controls.scenario = "mixed";
    delayedCompletions = 0;
    delayedObservations = Promise.resolve();
    observationRequests.length = 0;
  });

  it("shows one finding, one limitation, and a review return path from a direct link", async () => {
    renderInvestigate("?county=08001&scope=CO");
    await waitForCounty("08001");
    await waitFor(() => {
      if (
        !screen
          .queryByTestId("investigate-finding-text")
          ?.textContent?.includes("12 cases")
      ) {
        throw new Error("Finding has not loaded.");
      }
    });
    const snapshot = pageSnapshot();
    expect({
      askAtlas: snapshot.askAtlas,
      assistantLink: Boolean(
        screen
          .getByTestId("investigate-next-steps")
          .querySelector('a[href*="assistant"]')
      ),
      county: snapshot.county,
      finding: snapshot.finding.includes("12 cases"),
      heading: snapshot.heading,
      limitation: snapshot.limitation.includes(INVESTIGATE_TICK_LIMITATION),
      otherCountyRequested: observationRequests.some((request) =>
        request.includes("08013")
      ),
      returnCounty: snapshot.returnHref.includes("county=08001"),
      returnReview: snapshot.returnHref.includes("/app/review"),
      returnScope: snapshot.returnHref.includes("scope=CO"),
      unavailable: snapshot.environmental.includes("Unavailable"),
      zero: snapshot.environmental.includes("0 percent"),
    }).toStrictEqual({
      askAtlas: "optional",
      assistantLink: false,
      county: "08001",
      finding: true,
      heading: "Denver",
      limitation: true,
      otherCountyRequested: false,
      returnCounty: true,
      returnReview: true,
      returnScope: true,
      unavailable: true,
      zero: false,
    });
  });

  it("keeps the current county when an earlier county response arrives late", async () => {
    controls.delayFips = "08001";
    const deferred = Promise.withResolvers<boolean>();
    delayedObservations = deferred.promise.then(() => {});
    releaseDelayed = () => {
      deferred.resolve(true);
    };
    const view = renderInvestigate("?county=08001&scope=CO");
    await waitForCounty("08001");
    await waitFor(() => {
      if (!observationRequests.some((request) => request.includes("08001"))) {
        throw new Error("Denver observations have not started.");
      }
    });
    const delayedStarts = observationRequests.filter((request) =>
      request.includes("08001")
    ).length;
    await view.rerenderSearch("?county=08013&scope=CO");
    await waitFor(() => {
      if (
        !screen
          .queryByTestId("investigate-finding-text")
          ?.textContent?.includes("40 cases")
      ) {
        throw new Error("Boulder finding has not loaded.");
      }
    });
    releaseDelayed();
    await waitFor(() => {
      if (delayedCompletions < delayedStarts) {
        throw new Error("The delayed Denver response has not settled.");
      }
    });
    const snapshot = pageSnapshot();
    expect({
      county: snapshot.county,
      hasCurrentValue: snapshot.evidence.includes("40 cases"),
      hasStaleValue: snapshot.evidence.includes("12 cases"),
      heading: snapshot.heading,
      nextCounty: snapshot.nextCounty,
      nextReturn: snapshot.nextReturn.includes("county=08013"),
    }).toStrictEqual({
      county: "08013",
      hasCurrentValue: true,
      hasStaleValue: false,
      heading: "Boulder",
      nextCounty: "08013",
      nextReturn: true,
    });
  });

  it("keeps loaded observations when a later retry only reloads failures", async () => {
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    controls.scenario = "mixed";
    renderInvestigate("?county=08001&scope=CO");
    await waitFor(() => {
      if (
        !screen
          .queryByTestId("investigate-finding-text")
          ?.textContent?.includes("12 cases") ||
        !screen.queryByTestId("investigate-retry-evidence")
      ) {
        throw new Error("The successful cases observation has not loaded.");
      }
    });
    const caseRequests = observationRequests.filter((request) =>
      request.includes(INVESTIGATE_CASES_MEASURE_ID)
    ).length;
    controls.failMeasureId = INVESTIGATE_CASES_MEASURE_ID;
    fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
    await waitFor(() => {
      if (
        !screen
          .queryByTestId("investigate-family-vector_pathogen")
          ?.textContent?.includes("4 detections")
      ) {
        throw new Error("The retried tick observation has not loaded.");
      }
    });
    const snapshot = pageSnapshot();
    expect({
      caseRequests: observationRequests.filter((request) =>
        request.includes(INVESTIGATE_CASES_MEASURE_ID)
      ).length,
      cases: snapshot.evidence.includes("12 cases"),
      county: snapshot.county,
      ticks: snapshot.evidence.includes("4 detections"),
    }).toStrictEqual({
      caseRequests,
      cases: true,
      county: "08001",
      ticks: true,
    });
  });

  it("uses an explicit recovery state for malformed, unknown, and unsupported counties", async () => {
    const { geographyV1GeographiesGeographyTypeGeographyIdGet } =
      await import("@/generated/atlas");
    const geography = vi.mocked(
      geographyV1GeographiesGeographyTypeGeographyIdGet
    );
    const geographyCallsBefore = geography.mock.calls.length;
    renderInvestigate("?county=12&scope=CO");
    await waitFor(() => {
      if (
        screen.queryByTestId("investigate-recovery")?.dataset.recovery !==
        "malformed"
      ) {
        throw new Error("Malformed recovery has not rendered.");
      }
    });
    const malformed = pageSnapshot();
    cleanup();
    renderInvestigate("?county=99999&scope=CO");
    await waitFor(() => {
      if (
        screen.queryByTestId("investigate-recovery")?.dataset.recovery !==
        "unsupported"
      ) {
        throw new Error("Unknown county recovery has not rendered.");
      }
    });
    const unknown = pageSnapshot();
    cleanup();
    renderInvestigate("?county=08014&scope=CO");
    await waitFor(() => {
      if (
        screen.queryByTestId("investigate-recovery")?.dataset.recovery !==
        "unsupported"
      ) {
        throw new Error("Unsupported recovery has not rendered.");
      }
    });
    const unsupported = pageSnapshot();
    expect({
      geographyCalls: geography.mock.calls.length - geographyCallsBefore,
      malformedHeading: malformed.heading,
      malformedRecovery: malformed.recovery,
      unknownEvidence: unknown.evidence,
      unknownHeading: unknown.heading,
      unknownRecovery: unknown.recovery,
      unsupportedEvidence: unsupported.evidence,
      unsupportedHeading: unsupported.heading,
      unsupportedObservations: observationRequests.some((request) =>
        request.includes("08014")
      ),
      unsupportedRecovery: unsupported.recovery,
    }).toStrictEqual({
      geographyCalls: 0,
      malformedHeading: "Choose a county",
      malformedRecovery: "malformed",
      unknownEvidence: "",
      unknownHeading: "99999",
      unknownRecovery: "unsupported",
      unsupportedEvidence: "",
      unsupportedHeading: "08014",
      unsupportedObservations: false,
      unsupportedRecovery: "unsupported",
    });
  });

  it("shows a retry when the published county list fails", async () => {
    const { scoresV1AtlasScoresGet } = await import("@/generated/atlas");
    vi.mocked(scoresV1AtlasScoresGet).mockResolvedValueOnce({
      data: { detail: "unavailable" },
      headers: new Headers(),
      status: 503,
    } as never);
    renderInvestigate("?county=08001&scope=CO");
    await waitFor(() => {
      if (
        screen.queryByTestId("investigate-recovery")?.dataset.recovery !==
        "directory"
      ) {
        throw new Error("Directory recovery has not rendered.");
      }
    });
    expect(screen.queryByTestId("investigate-evidence")).toBeNull();
    expect(screen.getByTestId("investigate-retry-directory")).toBeTruthy();
  });

  it("keeps loaded evidence when another measure fails", async () => {
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    renderInvestigate("?county=08001&scope=CO");
    await waitFor(() =>
      expect(
        screen.getByTestId("investigate-finding-text").textContent
      ).toContain("12 cases")
    );
    const failure = screen.getByTestId("investigate-partial-failure");
    expect(failure.textContent).toContain("Tick pathogen detections");
    expect(failure.textContent).toContain("not marked unavailable");
    expect(
      screen.getByTestId("investigate-family-vector_pathogen").dataset
        .publication
    ).toBe("request_failed");
    expect(
      screen.getByTestId("investigate-family-environmental_population")
        .textContent
    ).toContain("Unavailable");
  });

  it("shows a sparse county without inventing the other families' values", async () => {
    controls.scenario = "sparse";
    renderInvestigate("?county=08001&scope=CO");
    await waitFor(() =>
      expect(
        screen.getByTestId("investigate-finding-text").textContent
      ).toContain("7 cases")
    );
    expect(
      screen.getByTestId("investigate-limitation-text").textContent
    ).toContain("Case reports do not include every clinical encounter.");
    expect(
      screen.getByTestId("investigate-family-vector_pathogen").textContent
    ).toContain("No governed observations were returned");
    expect(
      screen.getByTestId("investigate-return").getAttribute("href")
    ).toContain("county=08001");
  });
});
