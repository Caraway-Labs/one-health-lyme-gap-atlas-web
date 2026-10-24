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
import { alignCompareCountyProfiles } from "@/features/ux-reset/compare/compare-county-profile";
import { CompareCountyProfileSection } from "@/features/ux-reset/compare/compare-county-profile-section";
import { compareObservationRequestRejection } from "@/features/ux-reset/compare/load-compare-evidence";
import { clearCompareProfileRetryDeadlines } from "@/features/ux-reset/compare/load-compare-profile";
import { ResetCompareExperience } from "@/features/ux-reset/compare/reset-compare-experience";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  COMPARE_CANOPY_MEASURE_ID,
  COMPARE_CASES_MEASURE_ID,
  COMPARE_LEFT_FIPS,
  COMPARE_RIGHT_FIPS,
  COMPARE_TICK_MEASURE_ID,
  COMPARE_WASHINGTON_MN,
  COMPARE_WASHINGTON_RI,
  compareCountyDetail,
  compareMeasuresFixture,
  compareObservationsFor,
  compareScoresFixture,
} from "./fixtures/compare-api-fixtures";
import { investigateMetadataFixture } from "./fixtures/investigate-api-fixtures";

// jsdom has no PointerEvent. Base UI Switch dispatches one when clicked.
if (window.PointerEvent === undefined) {
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: MouseEvent,
  });
}

const observationRequests: string[] = [];
const catalogRequests: string[] = [];
const observationFailureBudgets = new Map<string, number>();
const emptyObservationMeasures = new Set<string>();
let catalogFailureStatus = 503;
let catalogFailuresRemaining = 0;
let catalogRetryAfter: string | null = null;
let blankContextSourceNote = false;
let extraCatalogMeasures: typeof compareMeasuresFixture = [];
const countyRecordRequests: string[] = [];
const countyLimitationOverrides = new Map<string, string>();
const countyPriorityOverrides = new Map<string, string>();
let countyRateLimitRemaining = 0;
let countyRetryAfterSeconds: number | null = null;
let navigationSearchParams = new URLSearchParams();

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/compare",
  useSearchParams: () => navigationSearchParams as ReadonlyURLSearchParams,
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    countyV1CountiesFipsGet: vi.fn<
      typeof import("@/generated/atlas").countyV1CountiesFipsGet
    >(async (fips) => {
      countyRecordRequests.push(fips);
      if (countyRateLimitRemaining > 0) {
        countyRateLimitRemaining -= 1;
        throw new AtlasApiError(
          "The published county record could not be loaded.",
          `/v1/counties/${fips}`,
          429,
          null,
          countyRetryAfterSeconds
        );
      }
      if (fips === "08013") {
        return {
          data: null,
          headers: new Headers(),
          status: 404,
        } as never;
      }
      const detail = compareCountyDetail(fips);
      const limitationOverride = countyLimitationOverrides.get(fips);
      if (limitationOverride !== undefined) {
        detail.release = {
          ...detail.release,
          limitations: limitationOverride,
        };
      }
      const priorityOverride = countyPriorityOverrides.get(fips);
      if (priorityOverride) {
        detail.priority = priorityOverride;
      }
      if (blankContextSourceNote) {
        detail.release = {
          ...detail.release,
          sources: detail.release.sources.map((source) =>
            source.key === "context_svi" ? { ...source, note: "" } : source
          ),
        };
      }
      return {
        data: detail,
        headers: new Headers(),
        status: 200,
      } as never;
    }),
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
          data: [...compareMeasuresFixture, ...extraCatalogMeasures]
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
      if (emptyObservationMeasures.has(params.measure_id)) {
        return {
          data: {
            data: [],
            links: { self: "/v1/observations" },
            meta: {},
          },
          headers: new Headers(),
          status: 200,
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
    countySurveillanceSituationsGet: vi.fn<
      typeof import("@/generated/atlas").countySurveillanceSituationsGet
    >(
      async () =>
        ({
          data: null,
          headers: new Headers(),
          status: 404,
        }) as never
    ),
    countyTier1SurveillancePriorityGet: vi.fn<
      typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
    >(
      async () =>
        ({
          data: null,
          headers: new Headers(),
          status: 404,
        }) as never
    ),
  };
});

function setSearch(search: string) {
  navigationSearchParams = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
}

function renderCompare(
  search: string,
  retry: boolean | number = false,
  options?: {
    onUrlUpdate?: (query: string) => void;
    shell?: boolean;
  }
) {
  setSearch(search);
  const client = new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0 } },
  });
  const page = options?.shell ? (
    <ResetProfessionalShell>
      <ResetCompareExperience />
    </ResetProfessionalShell>
  ) : (
    <ResetCompareExperience />
  );
  const view = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={({ queryString }) => {
          options?.onUrlUpdate?.(queryString);
        }}
        searchParams={search}
      >
        {page}
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return {
    ...view,
    client,
    rerenderSearch(next: string) {
      setSearch(next);
      const nextPage = options?.shell ? (
        <ResetProfessionalShell>
          <ResetCompareExperience />
        </ResetProfessionalShell>
      ) : (
        <ResetCompareExperience />
      );
      view.rerender(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={({ queryString }) => {
              options?.onUrlUpdate?.(queryString);
            }}
            searchParams={next}
          >
            {nextPage}
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    },
  };
}

function compareParam(query: string): string | null {
  const params = new URLSearchParams(
    query.startsWith("?") ? query.slice(1) : query
  );
  return params.get("compare");
}

function shellHref(label: string): string {
  const navigation = screen.getByRole("navigation", {
    name: "Professional workspace",
  });
  return (
    navigation
      .querySelector(`a[aria-label="${label}"]`)
      ?.getAttribute("href") ?? ""
  );
}

async function pickCounty(slotName: string, optionName: RegExp) {
  // Open the county list from the keyboard. Search and filtering are covered
  // in compare-county-search.test.ts.
  fireEvent.keyDown(screen.getByRole("combobox", { name: slotName }), {
    key: "ArrowDown",
  });
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
    `Compare did not settle (${catalogRequests.length} catalog calls, ${countyRecordRequests.length} county-record calls). Status: ${screen.queryByTestId("compare-status")?.textContent ?? "none"}`
  );
}

