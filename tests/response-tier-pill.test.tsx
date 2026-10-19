import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResponseTierPill } from "@/components/response-tier-pill";
import type { CountyDetail } from "@/generated/models";
import {
  REVIEW_SCORE_RAMP_COLORS,
  SUGGESTED_FOLLOW_UP_BY_COLOR,
} from "@/lib/atlas-ui";
import { buildCountyFollowUp } from "@/lib/follow-up-workflows";
import {
  RESPONSE_TIER_PRESENTATION,
  responseTierForCounty,
} from "@/lib/response-tier";

const APPROVED_LABELS = RESPONSE_TIER_PRESENTATION.map(
  (line) => `${line.title} ${line.detail}`
);

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
    priority: "Priority 1 — review first",
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

describe("response tier pill", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the six approved labels and Action Center colors", () => {
    const views = REVIEW_SCORE_RAMP_COLORS.map((color, index) => {
      const detail = county({ color });
      const tier = responseTierForCounty(detail);
      const action = buildCountyFollowUp(detail).level;
      render(<ResponseTierPill detail={detail} />);
      const pill = screen.getByTestId("selected-county-response-tier");
      const view = {
        actionStatus: action.status,
        actionTitle: action.title,
        detail: pill.querySelector(".response-tier-pill-detail")?.textContent,
        help: screen.queryByTestId("selected-county-response-tier-help"),
        label: pill.textContent,
        priorityWording: pill.textContent?.includes("Priority 1") ?? false,
        ramp: pill.dataset.ramp,
        tier,
        title: pill.querySelector(".response-tier-pill-title")?.textContent,
        usesPillClass: pill.className.includes("response-tier-pill"),
      };
      cleanup();
      return { color, expectedLabel: APPROVED_LABELS[index], view };
    });
    expect(views).toStrictEqual(
      REVIEW_SCORE_RAMP_COLORS.map((color, index) => ({
        color,
        expectedLabel: APPROVED_LABELS[index],
        view: {
          actionStatus: "assigned",
          actionTitle: SUGGESTED_FOLLOW_UP_BY_COLOR[color],
          detail: RESPONSE_TIER_PRESENTATION[index]?.detail,
          help: null,
          label: `${RESPONSE_TIER_PRESENTATION[index]?.title ?? ""}${RESPONSE_TIER_PRESENTATION[index]?.detail ?? ""}`,
          priorityWording: false,
          ramp: `map-ramp-${index + 1}`,
          tier: {
            action: SUGGESTED_FOLLOW_UP_BY_COLOR[color],
            detail: RESPONSE_TIER_PRESENTATION[index]?.detail,
            label: APPROVED_LABELS[index],
            ramp: `map-ramp-${index + 1}`,
            status: "assigned",
            title: RESPONSE_TIER_PRESENTATION[index]?.title,
          },
          title: RESPONSE_TIER_PRESENTATION[index]?.title,
          usesPillClass: true,
        },
      }))
    );
  });

  it("stays aligned with the Action Center when the published color changes", () => {
    const first = county({ color: REVIEW_SCORE_RAMP_COLORS[0] });
    const last = county({ color: REVIEW_SCORE_RAMP_COLORS[5] });
    expect(responseTierForCounty(first).label).toBe(APPROVED_LABELS[0]);
    expect(buildCountyFollowUp(first).level.title).toBe(
      "Continue routine review"
    );
    expect(responseTierForCounty(last).label).toBe(APPROVED_LABELS[5]);
    expect(buildCountyFollowUp(last).level.title).toBe(
      "Prioritize targeted follow-up"
    );
    expect(responseTierForCounty(first).label).not.toBe(
      responseTierForCounty(last).label
    );
  });

  it("does not invent a tier when the Action Center response is unavailable", () => {
    const cases = [
      { context: {}, detail: county({ color: " " }) },
      { context: {}, detail: county({ color: "" }) },
      { context: {}, detail: county({ color: "#111111" }) },
      {
        context: {},
        detail: county({ color: "#e9602b", in_contiguous_tick_scope: false }),
      },
      {
        context: { reviewResultState: "insufficient_evidence" as const },
        detail: county({ color: "#a9d2db" }),
      },
    ];
    const views = cases.map(({ context, detail }) => {
      const tier = responseTierForCounty(detail, context);
      const level = buildCountyFollowUp(detail, context).level;
      render(<ResponseTierPill context={context} detail={detail} />);
      const pill = screen.getByTestId("selected-county-response-tier");
      const view = {
        detail: pill.querySelector(".response-tier-pill-detail"),
        help: screen.queryByTestId("selected-county-response-tier-help"),
        inventedTier:
          /Lower review priority|Elevated review priority|Moderate review priority|Highest review priority/.test(
            pill.textContent ?? ""
          ),
        label: pill.textContent,
        levelStatus: level.status,
        levelTitle: level.title,
        priorityWording: pill.textContent?.includes("Priority 1") ?? false,
        ramp: pill.dataset.ramp,
        status: pill.dataset.status,
        tierStatus: tier.status,
        titlesMatch:
          tier.status === "unavailable" && tier.label === level.title,
      };
      cleanup();
      return view;
    });
    expect(
      views.every(
        (view) =>
          view.levelStatus === "unavailable" &&
          view.tierStatus === "unavailable" &&
          view.titlesMatch &&
          view.ramp === "unavailable" &&
          view.status === "unavailable" &&
          view.help === null &&
          view.detail === null &&
          view.priorityWording === false &&
          view.label === view.levelTitle &&
          view.inventedTier === false
      )
    ).toBeTruthy();
  });
});
