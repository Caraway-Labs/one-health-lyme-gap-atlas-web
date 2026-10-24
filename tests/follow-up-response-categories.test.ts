import { describe, expect, it } from "vitest";

import type { CountyDetail } from "../src/generated/models";
import { SUGGESTED_FOLLOW_UP_BY_COLOR } from "../src/lib/atlas-ui";
import { GAP_SCORE_UNAVAILABLE_TITLE } from "../src/lib/follow-up-response-content";
import { buildCountyFollowUp } from "../src/lib/follow-up-workflows";

function county(overrides: Partial<CountyDetail> = {}): CountyDetail {
  return {
    burgdorferi_status: "Present",
    case_count_floor_2023: 12,
    color: "#87b982",
    county: "Adams",
    evidence_completeness: 100,
    fips: "08001",
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    incidence_floor_2023: 4.2,
    pacificus_status: "No records",
    population: 1000,
    priority: "Priority 2 — Review",
    release: {
      bundle_sha256: "a".repeat(64),
      generated_at: "2026-01-01",
      limitations: "test",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      methodology_version: "test",
      release_id: "test",
      schema_version: "test",
      scope: "test",
      score_defaults: {} as never,
      sources: [],
      states: [],
    },
    rucc_2023: 2,
    scapularis_status: "Established",
    score: {
      access_signal: 10,
      community: 10,
      ecological: 10,
      human_weakness: 10,
      pathogen_signal: 10,
      rural_signal: 10,
      score: 40,
      svi_signal: 10,
      tick_signal: 10,
    },
    state: "CO",
    state_name: "Colorado",
    state_unallocated_records_2023: 0,
    svi_percentile: 0.4,
    tick_status: "Established",
    uninsured_percent: 8,
    uninsured_percentile: 0.5,
    ...overrides,
  } as CountyDetail;
}

const COLORS = Object.keys(SUGGESTED_FOLLOW_UP_BY_COLOR);

describe("published gap-score response categories", () => {
  it("keeps six distinct titles, rows, and questions", () => {
    const workflows = COLORS.map((color) =>
      buildCountyFollowUp(county({ color }))
    );
    const titles = workflows.map((workflow) => workflow.level.title);
    expect(titles).toStrictEqual(Object.values(SUGGESTED_FOLLOW_UP_BY_COLOR));
    expect(new Set(titles).size).toBe(6);
    const human = workflows.map(
      (workflow) =>
        workflow.rows.find((row) => row.id === "human-disease-surveillance")
          ?.recommendation
    );
    expect(new Set(human).size).toBe(6);
    const questions = workflows.map((workflow) => workflow.questions.join("|"));
    expect(new Set(questions).size).toBe(6);
  });

  it("uses the practical targeted actions without copying them into routine review", () => {
    const targeted = buildCountyFollowUp(county({ color: "#efc64a" }));
    const routine = buildCountyFollowUp(county({ color: "#a9d2db" }));
    expect(targeted.rows.map((row) => row.label)).toStrictEqual([
      "Review county case information",
      "Review tick and pathogen records",
      "Clarify reporting, if needed",
      "Consider prevention needs",
      "Record the question and next step",
    ]);
    expect(targeted.level.explanation).toBe(
      "Review the county’s data with local partners to clarify the pattern and decide whether further follow-up would help."
    );
    expect(targeted.questions).toStrictEqual([
      "Could travel, reporting practices, or suppressed counts explain the pattern?",
      "How recent and geographically representative are the tick and pathogen records?",
      "What do local partners know that is missing here?",
      "What information would change your next step?",
    ]);
    expect({
      action: targeted.rows[0]?.action,
      distinctAction: routine.rows[0]?.action !== targeted.rows[0]?.action,
      distinctQuestion: routine.questions[0] !== targeted.questions[0],
      partners: targeted.rows[0]?.partners,
    }).toStrictEqual({
      action:
        "Check whether local records clarify missing or suppressed counts.",
      distinctAction: true,
      distinctQuestion: true,
      partners: "State or local surveillance staff",
    });
  });

  it("makes light blue and yellow differ in copy, not only the heading", () => {
    const lightBlue = buildCountyFollowUp(county({ color: "#a9d2db" }));
    const yellow = buildCountyFollowUp(county({ color: "#efc64a" }));
    expect(lightBlue.level.title).toBe("Continue routine review");
    expect(yellow.level.title).toBe("Conduct targeted follow-up");
    expect(lightBlue.questions).toHaveLength(4);
    expect(lightBlue.rows[0]?.recommendation).not.toBe(
      yellow.rows[0]?.recommendation
    );
    expect(lightBlue.questions[0]).not.toBe(yellow.questions[0]);
  });

  it("does not invent a category for a blank published color", () => {
    const workflow = buildCountyFollowUp(
      county({ color: " ", score: { ...county().score, score: 0 } })
    );
    expect(workflow.level.title).toBe(GAP_SCORE_UNAVAILABLE_TITLE);
    expect(workflow.level.reason).toBe("gap-score-unavailable");
    expect(workflow.questions.join(" ")).toContain(
      "Why is a published Atlas gap score"
    );
    expect(workflow.level.title).not.toBe("Monitor the pattern");
    expect(workflow.level.title).not.toBe("Continue routine review");
  });

  it("keeps an out-of-scope county unsupported even when a color and score exist", () => {
    const workflow = buildCountyFollowUp(
      county({
        color: "#e4e9ea",
        in_contiguous_tick_scope: false,
        state: "AK",
      })
    );
    expect(workflow.level.reason).toBe("unsupported-jurisdiction");
    expect(workflow.level.title).not.toBe(GAP_SCORE_UNAVAILABLE_TITLE);
    expect(workflow.level.explanation).toContain("contiguous tick scope");
  });

  it("keeps a scored county assigned when the separate priority label is unavailable", () => {
    const workflow = buildCountyFollowUp(
      county({
        color: "#55a8a3",
        priority: "Model-assisted surveillance priority unavailable",
      })
    );
    expect(workflow.level.title).toBe("Monitor the pattern");
    expect(workflow.level.reason).not.toBe("gap-score-unavailable");
    expect(workflow.level.colorResponseNote).toContain(
      "not a model-assisted surveillance priority"
    );
  });

  it("keeps a published zero score in its mapped category", () => {
    const workflow = buildCountyFollowUp(
      county({
        case_count_floor_2023: 0,
        color: "#a9d2db",
        score: { ...county().score, score: 0 },
      })
    );
    expect(workflow.level.title).toBe("Continue routine review");
    expect(workflow.level.reason).not.toBe("gap-score-unavailable");
  });

  it("assigns a mapped color even when the review result is unsupported", () => {
    const workflow = buildCountyFollowUp(county({ color: "#efc64a" }), {
      reviewResultState: "unsupported",
    });
    expect(workflow.level.title).toBe("Conduct targeted follow-up");
    expect(workflow.level.status).toBe("assigned");
  });

  it("keeps an unknown color unassigned rather than gray", () => {
    const workflow = buildCountyFollowUp(county({ color: "#111111" }));
    expect(workflow.level.reason).toBe("recommendation-unassigned");
    expect(workflow.level.title).not.toBe(GAP_SCORE_UNAVAILABLE_TITLE);
  });
});
