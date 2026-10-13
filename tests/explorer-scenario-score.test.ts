import { describe, expect, it } from "vitest";

import {
  adjustCountyScenarios,
  priorityLabel,
  SCENARIO_SCORE_DEFAULTS,
  scoreCounty,
  type AdjustedCountyScenario,
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

    expect(conejos?.kind).toBe("adjusted");
    expect(conejos?.governedScore).toBe(22.9);
    expect(conejos?.kind === "adjusted" ? conejos.score : null).toBe(12.2);
    expect(conejos?.kind === "adjusted" ? conejos.humanWeakness : null).toBe(
      40
    );
    expect(losAngeles?.kind === "unchanged" ? losAngeles.score : null).toBe(
      84.6
    );
  });

  it("ranks the adjusted scenario without changing governed scores", () => {
    const scenarios = adjustCountyScenarios([missing, published], {
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });

    const losAngeles = scenarios?.get("06037");
    const conejos = scenarios?.get("08021");

    expect(losAngeles?.kind === "unchanged" ? losAngeles.rank : null).toBe(1);
    expect(conejos?.kind === "adjusted" ? conejos.rank : null).toBe(2);
    expect(losAngeles?.governedScore).toBe(84.6);
  });

  it("moves the tick and pathogen share without writing a new governed score", () => {
    const scenario = adjustCountyScenarios([missing], {
      ...SCENARIO_SCORE_DEFAULTS,
      ecological_share: 40,
    })?.get("08021");

    expect(scenario?.governedScore).toBe(22.9);
    expect(scenario?.kind === "adjusted" ? scenario.score : null).toBe(39.3);
    expect(scenario?.kind === "adjusted" ? scenario.priority : null).toBe(
      "Watch — Monitor signals"
    );
    expect(scenario?.kind === "adjusted" ? scenario.colorToken : null).toBe(
      "var(--map-ramp-3)"
    );
  });

  it("keeps a lower threshold from inventing a new human signal when the governed signal is zero", () => {
    expect(
      adjustCountyScenarios([clamped], {
        ...SCENARIO_SCORE_DEFAULTS,
        low_incidence_breakpoint: 5,
      })
    ).toBeNull();
  });

  it("marks a higher threshold unavailable when incidence was clamped away", () => {
    const raised = adjustCountyScenarios([clamped], {
      ...SCENARIO_SCORE_DEFAULTS,
      low_incidence_breakpoint: 20,
    })?.get("08001");

    expect(raised?.kind).toBe("limited");
    expect(raised?.governedScore).toBe(0);
    expect(raised?.kind === "limited").toBeTruthy();
    expect("score" in (raised ?? {})).toBeFalsy();
    expect("rank" in (raised ?? {})).toBeFalsy();
  });

  it("inverts a published incidence when the governed human signal is between the ends", () => {
    const scenario = adjustCountyScenarios([published], {
      ...SCENARIO_SCORE_DEFAULTS,
      low_incidence_breakpoint: 5,
    })?.get("06037");

    expect(scenario?.governedScore).toBe(84.6);
    expect(scenario?.kind === "adjusted" ? scenario.humanWeakness : null).toBe(
      97
    );
    expect(scenario?.kind === "adjusted" ? scenario.score : null).not.toBe(
      84.6
    );
  });
});

function definiteScore(
  scenario: AdjustedCountyScenario | undefined
): number | null {
  if (scenario?.kind === "adjusted" || scenario?.kind === "unchanged") {
    return scenario.score;
  }
  return null;
}

function definiteRank(
  scenario: AdjustedCountyScenario | undefined
): number | null {
  if (scenario?.kind === "adjusted" || scenario?.kind === "unchanged") {
    return scenario.rank;
  }
  return null;
}

function publishedZero(fips: string, countyName: string): CountyScoreSummary {
  return summary({
    county: countyName,
    fips,
    human_status: "published_count_floor",
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 100,
      community: 100,
      ecological: 100,
      human_weakness: 0,
      pathogen_signal: 100,
      rural_signal: 100,
      score: 0,
      svi_signal: 100,
      tick_signal: 100,
    },
  });
}

