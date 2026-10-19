import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentalContextSection } from "@/features/ux-reset/review/environmental-context-section";
import type { ObservationsV1ObservationsGetParams } from "@/generated/models";
import { ValueState } from "@/generated/models";
import { ObservationsV1ObservationsGetResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  ENVIRONMENTAL_RELEASE_ID,
  ENVIRONMENTAL_SAMPLE_DATE,
  ENVIRONMENTAL_SAMPLE_FIPS,
  environmentalEnvelope,
  environmentalObservation,
} from "./fixtures/environmental-context";

const observationsGet = vi.hoisted(() =>
  vi.fn<typeof import("@/generated/atlas").observationsV1ObservationsGet>()
);

vi.mock(import("@/generated/atlas"), async () => {
  const actual =
    await vi.importActual<typeof import("@/generated/atlas")>(
      "@/generated/atlas"
    );
  return {
    ...actual,
    observationsV1ObservationsGet: observationsGet,
  };
});

const SAMPLE_MEASURES = [
  "nclimgrid_prcp_county_day",
  "nclimgrid_tmin_county_day",
  "nclimgrid_tmax_county_day",
  "nclimgrid_tavg_county_day",
] as const;

type SampleMeasureId = (typeof SAMPLE_MEASURES)[number];

function isSampleMeasure(value: string): value is SampleMeasureId {
  return SAMPLE_MEASURES.some((measureId) => measureId === value);
}

function parsedEnvelope(rows: ReturnType<typeof environmentalObservation>[]) {
  return ObservationsV1ObservationsGetResponse.parse(
    environmentalEnvelope(rows)
  );
}

function sectionElement(props: {
  fips?: string | null;
  releaseId?: string | null;
  releaseLoading?: boolean;
}) {
  return (
    <EnvironmentalContextSection
      fips={props.fips === undefined ? ENVIRONMENTAL_SAMPLE_FIPS : props.fips}
      releaseId={
        props.releaseId === undefined
          ? ENVIRONMENTAL_RELEASE_ID
          : props.releaseId
      }
      releaseLoading={props.releaseLoading ?? false}
    />
  );
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
  const view = render(
    <QueryClientProvider client={client}>
      {sectionElement(props)}
    </QueryClientProvider>
  );
  return {
    ...view,
    rerenderSection(next: typeof props) {
      view.rerender(
        <QueryClientProvider client={client}>
          {sectionElement(next)}
        </QueryClientProvider>
      );
    },
  };
}

