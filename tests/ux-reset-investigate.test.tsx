import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearObservationRetryDeadlines } from "@/features/ux-reset/investigate/load-county-evidence";
import { ResetInvestigateExperience } from "@/features/ux-reset/investigate/reset-investigate-experience";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  INVESTIGATE_CASES_LIMITATION,
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_RELEASE_ID,
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
  holdMetadata: boolean;
  metadataReleaseId: string | null;
  metadataStatus: number;
  rateLimitRemaining: number;
  retryAfterSeconds: number;
  scenario: InvestigateScenario;
  transientStatus: number;
} = {
  delayFips: null,
  failMeasureId: null,
  geographyStatus: "ok",
  holdMetadata: false,
  metadataReleaseId: null,
  metadataStatus: 200,
  rateLimitRemaining: 0,
  retryAfterSeconds: 0,
  scenario: "mixed",
  transientStatus: 429,
};

let metadataGate = Promise.withResolvers<boolean>();
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
        if (controls.rateLimitRemaining > 0) {
          controls.rateLimitRemaining -= 1;
          throw new AtlasApiError(
            "rate limited",
            "/v1/observations",
            controls.transientStatus,
            null,
            controls.retryAfterSeconds
          );
        }
        if (controls.retryAfterSeconds === 0) {
          throw new AtlasApiError(
            "observations failed",
            "/v1/observations",
            500,
            null
          );
        }
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

function returnHrefs() {
  return {
    header: screen.getByTestId("investigate-return").getAttribute("href"),
  };
}

function setSearch(search: string) {
  navigationSearchParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
}

