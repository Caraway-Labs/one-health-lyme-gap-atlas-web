import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { populationRuralityMeasureIds } from "@/features/ux-reset/review/population-rurality-context";
import { PopulationRuralityContextSection } from "@/features/ux-reset/review/population-rurality-context-section";
import type { ListObservationsParams } from "@/generated/models";
import { ValueState } from "@/generated/models";
import { ListObservationsResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  POPULATION_RURALITY_RELEASE_ID,
  POPULATION_RURALITY_SAMPLE_FIPS,
  populationRuralityEnvelope,
  populationRuralityObservation,
  type PopulationRuralityFixtureMeasureId,
} from "./fixtures/population-rurality-context";

const observationsGet = vi.hoisted(() =>
  vi.fn<typeof import("@/generated/atlas").listObservations>()
);

vi.mock(import("@/generated/atlas"), async () => {
  const actual =
    await vi.importActual<typeof import("@/generated/atlas")>(
      "@/generated/atlas"
    );
  return {
    ...actual,
    listObservations: observationsGet,
  };
});

function isFixtureMeasure(
  value: string
): value is PopulationRuralityFixtureMeasureId {
  return populationRuralityMeasureIds.some((measureId) => measureId === value);
}

function parsedEnvelope(
  rows: ReturnType<typeof populationRuralityObservation>[]
) {
  return ListObservationsResponse.parse(populationRuralityEnvelope(rows));
}

function renderSection(
  props: {
    fips?: string | null;
    releaseId?: string | null;
    releaseLoading?: boolean;
  } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const fips =
    props.fips === undefined ? POPULATION_RURALITY_SAMPLE_FIPS : props.fips;
  const releaseId =
    props.releaseId === undefined
      ? POPULATION_RURALITY_RELEASE_ID
      : props.releaseId;
  const view = render(
    <QueryClientProvider client={client}>
      <PopulationRuralityContextSection
        fips={fips}
        releaseId={releaseId}
        releaseLoading={props.releaseLoading ?? false}
      />
    </QueryClientProvider>
  );
  return {
    ...view,
    rerenderSection(next: typeof props) {
      view.rerender(
        <QueryClientProvider client={client}>
          <PopulationRuralityContextSection
            fips={next.fips === undefined ? fips : next.fips}
            releaseId={
              next.releaseId === undefined ? releaseId : next.releaseId
            }
            releaseLoading={next.releaseLoading ?? false}
          />
        </QueryClientProvider>
      );
    },
  };
}

