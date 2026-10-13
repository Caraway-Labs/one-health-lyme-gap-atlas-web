import { describe, expect, it } from "vitest";

import {
  adjustCountyScenarios,
  priorityLabel,
  SCENARIO_SCORE_DEFAULTS,
  scoreCounty,
  type ScenarioCountyInputs,
} from "../src/features/ux-reset/review/explorer-scenario-score";
import type { CountyScoreSummary } from "../src/generated/models";

const adamsInputs: ScenarioCountyInputs = {
  burgdorferiStatus: "Present",
  humanStatus: "no_county_linked_record",
  inContiguousTickScope: true,
  incidenceFloor2023: null,
  rucc2023: 5,
  sviPercentile: 0.5,
  tickStatus: "Established",
  uninsuredPercentile: 0.5,
};

function summary(
  overrides: Partial<CountyScoreSummary> &
    Pick<CountyScoreSummary, "fips" | "score">
): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#55a8a3",
    county: "Sample County",
    evidence_completeness: 50,
    human_status: "no_county_linked_record",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    state: "CO",
    state_name: "Colorado",
    tick_status: "No records",
    ...overrides,
  };
}

describe(scoreCounty, () => {
  it("matches the shared scorer for a missing human record", () => {
    const score = scoreCounty(adamsInputs, SCENARIO_SCORE_DEFAULTS);

    expect(score.humanWeakness).toBe(75);
    expect(score.ecological).toBe(100);
    expect(score.community).toBe(50);
    expect(score.score).toBe(61.9);
    expect(priorityLabel(score.score)).toBe("Priority 2 — Review");
  });

  it("uses the published-record threshold and treats an unknown tick status as no positive signal", () => {
    const published = scoreCounty(
      {
        burgdorferiStatus: "No records",
        humanStatus: "published_count_floor",
        inContiguousTickScope: true,
        incidenceFloor2023: 10,
        rucc2023: null,
        sviPercentile: null,
        tickStatus: "No records",
        uninsuredPercentile: null,
      },
      SCENARIO_SCORE_DEFAULTS
    );
    const unknown = scoreCounty(
      {
        ...adamsInputs,
        burgdorferiStatus: "Unknown",
        tickStatus: "Unknown",
      },
      SCENARIO_SCORE_DEFAULTS
    );

    expect(published.humanWeakness).toBe(0);
    expect(unknown.tickSignal).toBe(0);
    expect(unknown.pathogenSignal).toBe(0);
  });

  it("keeps counties outside the contiguous tick scope on the boundary color", () => {
    const score = scoreCounty(
      { ...adamsInputs, inContiguousTickScope: false },
      SCENARIO_SCORE_DEFAULTS
    );

    expect(score.colorToken).toBe("var(--explorer-boundary)");
  });
});

describe(adjustCountyScenarios, () => {
  const missing = summary({
    county: "Conejos County",
    fips: "08021",
    score: {
      access_signal: 84.8,
      community: 87.3,
      ecological: 0,
      human_weakness: 75,
      pathogen_signal: 0,
      rural_signal: 100,
      score: 22.9,
      svi_signal: 83.8,
      tick_signal: 0,
    },
  });
  const published = summary({
    county: "Los Angeles County",
    fips: "06037",
    human_status: "published_count_floor",
    priority: "Priority 1 — Investigate",
    score: {
      access_signal: 55,
      community: 59.7,
      ecological: 100,
      human_weakness: 98.5,
      pathogen_signal: 100,
      rural_signal: 0,
      score: 84.6,
      svi_signal: 86.3,
      tick_signal: 100,
    },
    state: "CA",
    state_name: "California",
    tick_status: "Established",
  });
  const clamped = summary({
    county: "Sample County",
    fips: "08001",
    human_status: "published_count_floor",
    score: {
      access_signal: 0,
      community: 0,
      ecological: 0,
      human_weakness: 0,
      pathogen_signal: 0,
      rural_signal: 0,
      score: 0,
      svi_signal: 0,
      tick_signal: 0,
    },
  });

  it("leaves the governed score in place when the sliders match the collection", () => {
    expect(
      adjustCountyScenarios([missing], SCENARIO_SCORE_DEFAULTS)
    ).toBeNull();
  });

  it("recalculates a missing-record county without replacing the governed score", () => {
    const scenarios = adjustCountyScenarios([missing, published], {
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });
    const conejos = scenarios?.get("08021");
    const losAngeles = scenarios?.get("06037");

    expect(conejos?.governedScore).toBe(22.9);
    expect(conejos?.governedPriority).toBe(
      "Lower Atlas priority — Not a safety finding"
    );
    expect(conejos?.score).toBe(12.2);
    expect(conejos?.humanWeakness).toBe(40);
    expect(losAngeles?.score).toBe(losAngeles?.governedScore);
  });

  it("ranks the adjusted scenario without changing governed scores", () => {
    const scenarios = adjustCountyScenarios([missing, published], {
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });

    expect(scenarios?.get("06037")?.rank).toBe(1);
    expect(scenarios?.get("08021")?.rank).toBe(2);
    expect(scenarios?.get("06037")?.governedScore).toBe(84.6);
  });

  it("moves the tick and pathogen share without writing a new governed score", () => {
    const scenario = adjustCountyScenarios([missing], {
      ...SCENARIO_SCORE_DEFAULTS,
      ecological_share: 40,
    })?.get("08021");

    expect(scenario?.governedScore).toBe(22.9);
    expect(scenario?.score).toBe(39.3);
    expect(scenario?.priority).toBe("Watch — Monitor signals");
    expect(scenario?.colorToken).toBe("var(--map-ramp-3)");
  });

  it("limits a higher published-record threshold when the governed human signal is already zero", () => {
    const raised = adjustCountyScenarios([clamped], {
      ...SCENARIO_SCORE_DEFAULTS,
      low_incidence_breakpoint: 20,
    })?.get("08001");
    const lowered = adjustCountyScenarios([clamped], {
      ...SCENARIO_SCORE_DEFAULTS,
      low_incidence_breakpoint: 5,
    })?.get("08001");

    expect(raised?.humanWeakness).toBe(0);
    expect(raised?.limitedBreakpoint).toBeTruthy();
    expect(raised?.governedScore).toBe(0);
    expect(lowered?.limitedBreakpoint).toBeFalsy();
    expect(lowered?.humanWeakness).toBe(0);
  });

  it("inverts a published incidence when the governed human signal is between the ends", () => {
    const scenario = adjustCountyScenarios([published], {
      ...SCENARIO_SCORE_DEFAULTS,
      low_incidence_breakpoint: 5,
    })?.get("06037");

    expect(scenario?.governedScore).toBe(84.6);
    expect(scenario?.humanWeakness).toBe(97);
    expect(scenario?.score).not.toBe(scenario?.governedScore);
  });
});