function renderInvestigate(
  search: string,
  options: { client?: QueryClient } = {}
) {
  setSearch(search);
  const client =
    options.client ??
    new QueryClient({
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

function caseRequestCount(fips = "08001"): number {
  return observationRequests.filter(
    (request) =>
      request.includes(INVESTIGATE_CASES_MEASURE_ID) && request.includes(fips)
  ).length;
}

function tickRequestCount(): number {
  return observationRequests.filter((request) =>
    request.includes(INVESTIGATE_TICK_MEASURE_ID)
  ).length;
}

async function waitForRetryableCases() {
  await waitFor(() => {
    const evidence =
      screen.queryByTestId("investigate-evidence")?.textContent ?? "";
    if (
      !evidence.includes("12 cases") ||
      !screen.queryByTestId("investigate-retry-evidence")
    ) {
      throw new Error("Cached cases and the retry action have not rendered.");
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
    continueHref:
      screen.queryByTestId("investigate-continue")?.getAttribute("href") ?? "",
    nextCounty: screen.getByTestId("investigate-next-steps").dataset.county,
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
    controls.holdMetadata = false;
    controls.metadataReleaseId = null;
    controls.metadataStatus = 200;
    controls.rateLimitRemaining = 0;
    controls.retryAfterSeconds = 0;
    controls.transientStatus = 429;
    clearObservationRetryDeadlines();
    metadataGate.resolve(true);
    metadataGate = Promise.withResolvers<boolean>();
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
      action: snapshot.continueHref.includes("/app/action"),
      continueHref: snapshot.continueHref,
      county: snapshot.county,
      hasCurrentValue: snapshot.evidence.includes("40 cases"),
      hasStaleValue: snapshot.evidence.includes("12 cases"),
      heading: snapshot.heading,
      nextCounty: snapshot.nextCounty,
    }).toStrictEqual({
      action: false,
      continueHref: "",
      county: "08013",
      hasCurrentValue: true,
      hasStaleValue: false,
      heading: "Boulder",
      nextCounty: "08013",
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

  it("keeps cached successes after remount, another county, and another release", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 300_000 } },
    });
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    controls.scenario = "mixed";
    const first = renderInvestigate("?county=08001&scope=CO", { client });
    await waitForRetryableCases();
    const casesAfterLoad = caseRequestCount();
    first.unmount();

    const returned = renderInvestigate("?county=08001&scope=CO", { client });
    await waitForRetryableCases();
    const casesAfterRemount = caseRequestCount();
    await returned.rerenderSearch("?county=08013&scope=CO");
    await waitFor(() => {
      if (screen.getByTestId("investigate-header").dataset.county !== "08013") {
        throw new Error("Boulder has not rendered.");
      }
    });
    await returned.rerenderSearch("?county=08001&scope=CO");
    await waitForRetryableCases();
    const casesAfterCountyReturn = caseRequestCount();

    controls.metadataReleaseId = "beta-2026";
    await returned.rerenderSearch("?county=08001&scope=CO&dataset=beta-2026");
    await waitFor(() => {
      const evidence =
        screen.queryByTestId("investigate-evidence")?.textContent ?? "";
      if (
        evidence.includes("12 cases") ||
        screen.getByTestId("investigate-header").dataset.release !== "beta-2026"
      ) {
        throw new Error("The other release is still showing Denver cases.");
      }
    });

    controls.metadataReleaseId = null;
    controls.failMeasureId = INVESTIGATE_CASES_MEASURE_ID;
    await returned.rerenderSearch("?county=08001&scope=CO");
    await waitForRetryableCases();
    const casesBeforeRetry = caseRequestCount();
    fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
    await waitFor(() => {
      const evidence =
        screen.queryByTestId("investigate-evidence")?.textContent ?? "";
      if (!evidence.includes("4 detections")) {
        throw new Error("The retried tick observation has not loaded.");
      }
    });
    const evidence =
      screen.queryByTestId("investigate-evidence")?.textContent ?? "";
    expect({
      caseRequests: caseRequestCount(),
      cases: evidence.includes("12 cases"),
      casesAfterCountyReturn,
      casesAfterRemount,
      county: screen.getByTestId("investigate-header").dataset.county,
      otherReleaseCases: evidence.includes("40 cases"),
    }).toStrictEqual({
      caseRequests: casesBeforeRetry,
      cases: true,
      casesAfterCountyReturn: casesAfterLoad,
      casesAfterRemount: casesAfterLoad,
      county: "08001",
      otherReleaseCases: false,
    });
  });

  it("does not keep the previous period when that request is a different identity", async () => {
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    controls.scenario = "mixed";
    const view = renderInvestigate("?county=08001&scope=CO");
    await waitForRetryableCases();
    controls.failMeasureId = INVESTIGATE_CASES_MEASURE_ID;
    await view.rerenderSearch("?county=08001&scope=CO&period=2024-06-01");
    await waitFor(() => {
      const evidence =
        screen.queryByTestId("investigate-evidence")?.textContent ?? "";
      if (evidence.includes("12 cases") || !evidence.includes("4 detections")) {
        throw new Error("The new period is still showing the previous cases.");
      }
    });
    expect(screen.getByTestId("investigate-header").dataset.county).toBe(
      "08001"
    );
  });

  it("ignores a second retry click during Retry-After", async () => {
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    controls.scenario = "mixed";
    renderInvestigate("?county=08001&scope=CO");
    await waitForRetryableCases();
    const ticksBefore = tickRequestCount();
    controls.rateLimitRemaining = 1;
    controls.retryAfterSeconds = 60;
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
        await vi.advanceTimersByTimeAsync(0);
      });
      const retrying = screen.getByTestId("investigate-retry-evidence");
      const duringCooldown = {
        disabled: retrying.hasAttribute("disabled"),
        requests: tickRequestCount(),
        retrying: retrying.dataset.retrying,
      };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(58_000);
      });
      const beforePermittedRetry = tickRequestCount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect({
        beforePermittedRetry,
        disabled: duringCooldown.disabled,
        duringCooldown: duringCooldown.requests,
        retrying: duringCooldown.retrying,
        settledTicks: tickRequestCount(),
      }).toStrictEqual({
        beforePermittedRetry: ticksBefore + 1,
        disabled: true,
        duringCooldown: ticksBefore + 1,
        retrying: "true",
        settledTicks: ticksBefore + 2,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits out Retry-After after automatic attempts are exhausted", async () => {
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    controls.scenario = "mixed";
    renderInvestigate("?county=08001&scope=CO");
    await waitForRetryableCases();
    const ticksBefore = tickRequestCount();
    controls.rateLimitRemaining = 3;
    controls.retryAfterSeconds = 60;
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
        await vi.advanceTimersByTimeAsync(0);
      });
      const atFirst = tickRequestCount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
        await vi.advanceTimersToNextTimerAsync();
      });
      const afterExhausted = tickRequestCount();
      const settled = screen.getByTestId("investigate-retry-evidence");
      if (settled.hasAttribute("disabled")) {
        throw new Error("Retry stayed busy after automatic attempts finished.");
      }
      await act(async () => {
        fireEvent.click(settled);
        await vi.advanceTimersByTimeAsync(1000);
      });
      const duringCooldown = screen.getByTestId("investigate-retry-evidence");
      const manualAt121 = tickRequestCount();
      const retrying = duringCooldown.dataset.retrying;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(59_000);
      });
      expect({
        afterExhausted,
        atFirst,
        manualAt121,
        manualAtDeadline: tickRequestCount(),
        retrying,
      }).toStrictEqual({
        afterExhausted: ticksBefore + 3,
        atFirst: ticksBefore + 1,
        manualAt121: ticksBefore + 3,
        manualAtDeadline: ticksBefore + 4,
        retrying: "true",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  async function remountDuringServerCooldown(status: number) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 300_000 } },
    });
    controls.failMeasureId = INVESTIGATE_TICK_MEASURE_ID;
    controls.scenario = "mixed";
    controls.transientStatus = status;
    const first = renderInvestigate("?county=08001&scope=CO", { client });
    await waitForRetryableCases();
    const ticksBefore = tickRequestCount();
    controls.rateLimitRemaining = 4;
    controls.retryAfterSeconds = 60;
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
        await vi.advanceTimersByTimeAsync(0);
      });
      const atLimited = tickRequestCount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      first.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      renderInvestigate("?county=08001&scope=CO", { client });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const evidence =
        screen.queryByTestId("investigate-evidence")?.textContent ?? "";
      if (
        !evidence.includes("12 cases") ||
        !screen.queryByTestId("investigate-retry-evidence")
      ) {
        throw new Error("The cached county did not remount.");
      }
      const cases = true;
      const afterRemount = tickRequestCount();
      await act(async () => {
        fireEvent.click(screen.getByTestId("investigate-retry-evidence"));
        await vi.advanceTimersByTimeAsync(58_000);
      });
      const whileCooling = tickRequestCount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      return {
        cases,
        sentAtDeadline: tickRequestCount() === afterRemount + 1,
        sentDuringCooldown: whileCooling > afterRemount,
        stayedCached:
          afterRemount === atLimited && atLimited === ticksBefore + 1,
      };
    } finally {
      vi.useRealTimers();
    }
  }

  it("waits for a 429 Retry-After that arrived before remount", async () => {
    const result = await remountDuringServerCooldown(429);
    expect(result).toStrictEqual({
      cases: true,
      sentAtDeadline: true,
      sentDuringCooldown: false,
      stayedCached: true,
    });
  });

  it("waits for a 503 Retry-After that arrived before remount", async () => {
    const result = await remountDuringServerCooldown(503);
    expect(result).toStrictEqual({
      cases: true,
      sentAtDeadline: true,
      sentDuringCooldown: false,
      stayedCached: true,
    });
  });

  it("keeps the requested dataset on return links until the release resolves", async () => {
    const requested =
      "/app/review?scope=CO&county=08013&dataset=beta-2026&period=2023-01-01";
    controls.holdMetadata = true;
    renderInvestigate(
      "?county=08013&scope=CO&dataset=beta-2026&period=2023-01-01"
    );
    await waitFor(() => {
      const href =
        screen.getByTestId("investigate-return").getAttribute("href") ?? "";
      if (!href.includes("dataset=beta-2026")) {
        throw new Error("The pending return link dropped the dataset.");
      }
    });
    const pending = returnHrefs();
    metadataGate.resolve(true);
    cleanup();

    controls.holdMetadata = false;
    controls.metadataStatus = 503;
    renderInvestigate(
      "?county=08013&scope=CO&dataset=beta-2026&period=2023-01-01"
    );
    await waitFor(() => {
      const href =
        screen.getByTestId("investigate-return").getAttribute("href") ?? "";
      if (
        !href.includes("dataset=beta-2026") ||
        document.querySelectorAll('[data-atlas-status="error"]').length === 0
      ) {
        throw new Error("Metadata failure has not kept the dataset.");
      }
    });
    const unavailable = returnHrefs();
    cleanup();

    controls.metadataStatus = 200;
    renderInvestigate(
      "?county=08013&scope=CO&dataset=beta-2026&period=2023-01-01"
    );
    await waitFor(() => {
      if (
        screen.queryByTestId("investigate-recovery")?.dataset.recovery !==
        "release_mismatch"
      ) {
        throw new Error("Release mismatch has not rendered.");
      }
    });
    expect({
      mismatch: returnHrefs(),
      pending,
      unavailable,
    }).toStrictEqual({
      mismatch: { header: requested },
      pending: { header: requested },
      unavailable: { header: requested },
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
    const unavailable =
      screen.getByTestId("investigate-pdf-unavailable").textContent ?? "";
    expect({
      action: screen.queryByRole("link", { name: "Continue to Action" }),
      continuePath: screen.queryByTestId("investigate-continue"),
      emptyFamily: screen.getByTestId("investigate-family-vector_pathogen")
        .textContent,
      exportButton: screen.queryByTestId("investigate-export"),
      limitation: screen.getByTestId("investigate-limitation-text").textContent,
      returnCounty: (
        screen.getByTestId("investigate-return").getAttribute("href") ?? ""
      ).includes("county=08001"),
      unavailableCases: unavailable.includes(INVESTIGATE_CASES_LIMITATION),
      unavailableTicks: unavailable.includes(INVESTIGATE_TICK_LIMITATION),
    }).toStrictEqual({
      action: null,
      continuePath: null,
      emptyFamily: expect.stringContaining(
        "No governed observations were returned"
      ),
      exportButton: null,
      limitation: expect.stringContaining(INVESTIGATE_CASES_LIMITATION),
      returnCounty: true,
      unavailableCases: true,
      unavailableTicks: false,
    });
  });

  it("withholds Action and the county PDF for available and limited evidence", async () => {
    const search =
      "?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01";
    const view = renderInvestigate(search);
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
    const context = screen.getByTestId("investigate-export-context");
    const unavailable =
      screen.getByTestId("investigate-pdf-unavailable").textContent ?? "";
    const evidenceText =
      screen.getByTestId("investigate-evidence").textContent ?? "";
    expect({
      action: screen.queryByRole("link", { name: "Continue to Action" }),
      caveats: context.dataset.caveats,
      continuePath: screen.queryByTestId("investigate-continue"),
      county: context.dataset.county,
      evidenceCases: evidenceText.includes("CDC surveillance"),
      evidenceCover: evidenceText.includes("National land cover"),
      evidenceTicks: evidenceText.includes(INVESTIGATE_TICK_LIMITATION),
      exportButton: screen.queryByRole("button", { name: "Export PDF" }),
      exportState: context.dataset.exportState,
      observationPeriods: context.dataset.observationPeriods,
      period: context.dataset.period,
      reasonPeriod: unavailable.includes("2023-01-01"),
      reasonSource: unavailable.includes("Tick survey"),
      release: context.dataset.release,
      returnReview: (
        screen.getByTestId("investigate-return").getAttribute("href") ?? ""
      ).includes("/app/review"),
      sources: context.dataset.sources,
    }).toStrictEqual({
      action: null,
      caveats: INVESTIGATE_TICK_LIMITATION,
      continuePath: null,
      county: "08001",
      evidenceCases: true,
      evidenceCover: true,
      evidenceTicks: true,
      exportButton: null,
      exportState: "unavailable",
      observationPeriods: "2023",
      period: "2023-01-01",
      reasonPeriod: true,
      reasonSource: true,
      release: INVESTIGATE_RELEASE_ID,
      returnReview: true,
      sources: "CDC surveillance\nTick survey\nNational land cover",
    });

    view.unmount();
    renderInvestigate(search);
    await waitFor(() => {
      if (
        screen.getByTestId("investigate-export-context").dataset.period !==
          "2023-01-01" ||
        !screen
          .getByTestId("investigate-pdf-unavailable")
          .textContent?.includes(INVESTIGATE_TICK_LIMITATION)
      ) {
        throw new Error("Reloaded page dropped the unavailable PDF context.");
      }
    });
  });

  it("returns to Compare only when a two-county set is already in the link", async () => {
    renderInvestigate("?county=08001&scope=CO&compare=08001,08013");
    await waitForCounty("08001");
    await waitFor(() => {
      if (
        screen.getByTestId("investigate-export-context").dataset.county !==
          "08001" ||
        screen.queryByRole("link", { name: "Continue to Action" })
      ) {
        throw new Error("Compare return path has not rendered.");
      }
    });
    const link = screen.getByTestId("investigate-continue");
    const href = link.getAttribute("href") ?? "";
    expect({
      county: screen.getByTestId("investigate-export-context").dataset.county,
      destination: link.dataset.destination,
      hrefCompare: href.includes("/app/compare"),
      hrefCounty: href.includes("county=08001"),
      hrefPair: href.includes("compare=08001%2C08013"),
      hrefReturn: href.includes("return=investigate"),
      note: screen.queryByTestId("investigate-continue-note"),
      paths: screen.getAllByTestId("investigate-continue").length,
    }).toStrictEqual({
      county: "08001",
      destination: "compare",
      hrefCompare: true,
      hrefCounty: true,
      hrefPair: true,
      hrefReturn: true,
      note: null,
      paths: 1,
    });
  });

  it("opens Compare for one county and does not choose a neighbor", async () => {
    renderInvestigate(
      "?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    await waitForCounty("08001");
    const link = await screen.findByTestId("investigate-compare");
    const href = link.getAttribute("href") ?? "";
    const url = new URL(href, "http://localhost");
    expect({
      compare: url.searchParams.get("compare"),
      county: url.searchParams.get("county"),
      label: link.textContent,
      path: url.pathname,
      period: url.searchParams.get("period"),
      returnTo: url.searchParams.get("return"),
      scope: url.searchParams.get("scope"),
    }).toStrictEqual({
      compare: "08001",
      county: "08001",
      label: "Compare",
      path: "/app/compare",
      period: "2023-01-01",
      returnTo: "investigate",
      scope: "CO",
    });
    expect(screen.queryByTestId("investigate-continue")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Continue to Action" })
    ).toBeNull();
  });

  it("hides Action, Compare, and export until a county bundle or compare pair exists", async () => {
    renderInvestigate("?scope=CO");
    await waitFor(() => {
      if (
        screen.queryByTestId("investigate-recovery")?.dataset.recovery !==
        "missing"
      ) {
        throw new Error("Missing-county recovery has not rendered.");
      }
    });
    expect(screen.queryByTestId("investigate-continue")).toBeNull();
    expect(screen.queryByTestId("investigate-export-context")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Continue to Action" })
    ).toBeNull();
  });

  it("does not request a county report for the visible period and caveat", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderInvestigate(
      "?county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01"
    );
    await waitFor(() => {
      const reason = screen.queryByTestId(
        "investigate-pdf-unavailable"
      )?.textContent;
      if (
        !reason?.includes("2023-01-01") ||
        !reason.includes(INVESTIGATE_TICK_LIMITATION)
      ) {
        throw new Error("Unavailable PDF explanation has not rendered.");
      }
    });
    const reportCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/report.pdf")
    );
    expect({
      exportButton: screen.queryByRole("button", { name: "Export PDF" }),
      reportCalls: reportCalls.length,
      state: screen.getByTestId("investigate-export-context").dataset
        .exportState,
    }).toStrictEqual({
      exportButton: null,
      reportCalls: 0,
      state: "unavailable",
    });
    fetchMock.mockRestore();
  });
});