describe("population and rurality section", () => {
  afterEach(() => {
    cleanup();
    observationsGet.mockReset();
  });

  it("shows the five shipped measures for the selected county", async () => {
    observationsGet.mockImplementation(
      async (params: ListObservationsParams) => {
        const measureId = params.measure_id;
        if (!isFixtureMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([
            populationRuralityObservation({
              fips: params.geography_id[0],
              measureId,
            }),
          ]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    renderSection();
    await screen.findByText("520,149 people");
    const requested = observationsGet.mock.calls.map((call) => call[0]);
    expect({
      dates: requested.some(
        (params) =>
          params?.start_date != null ||
          params?.end_date != null ||
          params?.year != null
      ),
      heading: screen.getByRole("heading", {
        name: "Population & Rurality Context",
      }).textContent,
      measures: requested.map((params) => params?.measure_id).sort(),
      percent: screen
        .getByTestId("population-rurality-measure-uninsured_percent_2022")
        .textContent?.includes("10.8 percent"),
      percentile: screen
        .getByTestId("population-rurality-measure-uninsured_percentile_2022")
        .textContent?.includes("0.6742 percentile"),
      rurality: screen
        .getByTestId("population-rurality-measure-rucc_2023")
        .textContent?.includes("Classification vintage 2023"),
      provenanceHidden: (() => {
        const nodes = screen.queryAllByText("Provenance reference");
        return (
          nodes.length === 5 &&
          nodes.every((node) => node.closest("details") !== null)
        );
      })(),
      vintages: requested.map((params) => params?.vintage_year).sort(),
    }).toStrictEqual({
      dates: false,
      heading: "Population & Rurality Context",
      measures: [...populationRuralityMeasureIds].sort(),
      percent: true,
      percentile: true,
      rurality: true,
      provenanceHidden: true,
      vintages: [2022, 2022, 2022, 2022, 2023],
    });
  });

  it("drops the previous county while the next county is still loading", async () => {
    const pending = new Map<string, () => void>();
    observationsGet.mockImplementation(
      async (params: ListObservationsParams, init?: RequestInit) => {
        const fips = params.geography_id[0] ?? "";
        const measureId = params.measure_id;
        const gate = Promise.withResolvers<boolean>();
        pending.set(`${fips}:${measureId}`, () => {
          if (init?.signal?.aborted) {
            gate.reject(new DOMException("cancelled", "AbortError"));
            return;
          }
          gate.resolve(true);
        });
        init?.signal?.addEventListener("abort", () => {
          gate.reject(new DOMException("cancelled", "AbortError"));
        });
        await gate.promise;
        if (!isFixtureMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([
            populationRuralityObservation({
              fips,
              measureId,
              value: fips === "08013" ? 1 : undefined,
              valueState:
                fips === "08013" && measureId === "population_2022"
                  ? ValueState.OBSERVED
                  : undefined,
            }),
          ]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    const view = renderSection();
    expect(
      screen.getByTestId("population-rurality-measure-population_2022")
    ).toHaveAttribute("data-status", "loading");
    view.rerenderSection({ fips: "08013" });
    for (const [key, finish] of pending) {
      if (key.startsWith(POPULATION_RURALITY_SAMPLE_FIPS)) {
        finish();
      }
    }
    expect({
      county: screen.getByTestId("explorer-population-rurality").dataset.county,
      people: screen.queryByText("520,149 people"),
      status: screen.getByTestId("population-rurality-measure-population_2022")
        .dataset.status,
    }).toStrictEqual({
      county: "08013",
      people: null,
      status: "loading",
    });
    for (const [key, finish] of pending) {
      if (key.startsWith("08013")) {
        finish();
      }
    }
    await screen.findByText("1 people");
    expect(screen.queryByText("520,149 people")).not.toBeInTheDocument();
  });

  it("keeps a failed measure distinct from a loaded zero", async () => {
    observationsGet.mockImplementation(
      async (params: ListObservationsParams) => {
        if (params.measure_id === "svi_percentile_2022") {
          throw new AtlasApiError(
            "Population and rurality context could not be loaded.",
            "/v1/observations",
            503,
            null
          );
        }
        const measureId = params.measure_id;
        if (!isFixtureMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        const zero = measureId === "uninsured_percent_2022";
        return {
          data: parsedEnvelope([
            populationRuralityObservation({
              measureId,
              value: zero ? 0 : undefined,
              valueState: zero ? ValueState.ZERO : undefined,
            }),
          ]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    renderSection();
    await screen.findByText("0 percent");
    await screen.findByRole("button", {
      name: "Retry Social vulnerability percentile",
    });
    expect(
      screen.getByText(/Some population and rurality measures did not load/)
        .textContent
    ).not.toContain("not zero");
    expect(screen.queryByText("0.7264 percentile")).not.toBeInTheDocument();
  });

  it("announces when every measure is absent", async () => {
    observationsGet.mockResolvedValue({
      data: parsedEnvelope([]),
      headers: new Headers(),
      status: 200,
    });
    renderSection();
    await expect(screen.findByRole("status")).resolves.toHaveTextContent(
      "No governed observations were returned."
    );
    expect(screen.queryAllByText(/absence is not zero/i)).toHaveLength(0);
    expect(
      screen.getAllByText(/No governed observation was returned/i)
    ).toHaveLength(5);
    expect(screen.queryByText("520,149 people")).not.toBeInTheDocument();
  });

  it("does not request observations without a release", async () => {
    renderSection({ releaseId: null, releaseLoading: false });
    await expect(
      screen.findAllByText(/No governed release is available/)
    ).resolves.toHaveLength(2);
    expect(observationsGet).not.toHaveBeenCalled();
  });
});
