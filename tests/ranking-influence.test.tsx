import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  RANKING_INFLUENCE_NO_BREAKDOWN,
  rankingInfluenceFor,
  type RankingInfluenceCounty,
} from "@/features/ux-reset/review/ranking-influence";
import { RankingInfluencePanel } from "@/features/ux-reset/review/ranking-influence-panel";

const worthScore = {
  access_signal: 25.6,
  community: 28.9,
  ecological: 0,
  human_weakness: 75,
  pathogen_signal: 0,
  rural_signal: 100,
  score: 7.6,
  svi_signal: 2.3,
  tick_signal: 0,
};

function county(
  overrides: Partial<RankingInfluenceCounty> = {}
): RankingInfluenceCounty {
  return {
    burgdorferi_status: "No records",
    human_status: "no_county_linked_record",
    in_contiguous_tick_scope: true,
    rucc_2023: 9,
    score: worthScore,
    svi_percentile: 0.0232,
    tick_status: "No records",
    uninsured_percent: 5.9,
    uninsured_percentile: 0.2564,
    ...overrides,
  };
}

function panelText(): string {
  return screen.getByTestId("ranking-influence").textContent ?? "";
}

describe("ranking influence", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps Worth County qualitative and withholds the signal numbers", () => {
    const copy = rankingInfluenceFor(county());
    const text = [
      copy.community,
      copy.human,
      copy.pathogen,
      copy.scopeNote,
      copy.tick,
    ].join(" ");
    expect({
      hazard: text.includes("not low ecological hazard"),
      human: text.includes("not zero cases"),
      pathogen: text.includes("not a finding that the pathogen is absent"),
      percent: text.includes("%"),
      scope: copy.scopeNote,
      score: text.includes("7.6"),
      signals: ["75", "28.9", "25.6"].some((value) => text.includes(value)),
      underreporting: text.includes("not proof of underreporting"),
    }).toStrictEqual({
      hazard: true,
      human: true,
      pathogen: true,
      percent: false,
      scope: null,
      score: false,
      signals: false,
      underreporting: true,
    });
  });

  it("does not treat a zero published score with ecological evidence as no hazard", () => {
    const copy = rankingInfluenceFor(
      county({
        burgdorferi_status: "Present",
        human_status: "published_count_floor",
        score: { ...worthScore, ecological: 100, human_weakness: 0, score: 0 },
        tick_status: "Established",
      })
    );
    expect(copy.human).toContain("not a finding of no ecological hazard");
    expect(copy.tick).toContain("not a measure of tick abundance");
    expect(copy.pathogen).toContain("not a human infection estimate");
  });

  it("names unpublished community context without estimating it", () => {
    const copy = rankingInfluenceFor(
      county({
        rucc_2023: null,
        svi_percentile: null,
        uninsured_percent: null,
        uninsured_percentile: null,
      })
    );
    expect(copy.community).toContain("no published");
    expect(copy.community).toContain("social vulnerability percentile");
    expect(copy.community).toContain("not proof of underreporting");
    expect(copy.community).not.toContain("%");
  });

  it("says an out-of-scope score is unavailable", () => {
    const copy = rankingInfluenceFor(
      county({ in_contiguous_tick_scope: false })
    );
    expect(copy.scopeNote).toContain("unavailable");
    expect(copy.scopeNote).toContain("not a low score");
  });

  it("starts collapsed and expands without inventing a breakdown", () => {
    const { rerender } = render(<RankingInfluencePanel detail={county()} />);
    const details = screen.getByTestId("ranking-influence");
    const closed = details.hasAttribute("open");
    const summary = details.querySelector("summary");
    if (!(summary instanceof HTMLElement)) {
      throw new Error("Missing ranking summary");
    }
    fireEvent.click(summary);
    expect({
      breakdown: screen.getByTestId("ranking-influence-breakdown").textContent,
      closed,
      href: screen
        .getByRole("link", { name: "How county scoring works" })
        .getAttribute("href"),
      open: details.hasAttribute("open"),
      percent: panelText().includes("%"),
      score: panelText().includes("7.6"),
    }).toStrictEqual({
      breakdown: RANKING_INFLUENCE_NO_BREAKDOWN,
      closed: false,
      href: "/docs/releases-and-methodology#how-county-scoring-works",
      open: true,
      percent: false,
      score: false,
    });

    rerender(
      <RankingInfluencePanel
        detail={county({
          human_status: "published_count_floor",
          tick_status: "Established",
        })}
      />
    );
    expect({
      floor: panelText().includes("case-count floor is a human input"),
      missing: panelText().includes("not zero cases"),
    }).toStrictEqual({ floor: true, missing: false });
  });
});