describe("exact incidence when the threshold rises", () => {
  const raised = {
    ...SCENARIO_SCORE_DEFAULTS,
    low_incidence_breakpoint: 20,
  };
  const scenarios = () =>
    adjustCountyScenarios(
      [
        publishedZero("08012", "Twelve County"),
        publishedZero("08030", "Thirty County"),
        publishedZero("08001", "Clamped County"),
      ],
      raised,
      SCENARIO_SCORE_DEFAULTS,
      { "08012": 12, "08030": 30 }
    );

  it("scores incidence 12 as 40 when the threshold rises from 10 to 20", () => {
    const twelve = scenarios()?.get("08012");

    expect(twelve?.kind).toBe("adjusted");
    expect(definiteScore(twelve)).toBe(40);
    expect(twelve?.kind === "adjusted" ? twelve.priority : null).toBe(
      "Watch — Monitor signals"
    );
    expect(twelve?.kind === "adjusted" ? twelve.colorToken : null).toBe(
      "var(--map-ramp-3)"
    );
    expect(definiteRank(twelve)).toBe(1);
  });

  it("keeps incidence 30 at the governed zero and leaves a county without incidence unranked", () => {
    const thirty = scenarios()?.get("08030");
    const clampedCounty = scenarios()?.get("08001");

    expect(thirty?.kind).toBe("unchanged");
    expect(definiteScore(thirty)).toBe(0);
    expect(definiteRank(thirty)).toBe(2);
    expect(clampedCounty?.kind).toBe("limited");
    expect(definiteRank(clampedCounty)).toBeNull();
  });
});

function boundaryCounty(
  fips: string,
  score: number,
  human: number,
  priority: string
): CountyScoreSummary {
  return summary({
    county: `Boundary ${fips}`,
    fips,
    human_status: "published_count_floor",
    priority,
    score: {
      access_signal: 10,
      community: 14,
      ecological: 100,
      human_weakness: human,
      pathogen_signal: 100,
      rural_signal: 6,
      score,
      svi_signal: 20,
      tick_signal: 100,
    },
  });
}

describe("sliders leave unaffected counties on the governed score", () => {
  const priority2 = "Priority 2 — Review";
  const watch = "Watch — Monitor signals";
  const lower = "Lower Atlas priority — Not a safety finding";

  it("keeps a published 69.9 score when only the missing-record value changes", () => {
    const boundary = boundaryCounty("08069", 69.9, 100, priority2);
    const ecological = 0.6 * 100 + 0.4 * 100;
    const community = 0.5 * 20 + 0.3 * 10 + 0.2 * 6;
    const naive = (100 * (0.65 * ecological + 0.35 * community)) / 100;
    const scenarios = adjustCountyScenarios([boundary, missingRecord()], {
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });
    const kept = scenarios?.get("08069");

    expect(naive).toBeCloseTo(69.97);
    expect(kept?.kind).toBe("unchanged");
    expect(definiteScore(kept)).toBe(69.9);
    expect(kept?.kind === "unchanged" ? kept.priority : null).toBe(priority2);
  });

  it("keeps near-boundary published scores when the missing-record value changes", () => {
    const scenarios = adjustCountyScenarios(
      [
        boundaryCounty("08049", 49.9, 71.4, watch),
        boundaryCounty("08029", 29.9, 43, lower),
        missingRecord(),
      ],
      { ...SCENARIO_SCORE_DEFAULTS, missing_human_weakness: 40 }
    );

    const watchCounty = scenarios?.get("08049");
    const lowerCounty = scenarios?.get("08029");

    expect(definiteScore(watchCounty)).toBe(49.9);
    expect(
      watchCounty?.kind === "unchanged" ? watchCounty.priority : null
    ).toBe(watch);
    expect(definiteScore(lowerCounty)).toBe(29.9);
    expect(
      lowerCounty?.kind === "unchanged" ? lowerCounty.priority : null
    ).toBe(lower);
  });

  it("leaves missing-record counties unchanged when only the threshold changes", () => {
    expect(
      adjustCountyScenarios([missingRecord()], {
        ...SCENARIO_SCORE_DEFAULTS,
        low_incidence_breakpoint: 20,
      })
    ).toBeNull();
  });
});

function missingRecord(): CountyScoreSummary {
  return summary({
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
}
