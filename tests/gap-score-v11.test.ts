import { describe, expect, it } from "vitest";

import {
  adjustCountyScenarios,
  SCENARIO_SCORE_DEFAULTS,
  scoreCounty,
} from "../src/features/ux-reset/review/explorer-scenario-score";
import type { CountyScoreSummary } from "../src/generated/models";
import { ScoresV1AtlasScoresGetResponse } from "../src/generated/zod/atlas";
import { validateApiResponse } from "../src/lib/api-response-validation";
import fixtures from "./fixtures/gap-score-v11-parity.json";

describe("Surveillance Gap Score v1.1 Python/TypeScript/research parity", () => {
  it("matches every authoritative county and component with actual source inputs", () => {
    expect(fixtures).toHaveLength(3144);
    for (const { inputs, expected, research_score } of fixtures) {
      const actual = scoreCounty(
        {
          burgdorferiStatus: inputs.burgdorferi_status,
          humanStatus: inputs.human_status,
          incidenceFloor2023: inputs.incidence_floor_2023,
          inContiguousTickScope: inputs.in_contiguous_tick_scope,
          rucc2023: inputs.rucc_2023,
          sviPercentile: inputs.svi_percentile,
          tickStatus: inputs.tick_status,
          uninsuredPercentile: inputs.uninsured_percentile,
        },
        SCENARIO_SCORE_DEFAULTS
      );
      expect(actual.score).toBe(expected.score);
      expect(actual.humanWeakness).toBe(expected.human_weakness);
      expect(actual.community).toBe(expected.community);
      expect(actual.score).toBe(research_score ?? expected.score);
    }
  });

  it("never accepts a legacy or missing scoring method as v1.1", () => {
    expect(() =>
      validateApiResponse("Atlas scores", ScoresV1AtlasScoresGetResponse, {
        counties: [],
        settings: {},
        methodology_version: "semantic-2.0.0",
      })
    ).toThrow(/could not be verified/);
  });

  it("uses published incidence, including high New England floors, never an inverted H", () => {
    const fixture = fixtures.find((item) => item.inputs.fips === "25007");
    expect(fixture).toBeDefined();
    if (!fixture) throw new Error("Dukes fixture missing");
    const county: CountyScoreSummary = {
      ...fixture.inputs,
      county: "Dukes",
      state: "MA",
      state_name: "Massachusetts",
      evidence_completeness: 100,
      priority: "Lower Atlas priority — Not a safety finding",
      color: "#a9d2db",
      score: fixture.expected,
      scoring_methodology_version: "surveillance-gap-score-v1.1",
    };
    const result = adjustCountyScenarios([county], {
      ...SCENARIO_SCORE_DEFAULTS,
      smooth_k: 100,
    });
    expect(result?.get("25007")?.kind).toBe("adjusted");
    const missing = { ...county, incidence_floor_2023: undefined };
    expect(
      adjustCountyScenarios([missing], {
        ...SCENARIO_SCORE_DEFAULTS,
        smooth_k: 100,
      })?.get("25007")?.kind
    ).toBe("limited");
  });
});
