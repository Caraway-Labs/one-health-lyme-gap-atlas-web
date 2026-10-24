import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CountyActionPlan } from "@/components/county-action-plan";
import { explorerFollowUpRows } from "@/features/ux-reset/review/explorer-follow-up-display";
import type { CountyDetail } from "@/generated/models";
import { SUGGESTED_FOLLOW_UP_BY_COLOR } from "@/lib/atlas-ui";
import { buildCountyFollowUp } from "@/lib/follow-up-workflows";

function county(overrides: Partial<CountyDetail> = {}): CountyDetail {
  return {
    burgdorferi_status: "Present",
    case_count_floor_2023: 12,
    color: "#efc64a",
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
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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

describe("explorer follow-up display", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses the targeted copy and keeps state records off the county", () => {
    const detail = county({ state_unallocated_records_2023: 77 });
    render(
      <CountyActionPlan detail={detail} headingLevel="h3" variant="explorer" />
    );
    expect({
      duplicateSection: screen.queryByText(
        "Questions, partner roles, and official resources"
      ),
      heading: screen.getByText("Review county case information").textContent,
      links: screen.queryByRole("link"),
      stateRecords: screen.getByText(/Colorado has 77 published 2023/)
        .textContent,
      who: screen.getAllByText(/Who can help:/).length,
    }).toStrictEqual({
      duplicateSection: null,
      heading: "Review county case information",
      links: null,
      stateRecords: expect.stringContaining("are not Adams cases"),
      who: 5,
    });
  });

  it("keeps a distinct row set for every category and the gray state", () => {
    const explanations = new Set<string>();
    for (const color of Object.keys(SUGGESTED_FOLLOW_UP_BY_COLOR)) {
      const workflow = buildCountyFollowUp(county({ color }));
      const rows = explorerFollowUpRows(workflow, county({ color }));
      explanations.add(
        `${rows.length}:${rows.map((row) => row.explanation).join("|")}`
      );
    }
    const gray = buildCountyFollowUp(county({ color: "" }));
    const grayRows = explorerFollowUpRows(gray, county({ color: "" }));
    explanations.add(grayRows.map((row) => row.explanation).join("|"));
    expect({
      gray: grayRows[0]?.explanation,
      size: explanations.size,
      title: gray.level.title,
    }).toStrictEqual({
      gray: expect.stringContaining("not a low or high review priority"),
      size: 7,
      title: "Gap score unavailable",
    });
  });
});
