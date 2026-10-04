import { describe, expect, it, vi } from "vitest";

import { identityFromPublishedCounty } from "@/features/ux-reset/investigate/county-evidence";
import {
  INVESTIGATE_OBSERVATION_CONCURRENCY,
  loadCountyEvidenceBundle,
} from "@/features/ux-reset/investigate/load-county-evidence";
import type { Measure } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  INVESTIGATE_RELEASE_ID,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const calls: string[] = [];
let inFlight = 0;
let maxInFlight = 0;
const transientRemaining = new Map<string, number>();

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      const measureId = params.measure_id;
      calls.push(measureId);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const remaining = transientRemaining.get(measureId) ?? 0;
      if (remaining > 0) {
        transientRemaining.set(measureId, remaining - 1);
        throw new AtlasApiError(
          "rate limited",
          "/v1/observations",
          429,
          null,
          0
        );
      }
      return {
        data: {
          data: investigateObservationsFor({
            fips: "08001",
            measureId: "reported-cases",
            scenario: "sparse",
          }).map((observation) => ({
            ...observation,
            measure_id: measureId,
            observation_id: `obs-${measureId}`,
          })),
          links: { self: "/v1/observations" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
  };
});

function measures(count: number): Measure[] {
  return Array.from({ length: count }, (_, index) => ({
    ...(investigateMeasuresFixture[0] as Measure),
    measure_id: `measure-${index}`,
  }));
}

describe("county evidence loading", () => {
  it("limits concurrent reads and retries a rate limit", async () => {
    calls.length = 0;
    inFlight = 0;
    maxInFlight = 0;
    transientRemaining.clear();
    transientRemaining.set("measure-0", 1);
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    const bundle = await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(7),
      period: null,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect({
      failures: bundle.measureFailures.length,
      maxInFlight,
      observations: bundle.unassigned.length,
      retried: calls.filter((measureId) => measureId === "measure-0").length,
    }).toStrictEqual({
      failures: 0,
      maxInFlight: INVESTIGATE_OBSERVATION_CONCURRENCY,
      observations: 7,
      retried: 2,
    });
  });
});
