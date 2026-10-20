import { describe, expect, it } from "vitest";

import {
  adjustCountyScenarios,
  priorityLabel,
  scenarioColorToken,
  SCENARIO_SCORE_DEFAULTS,
  scoreCounty,
} from "../src/features/ux-reset/review/explorer-scenario-score";
import type { CountyScoreSummary } from "../src/generated/models";
import fixtures from "./fixtures/gap-score-v11-parity.json";

function county(fips: string): CountyScoreSummary {
  const row = fixtures.find((item) => item.inputs.fips === fips);
  if (!row) throw new Error(`Missing fixture ${fips}`);
  return {
    ...row.inputs,
    score: row.expected,
    county: fips,
    state: "CO",
    state_name: "Colorado",
    evidence_completeness: 50,
    priority: priorityLabel(row.expected.score),
    color: "#a9d2db",
    scoring_methodology_version: "surveillance-gap-score-v1.1",
  };
}

describe("approved v1.1 scenario behavior", () => {
  it("keeps governed values at defaults", () => {
    expect(
      adjustCountyScenarios([county("36027")], SCENARIO_SCORE_DEFAULTS)
    ).toBeNull();
  });

  it("keeps published values unchanged when only the missing-human assumption moves", () => {
    const published = county("36027");
    const result = adjustCountyScenarios([published, county("08021")], {
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });
    expect(result?.get(published.fips)?.kind).toBe("unchanged");
    expect(result?.get(published.fips)?.governedScore).toBe(
      published.score.score
    );
    expect(result?.get("08021")?.kind).toBe("adjusted");
  });

  it("keeps missing-human counties unchanged when only k moves", () => {
    expect(
      adjustCountyScenarios([county("08021")], {
        ...SCENARIO_SCORE_DEFAULTS,
        smooth_k: 100,
      })
    ).toBeNull();
  });

  it("uses the authorized floor for former hard-zero high-incidence counties", () => {
    const record = county("36027");
    const result = adjustCountyScenarios([record], {
      ...SCENARIO_SCORE_DEFAULTS,
      smooth_k: 100,
    });
    const scenario = result?.get(record.fips);
    expect(scenario?.kind).toBe("adjusted");
    if (scenario?.kind !== "adjusted") throw new Error("Expected adjustment");
    expect(scenario.humanWeakness).toBe(21.8);
    expect(record.incidence_floor_2023).toBe(359.23);
    expect(record.score.score).toBeGreaterThan(0);
  });

  it("never inverts rounded H or creates a score/rank for missing published inputs", () => {
    const record = { ...county("36027"), incidence_floor_2023: undefined };
    const scenario = adjustCountyScenarios([record], {
      ...SCENARIO_SCORE_DEFAULTS,
      smooth_k: 100,
    })?.get(record.fips);
    expect(scenario?.kind).toBe("limited");
    expect(scenario && "score" in scenario).toBeFalsy();
    expect(scenario && "rank" in scenario).toBeFalsy();
  });

  it("requires original community inputs rather than rounded display values", () => {
    const record = county("36027");
    delete record.svi_percentile;
    expect(
      adjustCountyScenarios([record], {
        ...SCENARIO_SCORE_DEFAULTS,
        ecological_share: 85,
      })?.get(record.fips)?.kind
    ).toBe("limited");
  });

  it("ranks equal scenario scores by FIPS and preserves the governed values", () => {
    const first = county("08021");
    const second = { ...first, fips: "08022" };
    const result = adjustCountyScenarios([second, first], {
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });
    const a = result?.get(first.fips);
    const b = result?.get(second.fips);
    expect(a && "rank" in a ? a.rank : null).toBe(1);
    expect(b && "rank" in b ? b.rank : null).toBe(2);
    expect(a?.governedScore).toBe(first.score.score);
  });

  it.each([
    [0, 1],
    [19.9, 1],
    [20, 2],
    [35, 3],
    [50, 4],
    [65, 5],
    [75, 6],
  ])("preserves fixed map bands at %s", (score, band) => {
    expect(scenarioColorToken(score, true)).toBe(`var(--map-ramp-${band})`);
    expect(scenarioColorToken(score, false)).toBe("var(--explorer-boundary)");
  });

  it("distinguishes published zero from null and a missing record", () => {
    const inputs = {
      burgdorferiStatus: "Present",
      humanStatus: "published_count_floor",
      inContiguousTickScope: true,
      incidenceFloor2023: 0,
      rucc2023: 5,
      sviPercentile: 0.5,
      tickStatus: "Established",
      uninsuredPercentile: 0.5,
    };
    expect(scoreCounty(inputs, SCENARIO_SCORE_DEFAULTS).humanWeakness).toBe(
      100
    );
    expect(
      scoreCounty(
        { ...inputs, incidenceFloor2023: null },
        SCENARIO_SCORE_DEFAULTS
      ).humanWeakness
    ).toBe(75);
    expect(
      scoreCounty(
        { ...inputs, humanStatus: "no_county_linked_record" },
        SCENARIO_SCORE_DEFAULTS
      ).humanWeakness
    ).toBe(75);
  });
});
