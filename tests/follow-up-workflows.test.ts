import { describe, expect, it } from "vitest";

import type { CountyDetail } from "../src/generated/models";
import {
  buildCountyFollowUp,
  FOLLOW_UP_CATEGORY_ORDER,
  INSUFFICIENT_REVIEW_LEVEL_EXPLANATION,
  REVIEW_LEVEL_UNAVAILABLE,
} from "../src/lib/follow-up-workflows";

function county(overrides: Partial<CountyDetail> = {}): CountyDetail {
  return {
    burgdorferi_status: "Present",
    case_count_floor_2023: 12,
    color: "#87b982",
    county: "Adams",
    evidence_completeness: 100,
    fips: "08001",
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
      loaded_at: "2026-01-01",
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
  };
}

function rowText(
  workflow: ReturnType<typeof buildCountyFollowUp>,
  id: (typeof FOLLOW_UP_CATEGORY_ORDER)[number]
): string {
  return workflow.rows.find((entry) => entry.id === id)?.recommendation ?? "";
}

describe("five-category follow-up workflows", () => {
  it("keeps the five categories in order for a relatively complete county", () => {
    const workflow = buildCountyFollowUp(county());
    expect({
      community: rowText(workflow, "community-context-outreach").includes(
        "not evidence of transmission or underreporting"
      ),
      human: rowText(workflow, "human-disease-surveillance").includes(
        "compare the published county case-count floor"
      ),
      labels: workflow.rows.map((entry) => entry.label),
      title: workflow.level.title,
      vector: rowText(workflow, "vector-pathogen-surveillance").includes(
        "not a human transmission estimate"
      ),
      verificationNote: workflow.verificationNote,
    }).toStrictEqual({
      community: true,
      human: true,
      labels: [
        "Human disease surveillance",
        "Vector and pathogen surveillance",
        "Clinical and laboratory reporting",
        "Community context and outreach",
        "Coordination and documentation",
      ],
      title: "Verify with local information",
      vector: true,
      verificationNote: null,
    });
  });

  it("does not treat a missing human record as zero cases", () => {
    const workflow = buildCountyFollowUp(
      county({
        case_count_floor_2023: null,
        human_status: "no_county_linked_record",
        incidence_floor_2023: null,
        state_unallocated_records_2023: 4,
      })
    );
    const human = rowText(workflow, "human-disease-surveillance");
    expect(human).toContain("suppressed or unallocated");
    expect(human).toContain("not a finding of zero cases");
    expect(human).toContain("4 published 2023");
    expect(human.toLowerCase()).not.toContain("cases were missed");
  });

  it("does not treat missing tick records as absence or an order to collect", () => {
    const workflow = buildCountyFollowUp(
      county({
        burgdorferi_status: "No records",
        pacificus_status: "No records",
        scapularis_status: "No records",
        tick_status: "No records",
      })
    );
    const vector = rowText(workflow, "vector-pathogen-surveillance");
    expect(vector).toContain("outside the current source");
    expect(vector).toContain("Do not treat the gap as absence");
    expect(vector).toContain("do not start field collection");
    expect(vector.toLowerCase()).not.toContain("ticks are absent");
  });

  it("keeps a missing pathogen record distinct from tick presence", () => {
    const workflow = buildCountyFollowUp(
      county({ burgdorferi_status: "No records" })
    );
    const vector = rowText(workflow, "vector-pathogen-surveillance");
    expect(vector).toContain("tick presence record is published");
    expect(vector).toContain("not documented negative findings");
  });

  it("names a documented negative pathogen finding when the status says so", () => {
    const workflow = buildCountyFollowUp(
      county({ burgdorferi_status: "Not detected" })
    );
    expect(rowText(workflow, "vector-pathogen-surveillance")).toContain(
      "documented negative finding"
    );
  });

  it("asks for local context when community measures are incomplete", () => {
    const workflow = buildCountyFollowUp(
      county({
        rucc_2023: null,
        svi_percentile: 0.8,
        uninsured_percent: null,
        uninsured_percentile: null,
      })
    );
    const community = rowText(workflow, "community-context-outreach");
    expect(community).toContain("incomplete");
    expect(community).toContain(
      "not evidence of transmission or underreporting"
    );
    expect(community).not.toContain("Conduct outreach");
  });

  it("keeps an approved color response and does not invent a deadline", () => {
    const workflow = buildCountyFollowUp(county({ color: "#e9602b" }));
    expect(workflow.level.title).toBe("Prioritize targeted follow-up");
    expect(workflow.level.explanation.toLowerCase()).not.toContain("week");
    expect(workflow.level.colorResponseNote).toContain(
      "not a model-assisted surveillance priority"
    );
  });

  it("keeps an unknown score color from borrowing a low-priority response", () => {
    const missingColor = buildCountyFollowUp(county({ color: "#111111" }));
    expect({
      reason: missingColor.level.reason,
      status: missingColor.level.status,
      title: missingColor.level.title,
      verification: missingColor.verificationNote?.includes(
        "not a scored recommendation"
      ),
    }).toStrictEqual({
      reason: "recommendation-unassigned",
      status: "unavailable",
      title: REVIEW_LEVEL_UNAVAILABLE,
      verification: true,
    });
  });

  it("uses the insufficiency explanation only for a documented insufficient review", () => {
    const insufficient = buildCountyFollowUp(county({ color: "#e9602b" }), {
      reviewResultState: "insufficient_evidence",
    });
    const outside = buildCountyFollowUp(
      county({ in_contiguous_tick_scope: false })
    );
    expect({
      insufficient: insufficient.level.explanation,
      outsideReason: outside.level.reason,
      outsideUsesInsufficiency:
        outside.level.explanation === INSUFFICIENT_REVIEW_LEVEL_EXPLANATION,
    }).toStrictEqual({
      insufficient: INSUFFICIENT_REVIEW_LEVEL_EXPLANATION,
      outsideReason: "unsupported-jurisdiction",
      outsideUsesInsufficiency: false,
    });
  });

  it("keeps Worth County facts in one action and does not repeat the tier essay", () => {
    const workflow = buildCountyFollowUp(
      county({
        burgdorferi_status: "No records",
        case_count_floor_2023: null,
        color: "#a9d2db",
        county: "Worth County",
        fips: "19195",
        human_status: "no_county_linked_record",
        incidence_floor_2023: null,
        pacificus_status: "No records",
        scapularis_status: "No records",
        state: "IA",
        state_name: "Iowa",
        state_unallocated_records_2023: 77,
        tick_status: "No records",
      })
    );
    const human = rowText(workflow, "human-disease-surveillance");
    const vector = rowText(workflow, "vector-pathogen-surveillance");
    const joined = workflow.rows.map((entry) => entry.recommendation).join(" ");
    expect({
      gap: vector.includes("Do not treat the gap as absence"),
      humanStart: human.startsWith("During routine review, check whether"),
      missing: human.includes("not a finding of zero cases"),
      noEssay: joined.includes(
        "without assuming additional case investigation"
      ),
      noRiskEssay: joined.includes("individual risk"),
      outside: vector.includes("outside the current source"),
      sampling: vector.includes("do not start field collection"),
      title: workflow.level.title,
      unallocated: human.includes("77 published 2023"),
      underreportingEssay: joined.includes("proof of underreporting"),
    }).toStrictEqual({
      gap: true,
      humanStart: true,
      missing: true,
      noEssay: false,
      noRiskEssay: false,
      outside: true,
      sampling: true,
      title: "Continue routine review",
      unallocated: true,
      underreportingEssay: false,
    });
  });

  it("does not hide a western tick guide when only pacificus is documented", () => {
    const workflow = buildCountyFollowUp(
      county({
        pacificus_status: "Reported",
        scapularis_status: "No records",
        tick_status: "Reported",
      })
    );
    const labels =
      workflow.rows
        .find((entry) => entry.id === "vector-pathogen-surveillance")
        ?.resources.map((resource) => resource.label) ?? [];
    expect(labels).toContain("Western blacklegged tick surveillance guidance");
    expect(labels).not.toContain("Blacklegged tick surveillance guidance");
  });
});
