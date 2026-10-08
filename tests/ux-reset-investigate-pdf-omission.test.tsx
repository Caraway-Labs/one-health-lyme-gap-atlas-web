import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { identityFromPublishedCounty } from "@/features/ux-reset/investigate/county-evidence";
import { investigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import {
  clearObservationRetryDeadlines,
  loadCountyEvidenceBundle,
} from "@/features/ux-reset/investigate/load-county-evidence";
import type { Measure } from "@/generated/models";

import {
  INVESTIGATE_RELEASE_ID,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const observationCalls: string[] = [];

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      observationCalls.push(params.measure_id);
      const rows =
        params.measure_id === "reported-cases"
          ? investigateObservationsFor({
              fips: "08001",
              measureId: "reported-cases",
              scenario: "sparse",
            })
          : [];
      return {
        data: {
          data: rows,
          links: { self: "/v1/observations" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
  };
});

function measure(
  measureId: string,
  temporal: { grains: string[]; semantics: string }
): Measure {
  return {
    ...(investigateMeasuresFixture[0] as Measure),
    label: measureId,
    measure_id: measureId,
    temporal_grains: temporal.grains,
    temporal_semantics: temporal.semantics,
  };
}

const requestedMeasures = [
  measure("reported-cases", { grains: ["YEAR"], semantics: "2023" }),
  measure("population_2022", {
    grains: ["YEAR"],
    semantics: "2018-2022 ACS",
  }),
  measure("daily_weather", { grains: ["DAY"], semantics: "DAY" }),
  measure("empty-cases", { grains: ["YEAR"], semantics: "2023" }),
];

async function loadSelection() {
  const identity = identityFromPublishedCounty({
    county: "Denver",
    fips: "08001",
    state: "CO",
  });
  if (!identity) throw new Error("Missing county identity");
  return loadCountyEvidenceBundle({
    domainsRequestFailed: false,
    fips: "08001",
    identity,
    indicators: [],
    measures: requestedMeasures,
    period: null,
    releaseId: INVESTIGATE_RELEASE_ID,
    signal: new AbortController().signal,
  });
}

describe("Investigate PDF omission wording", () => {
  afterEach(() => {
    cleanup();
    observationCalls.length = 0;
    clearObservationRetryDeadlines();
  });

  it("does not query an unsupported period and still exports the other measures", async () => {
    const bundle = await loadSelection();
    render(
      <InvestigatePdfExport context={investigatePdfContext(bundle, null)} />
    );
    const omitted = screen.getByTestId("investigate-pdf-omitted").textContent ?? "";
    expect({
      button: screen.queryByRole("button", { name: "Export PDF" }),
      daily: omitted.includes(
        "daily_weather. This measure's observation period is not supported for this selection."
      ),
      included: screen.getByTestId("investigate-pdf-included").textContent,
      population: omitted.includes(
        "population_2022. This measure's observation period is not supported for this selection."
      ),
      publishedAbsence: omitted.includes("No published data"),
      requests: [...observationCalls].sort(),
    }).toStrictEqual({
      button: expect.anything(),
      daily: true,
      included: expect.stringContaining("reported-cases"),
      population: true,
      publishedAbsence: false,
      requests: ["empty-cases", "reported-cases"],
    });
  });

  it("describes a queried empty response for the selected county and period", async () => {
    const bundle = await loadSelection();
    render(
      <InvestigatePdfExport context={investigatePdfContext(bundle, null)} />
    );
    const omitted = screen.getByTestId("investigate-pdf-omitted").textContent ?? "";
    expect({
      emptyReason: omitted.includes(
        "empty-cases. No observations were returned for this county and selected period."
      ),
      releaseAbsence: omitted.includes("No published data for this release."),
      requested: observationCalls.includes("empty-cases"),
    }).toStrictEqual({
      emptyReason: true,
      releaseAbsence: false,
      requested: true,
    });
  });
});
