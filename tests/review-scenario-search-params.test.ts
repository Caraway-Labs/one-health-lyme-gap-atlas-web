import { describe, expect, it } from "vitest";

import { SCENARIO_CONTROL_RANGES } from "@/features/ux-reset/review/explorer-scenario-score";
import {
  parseScenarioAssumption,
  reviewSearchParams,
  scenarioSearchParamPatch,
} from "@/features/ux-reset/review/review-search-params";

describe("Review scenario URL params", () => {
  it("resets legacy breakpoint URLs without reinterpreting the old value as k", () => {
    expect(
      scenarioSearchParamPatch(
        new URLSearchParams("breakpoint=10&eco=85&missing=40")
      )
    ).toStrictEqual({ breakpoint: null, eco: 65, smooth: 50, missing: 75 });
  });

  it("accepts slider steps and rejects values off the range", () => {
    const eco = SCENARIO_CONTROL_RANGES.ecological_share;
    expect(parseScenarioAssumption("40", eco)).toBe(40);
    expect(parseScenarioAssumption("65", eco)).toBe(65);
    expect(parseScenarioAssumption("39", eco)).toBeNull();
    expect(parseScenarioAssumption("41", eco)).toBeNull();
    expect(parseScenarioAssumption("40.0", eco)).toBeNull();
  });

  it("parses the three Review keys through the route parsers", () => {
    expect(reviewSearchParams.missing.parse("40")).toBe(40);
    expect(reviewSearchParams.missing.parse("41")).toBeNull();
    expect(reviewSearchParams.smooth.parse("20")).toBe(20);
    expect(reviewSearchParams.smooth.parse("4")).toBeNull();
    expect(reviewSearchParams.eco.parse("85")).toBe(85);
  });

  it("rewrites invalid and default scenario params and keeps a real adjustment", () => {
    expect(
      scenarioSearchParamPatch(
        new URLSearchParams("scope=CO&missing=41&eco=39&smooth=20")
      )
    ).toStrictEqual({ eco: 65, missing: 75 });
    expect(
      scenarioSearchParamPatch(new URLSearchParams("missing=40&eco=65"))
    ).toStrictEqual({ eco: 65 });
    expect(
      scenarioSearchParamPatch(new URLSearchParams("scope=CO&missing=40"))
    ).toBeNull();
  });

  it("canonicalizes a padded integer", () => {
    expect(
      scenarioSearchParamPatch(new URLSearchParams("missing=040"))
    ).toStrictEqual({ missing: 40 });
  });
});