describe("environmental context section", () => {
  afterEach(() => {
    cleanup();
    observationsGet.mockReset();
  });

  it("shows the four January measures for the selected county", async () => {
    observationsGet.mockImplementation(
      async (params: ObservationsV1ObservationsGetParams) => {
        const measureId = params.measure_id;
        if (!isSampleMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([
            environmentalObservation({
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
    await screen.findByText("0.0 mm");
    const requestedFips = observationsGet.mock.calls.map((call) =>
      call[0]?.geography_id?.join(",")
    );
    const dateInput = screen.getByLabelText(/Observation date/);
    expect({
      average: screen
        .getByTestId("environmental-measure-nclimgrid_tavg_county_day")
        .textContent?.includes("7.153611977327104 °C"),
      date: dateInput instanceof HTMLInputElement ? dateInput.value : "",
      fips: requestedFips.join("|"),
      heading: screen.getByRole("heading", { name: "Environmental context" })
        .textContent,
      maximum: screen
        .getByTestId("environmental-measure-nclimgrid_tmax_county_day")
        .textContent?.includes("16.29939307942125 °C"),
      minimum: screen
        .getByTestId("environmental-measure-nclimgrid_tmin_county_day")
        .textContent?.includes("-1.992294192037333 °C"),
      convention: screen
        .getByTestId("environmental-measure-nclimgrid_prcp_county_day")
        .textContent?.includes("early morning"),
      precipitation: screen
        .getByTestId("environmental-measure-nclimgrid_prcp_county_day")
        .textContent?.includes("0.0 mm"),
    }).toStrictEqual({
      average: true,
      date: ENVIRONMENTAL_SAMPLE_DATE,
      fips: [
        ENVIRONMENTAL_SAMPLE_FIPS,
        ENVIRONMENTAL_SAMPLE_FIPS,
        ENVIRONMENTAL_SAMPLE_FIPS,
        ENVIRONMENTAL_SAMPLE_FIPS,
      ].join("|"),
      convention: true,
      heading: "Environmental context",
      maximum: true,
      minimum: true,
      precipitation: true,
    });
  });

  it("drops the previous county while the next county is still loading", async () => {
    const pending = new Map<string, () => void>();
    observationsGet.mockImplementation(
      async (
        params: ObservationsV1ObservationsGetParams,
        init?: RequestInit
      ) => {
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
        if (!isSampleMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        const value =
          fips === "48029" && measureId === "nclimgrid_prcp_county_day"
            ? "4.5"
            : undefined;
        return {
          data: parsedEnvelope([
            environmentalObservation({
              fips,
              measureId,
              value,
              valueState: value === undefined ? undefined : ValueState.OBSERVED,
            }),
          ]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    const view = renderSection();
    expect(
      screen.getByTestId("environmental-measure-nclimgrid_prcp_county_day")
    ).toHaveAttribute("data-status", "loading");
    view.rerenderSection({ fips: "48029" });
    for (const [key, finish] of pending) {
      if (key.startsWith(ENVIRONMENTAL_SAMPLE_FIPS)) {
        finish();
      }
    }
    expect({
      county: screen.getByTestId("explorer-environmental-context").dataset
        .county,
      status: screen.getByTestId(
        "environmental-measure-nclimgrid_prcp_county_day"
      ).dataset.status,
      zero: screen.queryByText("0.0 mm"),
    }).toStrictEqual({
      county: "48029",
      status: "loading",
      zero: null,
    });
    for (const [key, finish] of pending) {
      if (key.startsWith("48029")) {
        finish();
      }
    }
    await screen.findByText("4.5 mm");
    expect(screen.queryByText("0.0 mm")).not.toBeInTheDocument();
  });

  it("clears the previous day when the date changes", async () => {
    observationsGet.mockImplementation(
      async (params: ObservationsV1ObservationsGetParams) => {
        const measureId = params.measure_id;
        if (!isSampleMeasure(measureId) || params.start_date === "2025-01-18") {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([environmentalObservation({ measureId })]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    renderSection();
    await screen.findByText("0.0 mm");
    fireEvent.change(screen.getByLabelText(/Observation date/), {
      target: { value: "2025-01-18" },
    });
    await waitFor(() => {
      expect({
        absent: screen.getAllByText(/No governed observation was returned/i)
          .length,
        zero: screen.queryByText("0.0 mm"),
      }).toStrictEqual({ absent: 4, zero: null });
    });
  });

  it("keeps a failed measure distinct from a loaded zero", async () => {
    observationsGet.mockImplementation(
      async (params: ObservationsV1ObservationsGetParams) => {
        if (params.measure_id === "nclimgrid_tmin_county_day") {
          throw new AtlasApiError(
            "Environmental context could not be loaded.",
            "/v1/observations",
            503,
            null
          );
        }
        const measureId = params.measure_id;
        if (!isSampleMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([environmentalObservation({ measureId })]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    renderSection();
    await screen.findByText("0.0 mm");
    await screen.findByRole("button", { name: "Retry Minimum temperature" });
    expect({
      partial: screen.getByText(/Some environmental measures did not load/)
        .textContent,
      temperature: screen.queryByText("-1.992294192037333 °C"),
    }).toStrictEqual({
      partial: expect.not.stringContaining("not zero"),
      temperature: null,
    });
  });

  it("explains an unsupported day without requesting it", async () => {
    observationsGet.mockImplementation(
      async (params: ObservationsV1ObservationsGetParams) => {
        const measureId = params.measure_id;
        if (!isSampleMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([environmentalObservation({ measureId })]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    renderSection();
    await screen.findByText("0.0 mm");
    observationsGet.mockClear();
    fireEvent.change(screen.getByLabelText(/Observation date/), {
      target: { value: "2024-12-31" },
    });
    expect({
      calls: observationsGet.mock.calls.length,
      explanation: screen.getAllByText(
        /outside the supported January 2025 coverage/
      ).length,
      zero: screen.queryByText("0.0 mm"),
    }).toStrictEqual({
      calls: 0,
      explanation: 2,
      zero: null,
    });
  });

  it("shows out-of-coverage metadata separately from precipitation zero", async () => {
    observationsGet.mockImplementation(
      async (params: ObservationsV1ObservationsGetParams) => {
        const measureId = params.measure_id;
        if (!isSampleMeasure(measureId)) {
          return {
            data: parsedEnvelope([]),
            headers: new Headers(),
            status: 200,
          };
        }
        return {
          data: parsedEnvelope([
            environmentalObservation({
              coverage: "OUT_OF_SOURCE_COVERAGE",
              fips: "08001",
              measureId,
              value: null,
              valueState: ValueState.UNAVAILABLE,
            }),
          ]),
          headers: new Headers(),
          status: 200,
        };
      }
    );
    renderSection({ fips: "08001" });
    await screen.findAllByText("Out of source coverage");
    expect({
      coverage: screen.getAllByText("Out of source coverage").length,
      reason:
        screen.getAllByText(/Outside environmental source coverage/).length >=
        4,
      unavailable: screen.getAllByText("Unavailable").length > 0,
      zero: screen.queryByText("0.0 mm"),
    }).toStrictEqual({
      coverage: 4,
      reason: true,
      unavailable: true,
      zero: null,
    });
  });
});
