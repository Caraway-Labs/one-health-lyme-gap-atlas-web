import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearCompareCatalogRetryDeadlines } from "@/features/ux-reset/compare/compare-catalog-cooldown";
import { compareObservationRequestRejection } from "@/features/ux-reset/compare/load-compare-evidence";
import { ResetCompareExperience } from "@/features/ux-reset/compare/reset-compare-experience";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

import {
  COMPARE_CANOPY_MEASURE_ID,
  COMPARE_CASES_MEASURE_ID,
  COMPARE_TICK_MEASURE_ID,
  COMPARE_WASHINGTON_MN,
  COMPARE_WASHINGTON_RI,
  compareMeasuresFixture,
  compareObservationsFor,
  compareScoresFixture,
} from "./fixtures/compare-api-fixtures";
import { investigateMetadataFixture } from "./fixtures/investigate-api-fixtures";

const observationRequests: string[] = [];
const catalogRequests: string[] = [];
const observationFailureBudgets = new Map<string, number>();
let catalogFailureStatus = 503;
let catalogFailuresRemaining = 0;
let catalogRetryAfter: string | null = null;
let navigationSearchParams = new URLSearchParams();

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/compare",
  useSearchParams: () => navigationSearchParams as ReadonlyURLSearchParams,
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    measuresV1MeasuresGet: vi.fn<
      typeof import("@/generated/atlas").measuresV1MeasuresGet
    >(async (params) => {
      catalogRequests.push(params?.geography_type ?? "");
      if (catalogFailuresRemaining > 0) {
        catalogFailuresRemaining -= 1;
        const headers = new Headers();
        if (catalogRetryAfter) {
          headers.set("Retry-After", catalogRetryAfter);
        }
        return {
          data: { detail: "unavailable" },
          headers,
          status: catalogFailureStatus,
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
          data: [...compareMeasuresFixture]
            .toReversed()
            .filter(
              (measure) =>
                measure.geography_semantics === params?.geography_type
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
      const failuresLeft =
        observationFailureBudgets.get(params.measure_id) ?? 0;
      if (failuresLeft > 0) {
        observationFailureBudgets.set(params.measure_id, failuresLeft - 1);
        return {
          data: { detail: "unavailable" },
          headers: new Headers(),
          status: 503,
        } as never;
      }
      if (compareObservationRequestRejection(params) !== null) {
        return {
          data: { detail: "invalid observation request" },
          headers: new Headers(),
          status: 400,
        } as never;
      }
      return {
        data: {
          data: compareObservationsFor({
            fips: params.geography_id,
            measureId: params.measure_id,
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
          data: compareScoresFixture,
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

function renderCompare(search: string, retry: boolean | number = false) {
  setSearch(search);
  const client = new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory searchParams={search}>
        <ResetCompareExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return {
    ...view,
    rerenderSearch(next: string) {
      setSearch(next);
      view.rerender(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter hasMemory searchParams={next}>
            <ResetCompareExperience />
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    },
  };
}

async function pickCounty(slotName: string, optionName: RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: slotName }));
  const option = await screen.findByRole("option", { name: optionName });
  fireEvent.pointerDown(option, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(option, { button: 0, pointerId: 1 });
  fireEvent.click(option);
}

async function flushCompare(ready: () => boolean) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (ready()) {
      return;
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  }
  throw new Error(
    `Compare did not settle (${catalogRequests.length} catalog calls).`
  );
}

function pairFips(): string {
  return screen.getByTestId("compare-pair").dataset.fips ?? "";
}

async function waitForPair(fips: string) {
  await waitFor(() => {
    if (pairFips() !== fips) {
      throw new Error(`Waiting for pair ${fips}, saw ${pairFips()}.`);
    }
  });
}

function cell(measureId: string, fips: string) {
  return screen.getByTestId(`compare-cell-${measureId}-${fips}`);
}

describe("two-county aligned comparison", () => {
  afterEach(() => {
    cleanup();
    catalogFailureStatus = 503;
    catalogFailuresRemaining = 0;
    catalogRequests.length = 0;
    catalogRetryAfter = null;
    clearCompareCatalogRetryDeadlines();
    vi.useRealTimers();
    observationFailureBudgets.clear();
    observationRequests.length = 0;
    vi.unstubAllGlobals();
  });

  it("asks for two counties on a direct link with none", async () => {
    renderCompare("");
    expect(screen.getByTestId("compare-workspace").dataset.recovery).toBe(
      "empty"
    );
    expect(screen.getByTestId("compare-recovery").textContent).toContain(
      "will not select"
    );
    expect(screen.queryByTestId("compare-alignment")).toBeNull();
    await waitFor(() => {
      expect(observationRequests).toStrictEqual([]);
    });
  });

  it("keeps one valid county and asks for the second", async () => {
    renderCompare("?compare=08001&scope=CO");
    await waitForPair("08001");
    await waitFor(() => {
      expect(screen.getByTestId("compare-pair").textContent).toContain(
        "Denver"
      );
    });
    expect(screen.getByTestId("compare-workspace").dataset.recovery).toBe(
      "partial"
    );
    expect(screen.getByTestId("compare-recovery").textContent).toContain(
      "second county"
    );
    expect(observationRequests).toStrictEqual([]);
  });

  it("aligns a comparable value and a real zero on stable measure rows", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await waitForPair("08001,08013");
    const cases = await screen.findByTestId(
      `compare-row-${COMPARE_CASES_MEASURE_ID}`
    );
    const tick = screen.getByTestId(`compare-row-${COMPARE_TICK_MEASURE_ID}`);
    const canopy = screen.getByTestId(
      `compare-row-${COMPARE_CANOPY_MEASURE_ID}`
    );
    expect(cases.dataset.rowIndex).toBe("0");
    expect(tick.dataset.rowIndex).toBe("1");
    expect(canopy.dataset.rowIndex).toBe("2");
    expect(
      within(cell(COMPARE_CASES_MEASURE_ID, "08001")).getByTestId(
        "evidence-display-value"
      ).textContent
    ).toContain("12");
    expect(
      within(cell(COMPARE_CASES_MEASURE_ID, "08013")).getByTestId(
        "evidence-display-value"
      ).textContent
    ).toContain("0");
  });

  it("keeps a missing observation off later rows and off zero", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await waitForPair("08001,08013");
    const missing = await screen.findByTestId(
      `compare-cell-${COMPARE_TICK_MEASURE_ID}-08013`
    );
    expect(missing.dataset.observation).toBe("missing");
    expect(missing.textContent).not.toContain("0");
    expect(
      screen.getByTestId(`compare-relation-${COMPARE_TICK_MEASURE_ID}`)
        .textContent
    ).toContain("not zero");
    expect(
      screen.getByTestId(`compare-row-${COMPARE_CANOPY_MEASURE_ID}`).dataset
        .rowIndex
    ).toBe("2");
  });

  it("withholds a period mismatch in the aligned table", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const relation = await screen.findByTestId(
      `compare-relation-${COMPARE_CANOPY_MEASURE_ID}`
    );
    expect(relation.dataset.relation).toBe("withheld");
    expect(relation.textContent).toContain("periods differ");
    expect(relation.textContent).not.toContain("differ by");
  });

  it("queries both counties and hands the same pair downstream", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    const caseRequest = observationRequests.find((request) =>
      request.includes(COMPARE_CASES_MEASURE_ID)
    );
    expect(caseRequest).toContain("08001");
    expect(caseRequest).toContain("08013");
    expect(screen.getByTestId("compare-action").getAttribute("href")).toContain(
      "compare=08001%2C08013"
    );
    const investigate = screen
      .getByTestId("compare-investigate-08001")
      .getAttribute("href");
    expect(investigate).toContain("/app/investigate");
    expect(investigate).toContain("county=08001");
  });

  it("keeps the compare pair when handing one county to Investigate", async () => {
    renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=2023-01-01&metric=score"
    );
    await screen.findByTestId("compare-investigate-08001");
    const investigate =
      screen.getByTestId("compare-investigate-08001").getAttribute("href") ??
      "";
    expect({
      compare: investigate.includes("compare=08001%2C08013"),
      county: investigate.includes("county=08001"),
      dataset: investigate.includes("dataset=alpha-2026"),
      metric: investigate.includes("metric="),
      period: investigate.includes("period=2023-01-01"),
      scope: investigate.includes("scope=CO"),
    }).toStrictEqual({
      compare: true,
      county: true,
      dataset: true,
      metric: false,
      period: true,
      scope: true,
    });
  });

  it("explains invalid and duplicate FIPS without inventing a second county", async () => {
    const invalid = renderCompare("?compare=08001,not-a-fips");
    await waitForPair("08001");
    expect(screen.getByTestId("compare-workspace").dataset.pairIssue).toBe(
      "invalid"
    );
    expect(screen.getByTestId("compare-recovery").textContent).toContain(
      "not a county FIPS"
    );
    invalid.unmount();

    renderCompare("?compare=08001,08001");
    await waitForPair("08001");
    expect(screen.getByTestId("compare-workspace").dataset.pairIssue).toBe(
      "duplicate"
    );
    expect(screen.getByTestId("compare-recovery").textContent).toContain(
      "more than once"
    );
    expect(observationRequests).toStrictEqual([]);
  });

  it("does not let a pre-existing URL replace the pair on screen", async () => {
    renderCompare("?compare=08001,08013");
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    await pickCounty("Second county", /Albany, New York/);
    await waitForPair("08001,36001");
    expect(screen.getByTestId("compare-workspace").dataset.staleUrl).toBe(
      "true"
    );
    expect(navigationSearchParams.get("compare")).toBe("08001,08013");
    await waitFor(() => {
      expect(
        observationRequests.some(
          (request) =>
            request.includes(COMPARE_CASES_MEASURE_ID) &&
            request.includes("36001")
        )
      ).toBeTruthy();
    });
    expect(screen.getByTestId("compare-action").getAttribute("href")).toContain(
      "compare=08001%2C36001"
    );
    expect(screen.getByTestId("compare-workspace").dataset.fips).toBe(
      "08001,36001"
    );
  });

  it("removes and clears without letting the previous URL restore itself", async () => {
    renderCompare("?compare=08001,08013&scope=CO");
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    fireEvent.click(
      screen.getByRole("button", { name: /Remove Boulder, Colorado/ })
    );
    await waitForPair("08001");
    expect(navigationSearchParams.get("compare")).toBe("08001,08013");
    expect(screen.getByTestId("compare-workspace").dataset.staleUrl).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear counties" }));
    await waitForPair("");
    expect(screen.getByTestId("compare-workspace").dataset.fips).toBe("");
    expect(navigationSearchParams.get("compare")).toBe("08001,08013");
  });

  it("reloads a direct two-county link as the same pair", async () => {
    const first = renderCompare("?compare=08001,08013&scope=CO");
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    first.unmount();
    renderCompare("?compare=08001,08013&scope=CO");
    await waitForPair("08001,08013");
    expect(
      within(
        await screen.findByTestId(
          `compare-cell-${COMPARE_CASES_MEASURE_ID}-08001`
        )
      ).getByTestId("evidence-display-value").textContent
    ).toContain("12");
  });

  it("distinguishes counties that share a name", async () => {
    renderCompare("?compare=08001");
    await waitFor(() => {
      expect(screen.getByTestId("compare-pair").textContent).toContain(
        "Denver"
      );
    });
    await pickCounty("Second county", /Washington, Rhode Island \(44009\)/);
    await waitForPair(`08001,${COMPARE_WASHINGTON_RI}`);
    await pickCounty("Second county", /Washington, Minnesota \(27163\)/);
    await waitForPair(`08001,${COMPARE_WASHINGTON_MN}`);
    expect(screen.getByTestId("compare-pair").textContent).toContain(
      "Minnesota"
    );
    expect(screen.getByTestId("compare-pair").textContent).not.toContain(
      "Rhode Island"
    );
  });

  it("keeps an unknown FIPS visible and does not substitute another county", async () => {
    renderCompare("?compare=08001,99999");
    await waitFor(() => {
      expect(screen.getByTestId("compare-workspace").dataset.recovery).toBe(
        "unknown"
      );
    });
    expect(screen.getByTestId("compare-recovery").textContent).toContain(
      "99999"
    );
    expect(screen.queryByTestId("compare-alignment")).toBeNull();
    expect(observationRequests).toStrictEqual([]);
  });

  it("pins the resolved release on sidebar and in-page links when the URL omits dataset", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string): MediaQueryList =>
        ({
          addEventListener: () => {},
          dispatchEvent: () => true,
          matches: false,
          media: query,
          onchange: null,
          removeEventListener: () => {},
        }) as unknown as MediaQueryList
    );
    setSearch("compare=08001,08013&scope=CO");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter
          hasMemory
          searchParams="?compare=08001,08013&scope=CO"
        >
          <ResetProfessionalShell>
            <ResetCompareExperience />
          </ResetProfessionalShell>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    const sidebarHref =
      navigation
        .querySelector('a[href^="/app/action"]')
        ?.getAttribute("href") ?? "";
    const pageHref =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      pageDataset: pageHref.includes("dataset=alpha-2026"),
      pagePair: pageHref.includes("compare=08001%2C08013"),
      sidebarDataset: sidebarHref.includes("dataset=alpha-2026"),
      sidebarPair: sidebarHref.includes("compare=08001%2C08013"),
    }).toStrictEqual({
      pageDataset: true,
      pagePair: true,
      sidebarDataset: true,
      sidebarPair: true,
    });
  });

  it("surfaces an exhausted measure catalog and recovers the same pair", async () => {
    catalogFailuresRemaining = 99;
    renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=2024-06-01",
      1
    );
    await waitForPair("08001,08013");
    const alert = await screen.findByRole("alert");
    const actionHref =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      alignment: screen.queryByTestId("compare-alignment"),
      catalogCalls: catalogRequests.length,
      keepsContext: actionHref.includes("compare=08001%2C08013"),
      keepsPeriod: actionHref.includes("period=2024-06-01"),
      message: (alert.textContent ?? "").includes(
        "Governed measures could not be loaded."
      ),
    }).toStrictEqual({
      alignment: null,
      catalogCalls: 2,
      keepsContext: true,
      keepsPeriod: true,
      message: true,
    });
    catalogFailuresRemaining = 0;
    fireEvent.click(screen.getByTestId("compare-retry-catalog"));
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    const recoveredHref =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      pair: pairFips(),
      period: recoveredHref.includes("period=2024-06-01"),
      recovery: screen.getByTestId("compare-workspace").dataset.recovery,
      samePair: recoveredHref.includes("compare=08001%2C08013"),
    }).toStrictEqual({
      pair: "08001,08013",
      period: true,
      recovery: "ready",
      samePair: true,
    });
  });

  it("waits out Retry-After before a manual catalog retry", async () => {
    catalogFailureStatus = 429;
    catalogFailuresRemaining = 1;
    catalogRetryAfter = "60";
    vi.useFakeTimers();
    renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=2024-06-01",
      1
    );
    await flushCompare(
      () =>
        catalogRequests.length === 1 &&
        screen.queryByTestId("compare-catalog-wait") !== null
    );
    fireEvent.click(screen.getByTestId("compare-retry-catalog"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    const waiting = screen.getByTestId("compare-retry-catalog");
    expect({
      calls: catalogRequests.length,
      pair: pairFips(),
      waiting: waiting.dataset.waiting,
      window: (
        screen.getByTestId("compare-catalog-wait").textContent ?? ""
      ).includes("server retry window"),
    }).toStrictEqual({
      calls: 1,
      pair: "08001,08013",
      waiting: "true",
      window: true,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushCompare(
      () =>
        screen.queryByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`) !== null
    );
    const href =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      pair: pairFips(),
      period: href.includes("period=2024-06-01"),
      release: href.includes("dataset=alpha-2026"),
    }).toStrictEqual({
      pair: "08001,08013",
      period: true,
      release: true,
    });
  });

  it("keeps a catalog Retry-After when remount cancels the wait", async () => {
    catalogFailureStatus = 429;
    catalogFailuresRemaining = 1;
    catalogRetryAfter = "60";
    vi.useFakeTimers();
    const search =
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=2024-06-01";
    renderCompare(search, 1);
    await flushCompare(
      () =>
        catalogRequests.length === 1 &&
        screen.queryByTestId("compare-retry-catalog") !== null
    );
    fireEvent.click(screen.getByTestId("compare-retry-catalog"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    cleanup();
    renderCompare(search, 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(58_000);
    });
    await flushCompare(
      () => screen.queryByTestId("compare-catalog-wait") !== null
    );
    expect({
      calls: catalogRequests.length,
      pair: pairFips(),
      waiting: (
        screen.getByTestId("compare-catalog-wait").textContent ?? ""
      ).includes("server retry window"),
    }).toStrictEqual({
      calls: 1,
      pair: "08001,08013",
      waiting: true,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushCompare(
      () =>
        screen.queryByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`) !== null
    );
    const href =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      pair: pairFips(),
      period: href.includes("period=2024-06-01"),
      release: href.includes("dataset=alpha-2026"),
    }).toStrictEqual({
      pair: "08001,08013",
      period: true,
      release: true,
    });
  });

  it("waits out Retry-After before an automatic catalog retry", async () => {
    catalogFailureStatus = 503;
    catalogFailuresRemaining = 1;
    catalogRetryAfter = "60";
    vi.useFakeTimers();
    renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=2024-06-01",
      1
    );
    await flushCompare(
      () =>
        catalogRequests.length === 1 &&
        screen.queryByTestId("compare-catalog-wait") !== null
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const afterOneSecond = catalogRequests.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    await flushCompare(
      () =>
        screen.queryByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`) !== null
    );
    const href =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      afterOneSecond,
      pair: pairFips(),
      period: href.includes("period=2024-06-01"),
      release: href.includes("dataset=alpha-2026"),
    }).toStrictEqual({
      afterOneSecond: 1,
      pair: "08001,08013",
      period: true,
      release: true,
    });
  });

  it("retries failed measures without dropping rows that already loaded", async () => {
    observationFailureBudgets.set(COMPARE_TICK_MEASURE_ID, 99);
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await screen.findByTestId("compare-retry-evidence");
    const requestsFor = (measureId: string) =>
      observationRequests.filter((request) => request.includes(measureId))
        .length;
    const casesBefore = requestsFor(COMPARE_CASES_MEASURE_ID);
    expect({
      cases: cell(COMPARE_CASES_MEASURE_ID, "08001").dataset.observation,
      casesBefore,
      tick: cell(COMPARE_TICK_MEASURE_ID, "08001").dataset.observation,
    }).toStrictEqual({
      cases: "present",
      casesBefore: 1,
      tick: "failed",
    });
    observationFailureBudgets.set(COMPARE_TICK_MEASURE_ID, 0);
    fireEvent.click(screen.getByTestId("compare-retry-evidence"));
    await waitFor(() => {
      if (
        cell(COMPARE_TICK_MEASURE_ID, "08001").dataset.observation !== "present"
      ) {
        throw new Error("Waiting for the failed measure to load.");
      }
    });
    expect({
      boulder: cell(COMPARE_TICK_MEASURE_ID, "08013").dataset.observation,
      cases: cell(COMPARE_CASES_MEASURE_ID, "08001").dataset.observation,
      casesAfter: requestsFor(COMPARE_CASES_MEASURE_ID),
      denver: cell(COMPARE_TICK_MEASURE_ID, "08001").dataset.observation,
    }).toStrictEqual({
      boulder: "missing",
      cases: "present",
      casesAfter: casesBefore,
      denver: "present",
    });
  });

  it("keeps Review return on the original county when the pair changes", async () => {
    renderCompare(
      "?compare=08001&county=08001&scope=CO&dataset=alpha-2026&return=review"
    );
    await waitForPair("08001");
    const openedHref =
      screen.getByTestId("compare-return").getAttribute("href") ?? "";
    expect({
      county: openedHref.includes("county=08001"),
      label: screen.getByTestId("compare-return").textContent,
      pair: openedHref.includes("compare="),
      path: openedHref.includes("/app/review"),
      returnParam: openedHref.includes("return="),
    }).toStrictEqual({
      county: true,
      label: "Return to Review",
      pair: false,
      path: true,
      returnParam: false,
    });

    await pickCounty("Second county", /Boulder, Colorado/);
    await waitForPair("08001,08013");
    const edited =
      screen.getByTestId("compare-return").getAttribute("href") ?? "";
    const actionHref =
      screen.getByTestId("compare-action").getAttribute("href") ?? "";
    expect({
      actionPair: actionHref.includes("08013"),
      county: edited.includes("county=08001"),
      editedPair: edited.includes("08013"),
      returnTarget: screen.getByTestId("compare-workspace").dataset.return,
    }).toStrictEqual({
      actionPair: true,
      county: true,
      editedPair: false,
      returnTarget: "review",
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear counties" }));
    await waitForPair("");
    const cleared =
      screen.getByTestId("compare-return").getAttribute("href") ?? "";
    expect({
      county: cleared.includes("county=08001"),
      fips: screen.getByTestId("compare-workspace").dataset.fips,
      pair: cleared.includes("compare="),
    }).toStrictEqual({
      county: true,
      fips: "",
      pair: false,
    });
  });

  it("hands Investigate the visible pair without changing the entry county", async () => {
    renderCompare(
      "?compare=08001&county=08001&scope=CO&dataset=alpha-2026&period=2023-01-01&return=investigate"
    );
    await waitForPair("08001");
    await pickCounty("Second county", /Albany, New York/);
    await waitForPair("08001,36001");
    const href =
      screen.getByTestId("compare-return").getAttribute("href") ?? "";
    expect({
      county: href.includes("county=08001"),
      pair: href.includes("compare=08001%2C36001"),
      path: href.includes("/app/investigate"),
      period: href.includes("period=2023-01-01"),
      returnParam: href.includes("return="),
    }).toStrictEqual({
      county: true,
      pair: true,
      path: true,
      period: true,
      returnParam: false,
    });
  });

  it("leaves a direct link usable when return is absent or invalid", async () => {
    const direct = renderCompare("?compare=08001,08013&scope=CO");
    await waitForPair("08001,08013");
    expect(screen.queryByTestId("compare-return")).toBeNull();
    expect(screen.getByTestId("compare-workspace").dataset.return).toBe("");
    direct.unmount();

    renderCompare("?compare=08001,not-a-fips&return=assistant");
    await waitForPair("08001");
    expect(screen.queryByTestId("compare-return")).toBeNull();
    expect(screen.getByTestId("compare-workspace").dataset.pairIssue).toBe(
      "invalid"
    );
    expect(screen.getByTestId("compare-recovery").textContent).toContain(
      "second county"
    );
  });
});
