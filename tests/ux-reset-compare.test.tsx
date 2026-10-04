import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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

import { compareObservationRequestRejection } from "@/features/ux-reset/compare/load-compare-evidence";
import { ResetCompareExperience } from "@/features/ux-reset/compare/reset-compare-experience";

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

function renderCompare(search: string) {
  setSearch(search);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
    observationRequests.length = 0;
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

  it("drops the compare list when handing one county to Investigate", async () => {
    renderCompare("?compare=08001,08013&scope=CO&dataset=alpha-2026");
    await screen.findByTestId(`compare-row-${COMPARE_CASES_MEASURE_ID}`);
    const investigate = screen
      .getByTestId("compare-investigate-08001")
      .getAttribute("href");
    expect(investigate).not.toContain("compare=");
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
});