function pairFips(): string {
  return screen.getByTestId("compare-pair").dataset.fips ?? "";
}

function expectCountyEvidenceLinksAbsent() {
  expect(screen.queryByRole("link", { name: /county evidence/i })).toBeNull();
  expect(
    document.querySelector("[data-testid^='compare-investigate-']")
  ).toBeNull();
}

async function waitForPair(fips: string) {
  await waitFor(() => {
    if (pairFips() !== fips) {
      throw new Error(`Waiting for pair ${fips}, saw ${pairFips()}.`);
    }
  });
}

function comparisonReady(): boolean {
  return screen.queryByTestId("compare-alignment") !== null;
}

function populationCatalogState() {
  const population = screen.getByTestId(
    "compare-profile-cell-population_2022-08001"
  );
  const text = population.textContent ?? "";
  return {
    availability: population.dataset.evidenceAvailability ?? "",
    caveat: text.includes("Coverage is incomplete"),
    evidenceType: text.includes("Count"),
  };
}

describe("two-county aligned comparison", () => {
  afterEach(() => {
    cleanup();
    blankContextSourceNote = false;
    catalogFailureStatus = 503;
    catalogFailuresRemaining = 0;
    catalogRequests.length = 0;
    catalogRetryAfter = null;
    emptyObservationMeasures.clear();
    extraCatalogMeasures = [];
    clearCompareCatalogRetryDeadlines();
    clearCompareProfileRetryDeadlines();
    countyLimitationOverrides.clear();
    countyPriorityOverrides.clear();
    countyRateLimitRemaining = 0;
    countyRecordRequests.length = 0;
    countyRetryAfterSeconds = null;
    vi.restoreAllMocks();
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
    expect(screen.getByTestId("compare-empty").textContent).toContain(
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
    expect(screen.getByTestId("compare-empty").textContent).toContain(
      "second county"
    );
    expect(observationRequests).toStrictEqual([]);
    expect(
      screen.queryByTestId("compare-surveillance-intelligence")
    ).toBeNull();
  });

  it("orders the results: at a glance, perspectives, evidence, gaps, sources", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const glance = await screen.findByTestId("compare-at-a-glance");
    const intelligence = await screen.findByTestId(
      "compare-surveillance-intelligence"
    );
    const evidence = screen.getByTestId("compare-evidence");
    const unknown = await screen.findByTestId("compare-unknown");
    const sources = screen.getByTestId("compare-sources");
    const human = screen.getByTestId("compare-group-human");
    const vector = screen.getByTestId("compare-group-vector");
    const community = screen.getByTestId("compare-group-community");
    const following = Node.DOCUMENT_POSITION_FOLLOWING;
    expect([
      glance.compareDocumentPosition(intelligence),
      intelligence.compareDocumentPosition(evidence),
      human.compareDocumentPosition(vector),
      vector.compareDocumentPosition(community),
      evidence.compareDocumentPosition(unknown),
      unknown.compareDocumentPosition(sources),
    ]).toStrictEqual([
      following,
      following,
      following,
      following,
      following,
      following,
    ]);
    expect(screen.getByTestId("compare-intelligence-guide")).toBeTruthy();
    expect(screen.getAllByTestId(/^compare-surveillance-row-/)).toHaveLength(4);
    expect(intelligence.textContent ?? "").not.toMatch(
      /differ by|winner|loser|delta/i
    );
  });

  it("shows both glance cards equally, with no winner", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const first = await screen.findByTestId("compare-glance-08001");
    const second = screen.getByTestId("compare-glance-08013");
    expect(first.className).toBe(second.className);
    expect(
      within(first).getByRole("img", { name: /Published review score/ })
    ).toBeTruthy();
    expect(
      within(first)
        .getAllByTestId(/^compare-coverage-/)
        .map((item) => item.dataset.coverage)
        .every((coverage) =>
          ["available", "limited", "unavailable"].includes(coverage ?? "")
        )
    ).toBeTruthy();
  });

  it("filters rows to differences and to evidence gaps, and counts them", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await screen.findByTestId("compare-evidence");
    await screen.findByTestId("compare-profile-row-human_case_floor");
    const count = screen.getByTestId("compare-filter-count");
    const total = Number(
      (count.textContent ?? "").split(" of ")[1]?.split(" ")[0]
    );
    expect(count.textContent).toBe(`${total} of ${total} rows`);
    fireEvent.click(screen.getByTestId("compare-filter-gaps"));
    await waitFor(() => {
      const rows = screen.getAllByTestId(/^compare-profile-row-/);
      const shown = Number((count.textContent ?? "").split(" of ")[0]);
      if (
        shown !== rows.length ||
        rows.some((row) => row.dataset.gap !== "true")
      ) {
        throw new Error("Waiting for the gap filter.");
      }
    });
    fireEvent.click(screen.getByTestId("compare-filter-gaps"));
    fireEvent.click(screen.getByTestId("compare-filter-differences"));
    await waitFor(() => {
      expect(
        screen
          .queryAllByTestId(/^compare-profile-row-/)
          .some((row) => row.dataset.relation === "same")
      ).toBeFalsy();
    });
  });

  it("keeps source details behind one button per value and one table", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const row = await screen.findByTestId(
      "compare-profile-row-population_2022"
    );
    expect(
      within(row).getAllByRole("button", {
        name: /Sources and limitations for/,
      }).length
    ).toBeGreaterThan(0);
    expect(row.textContent ?? "").not.toMatch(
      /Source unknown|Observation period unknown/
    );
    const sources = screen.getByTestId("compare-sources");
    expect(
      within(sources).getByTestId("compare-source-row-population_2022")
    ).toBeTruthy();
  });

  it("defines same, different, and not comparable without treating a gap as a match", async () => {
    observationFailureBudgets.set(COMPARE_TICK_MEASURE_ID, 99);
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const summary = await screen.findByTestId("compare-summary");
    await screen.findByTestId("compare-profile-row-human_case_floor");
    const text = summary.textContent ?? "";
    expect({
      definesComparison: text.includes(
        "Same and different compare the published values"
      ),
      definesWithheld:
        text.includes("Not comparable means") &&
        text.includes("unit, period, release, or method does not match"),
      missingIsNotZero: text.includes(
        "A missing value stays missing and is not zero"
      ),
      treatsWithheldAsMatched: text.includes("already match"),
    }).toStrictEqual({
      definesComparison: true,
      definesWithheld: true,
      missingIsNotZero: true,
      treatsWithheldAsMatched: false,
    });
  });

  it("uses priority pills for recognized review categories and stays neutral otherwise", async () => {
    const samples = [
      ["Priority 1 — Investigate", "urgent", "Highest review priority"],
      ["Priority 2 — Review", "review", "Moderate review priority"],
      ["Watch", "watch", "Monitor for changes"],
      ["Lower", "lower", "Lower review priority"],
      ["Priority 10 — Review", "neutral", "Priority 10 — Review"],
    ] as const;
    const seen: { text: string; tone: string | undefined }[] = [];
    for (const [priority, tone] of samples) {
      cleanup();
      countyPriorityOverrides.set(COMPARE_LEFT_FIPS, priority);
      renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
      await waitForPair("08001,08013");
      const badge = await screen.findByTestId(
        `compare-review-category-${COMPARE_LEFT_FIPS}`
      );
      const pill = badge.querySelector(".priority-pill");
      seen.push({
        text: badge.textContent ?? "",
        tone:
          tone === "neutral"
            ? badge.dataset.reviewTone
            : pill?.classList.contains(tone)
              ? tone
              : pill?.className,
      });
    }
    expect(seen).toStrictEqual(
      samples.map(([, tone, text]) => ({ text, tone }))
    );
  });

  it("shows a published floor beside a suppressed value that is not zero", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const row = await screen.findByTestId(
      "compare-profile-row-human_case_floor"
    );
    const left = within(row).getByTestId(
      "compare-profile-cell-human_case_floor-08001"
    );
    const right = within(row).getByTestId(
      "compare-profile-cell-human_case_floor-08013"
    );
    expect(left.textContent).toContain("12");
    expect(right.dataset.observation).toBe("missing");
    expect(
      right.querySelector(".ux-reset-compare-missing span[aria-hidden='true']")
        ?.textContent
    ).toBe("No record");
    expect(row.dataset.relation).toBe("incomparable");
  });

  it("keeps a missing county value off zero and still shows later rows", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const missing = await screen.findByTestId(
      "compare-profile-cell-scapularis_status-08013"
    );
    expect(missing.dataset.observation).toBe("missing");
    expect(
      missing.querySelector(
        ".ux-reset-compare-missing span[aria-hidden='true']"
      )?.textContent
    ).toBe("No record");
    expect(
      screen.getByTestId("compare-profile-row-population_2022")
    ).toBeTruthy();
  });

  it("does not describe a gap as a calculated difference", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const row = await screen.findByTestId(
      "compare-profile-row-human_case_floor"
    );
    expect(row.dataset.relation).toBe("incomparable");
    expect(row.textContent ?? "").not.toContain("differ by");
    expect(
      (await screen.findByTestId("compare-profile-comparability")).textContent
    ).not.toContain("differ by");
  });

  it("queries both counties without county-evidence links on the panels", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await screen.findByTestId("compare-alignment");
    const caseRequest = observationRequests.find((request) =>
      request.includes(COMPARE_CASES_MEASURE_ID)
    );
    expectCountyEvidenceLinksAbsent();
    expect({
      action: screen.queryByTestId("compare-action"),
      left: caseRequest?.includes("08001"),
      pair: pairFips(),
      right: caseRequest?.includes("08013"),
    }).toStrictEqual({
      action: null,
      left: true,
      pair: "08001,08013",
      right: true,
    });
  });

  it("keeps both county panels free of county-evidence links", async () => {
    renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=2023-01-01&metric=score"
    );
    await waitForPair("08001,08013");
    expectCountyEvidenceLinksAbsent();
    expect(screen.getByTestId("compare-chip-08001").textContent).toContain(
      "08001"
    );
    expect(screen.getByTestId("compare-chip-08013").textContent).toContain(
      "08013"
    );
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
    await screen.findByTestId("compare-alignment");
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
    expectCountyEvidenceLinksAbsent();
    expect({
      action: screen.queryByTestId("compare-action"),
      fips: screen.getByTestId("compare-workspace").dataset.fips,
    }).toStrictEqual({
      action: null,
      fips: "08001,36001",
    });
  });

  it("removes and clears without letting the previous URL restore itself", async () => {
    renderCompare("?compare=08001,08013&scope=CO");
    await screen.findByTestId("compare-alignment");
    fireEvent.click(
      screen.getByRole("button", { name: "Clear second county" })
    );
    await waitForPair("08001");
    expect(navigationSearchParams.get("compare")).toBe("08001,08013");
    expect(screen.getByTestId("compare-workspace").dataset.staleUrl).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear first county" }));
    await waitForPair("");
    expect(screen.getByTestId("compare-workspace").dataset.fips).toBe("");
    expect(navigationSearchParams.get("compare")).toBe("08001,08013");
  });

  it("writes a completed pair into the shareable URL, reload, and cross-page links", async () => {
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
    const urlUpdates: string[] = [];
    const selected = renderCompare("", false, {
      onUrlUpdate: (query) => {
        urlUpdates.push(query);
      },
      shell: true,
    });
    await pickCounty("First county", /Denver, Colorado \(08001\)/);
    await waitForPair("08001");
    await pickCounty("Second county", /Boulder, Colorado \(08013\)/);
    await waitForPair("08001,08013");
    await waitFor(() => {
      if (compareParam(urlUpdates.at(-1) ?? "") !== "08001,08013") {
        throw new Error("Waiting for the completed pair in the shareable URL.");
      }
    });
    const sharedUrl = urlUpdates.at(-1) ?? "";
    expectCountyEvidenceLinksAbsent();
    const explorer = shellHref("Atlas Explorer");
    const compare = shellHref("Compare");
    expect({
      compare: compare.includes("compare=08001%2C08013"),
      explorer: explorer.includes("compare=08001%2C08013"),
      shared: compareParam(sharedUrl),
    }).toStrictEqual({
      compare: true,
      explorer: true,
      shared: "08001,08013",
    });

    selected.unmount();
    renderCompare(sharedUrl);
    await waitForPair("08001,08013");
    expectCountyEvidenceLinksAbsent();
    expect({
      fips: pairFips(),
      stale: screen.getByTestId("compare-workspace").dataset.staleUrl,
    }).toStrictEqual({
      fips: "08001,08013",
      stale: "false",
    });
  });

  it("keeps a second-county-only selection out of the URL until a first county exists", async () => {
    const urlUpdates: string[] = [];
    const pending = renderCompare("", false, {
      onUrlUpdate: (query) => {
        urlUpdates.push(query);
      },
    });
    await pickCounty("Second county", /Boulder, Colorado \(08013\)/);
    const chip = await screen.findByTestId("compare-chip-08013");
    expect({
      chip: (chip.textContent ?? "").includes("Boulder"),
      pair: pairFips(),
      urlWrites: urlUpdates.map((query) => compareParam(query)),
    }).toStrictEqual({
      chip: true,
      pair: "",
      urlWrites: [],
    });

    pending.unmount();
    renderCompare("");
    await waitFor(() => {
      expect(screen.getByTestId("compare-workspace").dataset.recovery).toBe(
        "empty"
      );
    });
    expect(screen.queryByTestId("compare-chip-08013")).toBeNull();
    expect(pairFips()).toBe("");
  });

  it("reloads a direct two-county link as the same pair", async () => {
    const first = renderCompare("?compare=08001,08013&scope=CO");
    await screen.findByTestId("compare-alignment");
    first.unmount();
    renderCompare("?compare=08001,08013&scope=CO");
    await waitForPair("08001,08013");
    expect(
      (await screen.findByTestId("compare-profile-cell-human_case_floor-08001"))
        .textContent
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
    await screen.findByTestId("compare-alignment", undefined, {
      timeout: 5000,
    });
    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    const sidebarHref =
      navigation
        .querySelector('a[aria-label="Atlas Explorer"]')
        ?.getAttribute("href") ?? "";
    expect(screen.queryByTestId("compare-action")).toBeNull();
    expectCountyEvidenceLinksAbsent();
    expect({
      sidebarDataset: sidebarHref.includes("dataset=alpha-2026"),
      sidebarPair: sidebarHref.includes("compare=08001%2C08013"),
    }).toStrictEqual({
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
    expect(screen.queryByTestId("compare-action")).toBeNull();
    expectCountyEvidenceLinksAbsent();
    expect({
      alignment: screen.queryByTestId("compare-alignment"),
      catalogCalls: catalogRequests.length,
      keepsContext: pairFips(),
      message: (alert.textContent ?? "").includes(
        "Governed measures could not be loaded."
      ),
    }).toStrictEqual({
      alignment: null,
      catalogCalls: 2,
      keepsContext: "08001,08013",
      message: true,
    });
    catalogFailuresRemaining = 0;
    fireEvent.click(screen.getByTestId("compare-retry"));
    await screen.findByTestId("compare-alignment");
    expectCountyEvidenceLinksAbsent();
    expect({
      pair: pairFips(),
      recovery: screen.getByTestId("compare-workspace").dataset.recovery,
    }).toStrictEqual({
      pair: "08001,08013",
      recovery: "ready",
    });
  });

  it("keeps catalog limitations when a later catalog refresh fails", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    blankContextSourceNote = true;
    extraCatalogMeasures = [
      {
        ...base,
        definition: "Resident population.",
        indicator_id: "population",
        label: "Population",
        limitations: ["Coverage is incomplete"],
        measure_id: "population_2022",
        measure_type: "count",
        unit: "people",
      },
    ];
    const view = renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026"
    );
    await screen.findByTestId("compare-profile-cell-population_2022-08001");
    expect(populationCatalogState()).toStrictEqual({
      availability: "limited",
      caveat: true,
      evidenceType: true,
    });
    catalogFailuresRemaining = 1;
    await act(async () => {
      await view.client.refetchQueries({
        queryKey: ["ux-reset-compare-measures"],
      });
    });
    await waitFor(() => {
      expect({
        ...populationCatalogState(),
        refreshError: (screen.queryByRole("alert")?.textContent ?? "").includes(
          "could not be loaded"
        ),
      }).toStrictEqual({
        availability: "limited",
        caveat: true,
        evidenceType: true,
        refreshError: true,
      });
    });
    catalogFailuresRemaining = 0;
    fireEvent.click(screen.getByTestId("compare-retry"));
    await waitFor(() => {
      if (screen.queryByText("Governed measures could not be loaded.")) {
        throw new Error("Catalog refresh error is still showing.");
      }
    });
    expect(populationCatalogState()).toStrictEqual({
      availability: "limited",
      caveat: true,
      evidenceType: true,
    });
  });

  it("hides cached county records after a failed refresh", async () => {
    const view = renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026"
    );
    await screen.findByTestId("compare-profile");
    expect(screen.queryByTestId("compare-status-error-profile")).toBeNull();
    countyRateLimitRemaining = 2;
    countyRetryAfterSeconds = 0;
    await act(async () => {
      await view.client.refetchQueries({
        queryKey: ["ux-reset-compare-profile"],
      });
    });
    expect({
      error: (
        screen.getByTestId("compare-status-error-profile").textContent ?? ""
      ).includes("did not load"),
      table: screen.queryByTestId("compare-profile"),
    }).toStrictEqual({
      error: true,
      table: null,
    });
    countyRateLimitRemaining = 0;
    countyRetryAfterSeconds = null;
    clearCompareProfileRetryDeadlines();
    fireEvent.click(screen.getByTestId("compare-retry"));
    await screen.findByTestId("compare-profile");
    expect(screen.queryByTestId("compare-status-error-profile")).toBeNull();
  });

  it("waits out Retry-After before another county-record request", async () => {
    countyRateLimitRemaining = 2;
    countyRetryAfterSeconds = 60;
    vi.useFakeTimers();
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await flushCompare(
      () =>
        countyRecordRequests.length === 2 &&
        screen.queryByTestId("compare-retry") !== null
    );
    fireEvent.click(screen.getByTestId("compare-retry"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    const waiting = screen.getByTestId("compare-retry");
    expect({
      calls: countyRecordRequests.length,
      waiting: waiting.dataset.waiting,
    }).toStrictEqual({
      calls: 2,
      waiting: "true",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushCompare(() => countyRecordRequests.length === 4);
    expect(screen.getByTestId("compare-profile")).toBeTruthy();
    expect(screen.queryByTestId("compare-status-error-profile")).toBeNull();
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
        screen.queryByTestId("compare-retry") !== null
    );
    fireEvent.click(screen.getByTestId("compare-retry"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    const waiting = screen.getByTestId("compare-retry");
    expect({
      calls: catalogRequests.length,
      pair: pairFips(),
      waiting: waiting.dataset.waiting,
      window: (
        screen.getByTestId("compare-loading").textContent ?? ""
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
    await flushCompare(() => comparisonReady());
    expectCountyEvidenceLinksAbsent();
    const href =
      screen.getByTestId("compare-ask-atlas").getAttribute("href") ?? "";
    expect({
      pair: pairFips(),
      release: href.includes("dataset=alpha-2026"),
    }).toStrictEqual({
      pair: "08001,08013",
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
        screen.queryByTestId("compare-retry") !== null
    );
    fireEvent.click(screen.getByTestId("compare-retry"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    cleanup();
    renderCompare(search, 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(58_000);
    });
    await flushCompare(() =>
      (screen.queryByTestId("compare-loading")?.textContent ?? "").includes(
        "server retry window"
      )
    );
    expect({
      calls: catalogRequests.length,
      pair: pairFips(),
      waiting: (
        screen.getByTestId("compare-loading").textContent ?? ""
      ).includes("server retry window"),
    }).toStrictEqual({
      calls: 1,
      pair: "08001,08013",
      waiting: true,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushCompare(() => comparisonReady());
    expectCountyEvidenceLinksAbsent();
    const href =
      screen.getByTestId("compare-ask-atlas").getAttribute("href") ?? "";
    expect({
      pair: pairFips(),
      release: href.includes("dataset=alpha-2026"),
    }).toStrictEqual({
      pair: "08001,08013",
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
        (screen.queryByTestId("compare-loading")?.textContent ?? "").includes(
          "server retry window"
        )
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const afterOneSecond = catalogRequests.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    await flushCompare(() => comparisonReady());
    expectCountyEvidenceLinksAbsent();
    const href =
      screen.getByTestId("compare-ask-atlas").getAttribute("href") ?? "";
    expect({
      afterOneSecond,
      pair: pairFips(),
      release: href.includes("dataset=alpha-2026"),
    }).toStrictEqual({
      afterOneSecond: 1,
      pair: "08001,08013",
      release: true,
    });
  });

  it("keeps a unique catalog measure and its provenance beside the county record", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const canopy = await screen.findByTestId(
      `compare-row-${COMPARE_CANOPY_MEASURE_ID}`
    );
    const sources = screen.getByTestId(
      `compare-source-row-${COMPARE_CANOPY_MEASURE_ID}`
    );
    expect({
      label: (canopy.textContent ?? "").includes("Tree canopy cover"),
      profile: Boolean(
        screen.queryByTestId("compare-profile-row-population_2022")
      ),
      provenance: (sources.textContent ?? "").includes("Governed surveillance"),
      sourceButton: within(canopy).getAllByRole("button", {
        name: /Sources and limitations/,
      }).length,
    }).toStrictEqual({
      label: true,
      profile: true,
      provenance: true,
      sourceButton: 2,
    });
  });

  it("keeps a catalog observation whose value differs from the county record", async () => {
    extraCatalogMeasures = [
      {
        ...compareMeasuresFixture[0],
        geography_semantics: "COUNTY",
        label: "Population",
        measure_id: "population_2022",
        measure_type: "count",
        unit: "people",
      },
    ];
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const separate = await screen.findByTestId("compare-row-population_2022");
    expect({
      note: (separate.textContent ?? "").includes("Kept separately"),
      profile: Boolean(
        screen.queryByTestId("compare-profile-row-population_2022")
      ),
      source: Boolean(
        screen.queryByTestId("compare-source-row-population_2022-observation")
      ),
    }).toStrictEqual({
      note: true,
      profile: true,
      source: true,
    });
  });

  it("keeps aligned observations when the county record request fails", async () => {
    countyRateLimitRemaining = 99;
    countyRetryAfterSeconds = 0;
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const canopy = await screen.findByTestId(
      `compare-row-${COMPARE_CANOPY_MEASURE_ID}`
    );
    expect({
      observation: (canopy.textContent ?? "").includes("Tree canopy cover"),
      profile: screen.queryByTestId("compare-profile"),
      source: Boolean(
        screen.queryByTestId(`compare-source-row-${COMPARE_CANOPY_MEASURE_ID}`)
      ),
    }).toStrictEqual({
      observation: true,
      profile: null,
      source: true,
    });
  });

  it("keeps a failed measure in its cell without a page-level measure banner", async () => {
    observationFailureBudgets.set(COMPARE_TICK_MEASURE_ID, 99);
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const tick = await screen.findByTestId(
      `compare-cell-${COMPARE_TICK_MEASURE_ID}-08001`
    );
    await waitFor(() => {
      if (
        !(tick.textContent ?? "").includes("Couldn\u2019t load this evidence.")
      ) {
        throw new Error("Waiting for the failed measure cell.");
      }
    });
    expect({
      banner: screen.queryByText(/Some measures could not be loaded/),
      cases: observationCell(COMPARE_CASES_MEASURE_ID, "08001").dataset
        .observation,
      overview: screen.queryByTestId("compare-overview-partial"),
      retry: screen.queryByTestId("compare-retry"),
      status: screen.queryByTestId("compare-status-error-measures"),
      tick: tick.textContent ?? "",
    }).toStrictEqual({
      banner: null,
      cases: "present",
      overview: null,
      retry: null,
      status: null,
      tick: "Couldn\u2019t load this evidence.",
    });
  });

  it("draws community context with published labels and a missing mark that is not zero", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const social = await screen.findByTestId(
      "compare-profile-row-svi_percentile_2022"
    );
    const uninsured = screen.getByTestId(
      "compare-profile-row-uninsured_percent_2022"
    );
    const rurality = screen.getByTestId("compare-profile-row-rucc_2023");
    const published = within(social).getByTestId(
      "compare-profile-cell-svi_percentile_2022-08001"
    );
    const missing = within(social).getByTestId(
      "compare-profile-cell-svi_percentile_2022-08013"
    );
    const ruralSummary = screen.getByTestId(
      "compare-community-summary-rucc_2023"
    );
    expect({
      download: screen.getByTestId("compare-download-pdfs").textContent,
      gap: social.dataset.gap,
      missingMark: missing.querySelector(".ux-reset-compare-missing")
        ?.textContent,
      missingZero: missing.querySelector(".ux-reset-compare-vlabel"),
      percentile: published.textContent,
      print: screen.queryByTestId("compare-print"),
      relation: social.dataset.relation,
      rurality: rurality.textContent,
      socialHeading: social.querySelector("h4")?.textContent,
      summary: screen.getByTestId(
        "compare-community-summary-svi_percentile_2022"
      ).textContent,
      uninsuredHeading: uninsured.querySelector("h4")?.textContent,
      year: published.textContent?.includes("2022"),
    }).toStrictEqual({
      download: "Download Counties as PDF",
      gap: "true",
      missingMark: "No recordNo published value. This absence is not zero.",
      missingZero: null,
      percentile: expect.stringContaining("91st"),
      print: null,
      relation: "incomparable",
      rurality: expect.stringContaining(
        "No record does not mean absent or zero."
      ),
      socialHeading: "Social vulnerability",
      summary:
        "No difference is shown because a published value is missing or not readable.",
      uninsuredHeading: "Uninsured population",
      year: true,
    });
    expect(ruralSummary.textContent).toBe(
      "The classifications are not compared because a published value is missing."
    );
  });

  it("leaves nclimgrid out of rows, counts, and the sources table", async () => {
    extraCatalogMeasures = [
      {
        ...compareMeasuresFixture[0],
        geography_semantics: "COUNTY_FIPS_5",
        label: "nClimGrid average temperature",
        measure_id: "nclimgrid_tavg_county_day",
      },
    ];
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await screen.findByTestId("compare-profile-row-population_2022");
    await screen.findByTestId(`compare-row-${COMPARE_CANOPY_MEASURE_ID}`);
    const count = screen.getByTestId("compare-filter-count").textContent ?? "";
    expect({
      count,
      requested: observationRequests.some((request) =>
        request.includes("nclimgrid")
      ),
      row: screen.queryByTestId("compare-row-nclimgrid_tavg_county_day"),
      source: screen.queryByTestId(
        "compare-source-row-nclimgrid_tavg_county_day"
      ),
      text: screen.queryByText(/nClimGrid/i),
    }).toStrictEqual({
      count: expect.not.stringContaining("nClimGrid"),
      requested: false,
      row: null,
      source: null,
      text: null,
    });
  });

  it("shows a plain missing value when no time bound returns observations", async () => {
    extraCatalogMeasures = [
      {
        ...compareMeasuresFixture[0],
        geography_semantics: "COUNTY_FIPS_5",
        label: "Seasonal canopy",
        measure_id: "unbound-gap",
        temporal_grains: ["CUSTOM"],
        temporal_semantics: "seasonal",
      },
    ];
    emptyObservationMeasures.add("unbound-gap");
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const cell = await screen.findByTestId("compare-cell-unbound-gap-08001");
    const bounds = observationRequests
      .filter((request) => request.includes("unbound-gap"))
      .map(
        (request) =>
          JSON.parse(request) as { start_date?: string; year?: number }
      );
    expect({
      text: cell.textContent,
      withheld: screen.queryByText(
        /no governed period|Not available for this period/i
      ),
      years: bounds.map((bound) => bound.year ?? bound.start_date ?? ""),
    }).toStrictEqual({
      text: "No published value. This absence is not zero.",
      withheld: null,
      years: [2023, "2025-12-31"],
    });
  });

  it("downloads one PDF per county from the share bar", async () => {
    const NativeURL = globalThis.URL;
    const urls: string[] = [];
    class DownloadURL extends NativeURL {
      static createObjectURL(): string {
        return "blob:compare-pdf";
      }

      static revokeObjectURL(): void {
        return undefined;
      }
    }
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      urls.push(String(input));
      return Promise.resolve(
        new Response(new Blob(["%PDF-1.7"]), {
          headers: { "content-type": "application/pdf" },
          status: 200,
        })
      );
    });
    vi.stubGlobal("URL", DownloadURL);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    const button = await screen.findByTestId("compare-download-pdfs");
    await waitFor(() => {
      if (button.hasAttribute("disabled")) {
        throw new Error("Waiting for the PDF action.");
      }
    });
    fireEvent.click(button);
    const status = await screen.findByText("County PDFs downloaded.");
    const paths = urls.map((url) => new NativeURL(url).pathname).toSorted();
    expect({
      paths,
      release: urls.every((url) => url.includes("dataset_version=alpha-2026")),
      status: status.textContent,
    }).toStrictEqual({
      paths: ["/v1/counties/08001/report.pdf", "/v1/counties/08013/report.pdf"],
      release: true,
      status: "County PDFs downloaded.",
    });
  });

  it("keeps Review return on the original county when the pair changes", async () => {
    renderCompare(
      "?compare=08001&county=08001&scope=CO&dataset=alpha-2026&return=review"
    );
    await waitForPair("08001");
    const openedHref =
      screen.getByTestId("compare-workspace").dataset.explorerReturn ?? "";
    expect({
      county: openedHref.includes("county=08001"),
      pair: openedHref.includes("compare="),
      path: openedHref.includes("/explore"),
      returnButton: screen.queryByTestId("compare-return"),
      returnLink: screen.queryByRole("link", { name: "Return to Explorer" }),
      returnParam: openedHref.includes("return="),
    }).toStrictEqual({
      county: true,
      pair: true,
      path: true,
      returnButton: null,
      returnLink: null,
      returnParam: false,
    });

    await pickCounty("Second county", /Boulder, Colorado/);
    await waitForPair("08001,08013");
    const edited =
      screen.getByTestId("compare-workspace").dataset.explorerReturn ?? "";
    expect(screen.queryByTestId("compare-action")).toBeNull();
    expectCountyEvidenceLinksAbsent();
    expect({
      county: edited.includes("county=08001"),
      editedPair: edited.includes("08013"),
      returnTarget: screen.getByTestId("compare-workspace").dataset.return,
    }).toStrictEqual({
      county: true,
      editedPair: true,
      returnTarget: "review",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Clear both counties" })
    );
    await waitForPair("");
    const cleared =
      screen.getByTestId("compare-workspace").dataset.explorerReturn ?? "";
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
      screen.getByTestId("compare-workspace").dataset.explorerReturn ?? "";
    expect({
      county: href.includes("county=08001"),
      pair: href.includes("compare=08001%2C36001"),
      path: href.includes("/explore") && href.includes("mode=evidence"),
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

  it("lists differing limitations per county and a shared limitation once, in What we don't know", async () => {
    countyLimitationOverrides.set(COMPARE_LEFT_FIPS, "Denver coverage gap.");
    countyLimitationOverrides.set("36001", "Albany coverage gap.");
    renderCompare("?compare=08001,36001&scope=CO&dataset=alpha-2026");
    const unknown = await screen.findByTestId("compare-unknown");
    const differing = {
      first: within(unknown).getByTestId(
        `compare-limitation-${COMPARE_LEFT_FIPS}`
      ).textContent,
      second: within(unknown).getByTestId("compare-limitation-36001")
        .textContent,
      sharedNote: screen.queryByTestId("compare-shared-limitation"),
    };
    cleanup();

    countyLimitationOverrides.set(
      COMPARE_LEFT_FIPS,
      "Same release limitation."
    );
    countyLimitationOverrides.set("36001", "Same release limitation.");
    renderCompare("?compare=08001,36001&scope=CO&dataset=alpha-2026");
    const shared = await screen.findByTestId("compare-shared-limitation");
    expect({
      differing,
      perCountyWhenShared: screen.queryByTestId(
        `compare-limitation-${COMPARE_LEFT_FIPS}`
      ),
      sharedInUnknown: screen.getByTestId("compare-unknown").contains(shared),
      sharedText: shared.textContent,
    }).toStrictEqual({
      differing: {
        first: "Denver coverage gap.",
        second: "Albany coverage gap.",
        sharedNote: null,
      },
      perCountyWhenShared: null,
      sharedInUnknown: true,
      sharedText: expect.stringContaining("Same release limitation."),
    });
  });

  it("does not show a county-record table until two counties are selected", async () => {
    renderCompare("?compare=08001&scope=CO&dataset=alpha-2026");
    await waitForPair("08001");
    expect(screen.queryByTestId("compare-profile")).toBeNull();
    expect(screen.queryByTestId("compare-profile-loading")).toBeNull();
  });

  it("aligns the published county record and hands the pair to Ask Atlas", async () => {
    renderCompare(
      "?compare=08001,08013&scope=CO&dataset=alpha-2026&period=1999-01-01"
    );
    await waitForPair("08001,08013");
    const floor = await screen.findByTestId(
      "compare-profile-cell-human_case_floor-08001"
    );
    const missing = screen.getByTestId(
      "compare-profile-cell-human_case_floor-08013"
    );
    const ask = await screen.findByTestId("compare-ask-atlas");
    expect({
      ask: Boolean(
        ask.getAttribute("href")?.includes("/askatlas") &&
        !ask.getAttribute("href")?.includes("page_ref=")
      ),
      evidenceLinks: document.querySelector(
        "[data-testid^='compare-investigate-']"
      ),
      floor: floor.textContent?.includes("12"),
      missing: missing.dataset.observation,
      missingDigits: /\d/.test(
        missing.querySelector(".ux-reset-compare-missing")?.textContent ?? ""
      ),
      period: screen
        .getByTestId("compare-profile-comparability")
        .textContent?.includes("1999-01-01"),
    }).toStrictEqual({
      ask: true,
      evidenceLinks: null,
      floor: true,
      missing: "missing",
      missingDigits: false,
      period: true,
    });
  });

  it("leaves a direct link usable when return is absent or invalid", async () => {
    const direct = renderCompare("?compare=08001,08013&scope=CO");
    await waitForPair("08001,08013");
    expect({
      pairIssue: screen.getByTestId("compare-workspace").dataset.return,
      returnButton: screen.queryByTestId("compare-return"),
      returnLink: screen.queryByRole("link", { name: "Return to Explorer" }),
    }).toStrictEqual({
      pairIssue: "",
      returnButton: null,
      returnLink: null,
    });
    direct.unmount();

    renderCompare("?compare=08001,not-a-fips&return=assistant");
    await waitForPair("08001");
    expect({
      empty: screen.getByTestId("compare-empty").textContent,
      pairIssue: screen.getByTestId("compare-workspace").dataset.pairIssue,
      returnButton: screen.queryByTestId("compare-return"),
      returnLink: screen.queryByRole("link", { name: "Return to Explorer" }),
    }).toStrictEqual({
      empty: expect.stringContaining("second county"),
      pairIssue: "invalid",
      returnButton: null,
      returnLink: null,
    });
  });
});

function observationCell(measureId: string, fips: string) {
  return screen.getByTestId(`compare-cell-${measureId}-${fips}`);
}

function handleRetryProfile() {}

function renderProfileSection(detail: ReturnType<typeof compareCountyDetail>) {
  const alignment = alignCompareCountyProfiles({
    left: { detail, status: "ready" },
    leftFips: detail.fips,
    right: {
      detail: compareCountyDetail(COMPARE_RIGHT_FIPS),
      status: "ready",
    },
    rightFips: COMPARE_RIGHT_FIPS,
  });
  render(
    <CompareCountyProfileSection
      alignment={alignment}
      error={null}
      leftLabel="Denver, Colorado (08001)"
      loading={false}
      period={null}
      retrying={false}
      rightLabel="Boulder, Colorado (08013)"
      onRetry={handleRetryProfile}
    />
  );
}

describe("published county profile section", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders unavailable and unfamiliar priorities without a lower category", () => {
    const absent = ["unknown", "Unavailable", "missing", "suppressed"] as const;
    const displays = absent.map((priority) => {
      const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
      detail.priority = priority;
      renderProfileSection(detail);
      const display =
        within(
          screen.getByTestId(
            `compare-profile-cell-review_category-${COMPARE_LEFT_FIPS}`
          )
        ).getByTestId("evidence-display-value").textContent ?? "";
      cleanup();
      return display;
    });
    const unfamiliar = compareCountyDetail(COMPARE_LEFT_FIPS);
    unfamiliar.priority = "Priority 3 — Review";
    renderProfileSection(unfamiliar);
    const unfamiliarDisplay =
      within(
        screen.getByTestId(
          `compare-profile-cell-review_category-${COMPARE_LEFT_FIPS}`
        )
      ).getByTestId("evidence-display-value").textContent ?? "";
    cleanup();
    const numbered = compareCountyDetail(COMPARE_LEFT_FIPS);
    numbered.priority = "Priority 10 — Review";
    renderProfileSection(numbered);
    const priority10 =
      within(
        screen.getByTestId(
          `compare-profile-cell-review_category-${COMPARE_LEFT_FIPS}`
        )
      ).getByTestId("evidence-display-value").textContent ?? "";
    cleanup();
    const mixed = compareCountyDetail(COMPARE_LEFT_FIPS);
    mixed.priority = "Lower — Priority 10";
    renderProfileSection(mixed);
    const lowerWithPriority10 =
      within(
        screen.getByTestId(
          `compare-profile-cell-review_category-${COMPARE_LEFT_FIPS}`
        )
      ).getByTestId("evidence-display-value").textContent ?? "";
    expect({
      displays,
      lowerWithPriority10,
      priority10,
      unfamiliar: unfamiliarDisplay,
    }).toStrictEqual({
      displays: ["Unavailable", "Unavailable", "Unavailable", "Suppressed"],
      lowerWithPriority10: "Lower — Priority 10",
      priority10: "Priority 10 — Review",
      unfamiliar: "Priority 3 — Review",
    });
  });

  it("renders a small minimum reported incidence without rounding it to zero", () => {
    const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
    detail.incidence_floor_2023 = 0.04;
    renderProfileSection(detail);
    const incidence = within(
      screen.getByTestId(
        `compare-profile-cell-incidence_floor-${COMPARE_LEFT_FIPS}`
      )
    ).getByTestId("evidence-display-value");
    const reasons = screen.getByTestId(
      `compare-profile-cell-review_reasons-${COMPARE_LEFT_FIPS}`
    );
    const section =
      screen.getByTestId("compare-profile-section").textContent ?? "";
    expect(incidence.textContent).toBe(
      "At least 0.04 reported cases per 100,000 residents."
    );
    expect(reasons.textContent).toContain(incidence.textContent);
    expect(reasons.textContent).not.toContain("0.0 cases");
    expect(section).not.toContain("0.0 cases");
  });

  it("does not repeat a rejected negative floor in the section", () => {
    const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
    detail.case_count_floor_2023 = 12;
    detail.incidence_floor_2023 = -4;
    renderProfileSection(detail);
    const section =
      screen.getByTestId("compare-profile-section").textContent ?? "";
    const count = within(
      screen.getByTestId(
        `compare-profile-cell-human_case_floor-${COMPARE_LEFT_FIPS}`
      )
    ).getByTestId("evidence-display-value");
    const incidence = within(
      screen.getByTestId(
        `compare-profile-cell-incidence_floor-${COMPARE_LEFT_FIPS}`
      )
    ).getByTestId("evidence-display-value");
    const reasons = screen.getByTestId(
      `compare-profile-cell-review_reasons-${COMPARE_LEFT_FIPS}`
    );
    expect({
      count: count.textContent,
      deniesCount: reasons.textContent?.includes(
        "No county-level 2023 Lyme case count was published"
      ),
      incidence: incidence.textContent,
      repeatsRate: section.includes("-4"),
      showsCount: reasons.textContent?.includes("Reported cases: 12 or more"),
    }).toStrictEqual({
      count: "Reported cases: 12 or more",
      deniesCount: false,
      incidence: "Unavailable",
      repeatsRate: false,
      showsCount: true,
    });
  });

  it("keeps a published case count when incidence is null", () => {
    const detail = compareCountyDetail(COMPARE_LEFT_FIPS);
    detail.case_count_floor_2023 = 12;
    detail.incidence_floor_2023 = null;
    renderProfileSection(detail);
    const count = within(
      screen.getByTestId(
        `compare-profile-cell-human_case_floor-${COMPARE_LEFT_FIPS}`
      )
    ).getByTestId("evidence-display-value");
    const incidence = within(
      screen.getByTestId(
        `compare-profile-cell-incidence_floor-${COMPARE_LEFT_FIPS}`
      )
    ).getByTestId("evidence-display-value");
    const reasons = screen.getByTestId(
      `compare-profile-cell-review_reasons-${COMPARE_LEFT_FIPS}`
    );
    expect(count.textContent).toBe("Reported cases: 12 or more");
    expect(incidence.textContent).toBe("Unavailable");
    expect(reasons.textContent).toContain("Reported cases: 12 or more");
    expect(reasons.textContent).not.toContain(
      "No county-level 2023 Lyme case count was published"
    );
  });
});
