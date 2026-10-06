import { describe, expect, it } from "vitest";

import {
  buildReviewCountyPreview,
  buildReviewInvestigateHandoff,
  reviewPreviewForSelection,
  type ReviewCountyPreviewModel,
} from "@/features/ux-reset/review/review-county-preview";
import type { CountyScoreSummary } from "@/generated/models";
import { SUGGESTED_FOLLOW_UP_BY_COLOR } from "@/lib/atlas-ui";

const score = {
  access_signal: 0.5,
  community: 0.5,
  ecological: 0.5,
  human_weakness: 0.5,
  pathogen_signal: 0.5,
  rural_signal: 0.5,
  score: 80,
  svi_signal: 0.5,
  tick_signal: 0.5,
};

function county(
  overrides: Partial<CountyScoreSummary> & Pick<CountyScoreSummary, "fips">
): CountyScoreSummary {
  return {
    burgdorferi_status: "Present",
    color: "#a9d2db",
    county: "Albany",
    evidence_completeness: 100,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower",
    score,
    state: "NY",
    state_name: "New York",
    tick_status: "Established",
    ...overrides,
  };
}

function snapshot(preview: ReviewCountyPreviewModel) {
  return {
    availability: preview.availability,
    caveat: preview.caveat,
    fips: preview.fips,
    followUp: preview.followUp,
    why: preview.why,
  };
}

describe("Review county preview", () => {
  it("keeps the six suggested follow-up phrases on the approved colors", () => {
    expect(SUGGESTED_FOLLOW_UP_BY_COLOR).toStrictEqual({
      "#55a8a3": "Monitor the pattern",
      "#87b982": "Verify with local information",
      "#a9d2db": "Continue routine review",
      "#e9602b": "Prioritize targeted follow-up",
      "#efc64a": "Conduct targeted follow-up",
      "#f49a32": "Coordinate a local assessment",
    });
  });

  it("builds availability, why, and caveat from one county", () => {
    const available = buildReviewCountyPreview(
      county({ color: "#a9d2db", fips: "36001" })
    );
    expect(snapshot(available)).toStrictEqual({
      availability: "available",
      caveat:
        "Published inputs in this release can be reviewed for this county.",
      fips: "36001",
      followUp: "Continue routine review",
      why: "Lower review priority",
    });

    const unavailable = buildReviewCountyPreview(
      county({
        burgdorferi_status: "No records",
        color: "#e9602b",
        county: "Suffolk",
        evidence_completeness: 20,
        fips: "36103",
        human_status: "missing",
        priority: "Priority 1 — Review",
        tick_status: "No records",
      })
    );
    expect({
      availability: unavailable.availability,
      caveat: unavailable.caveat,
      followUp: unavailable.followUp,
      why: unavailable.why,
      zeroCases: /0 cases/.test(`${unavailable.why} ${unavailable.caveat}`),
    }).toStrictEqual({
      availability: "unavailable",
      caveat: expect.stringContaining("not treated as zero"),
      followUp: "Prioritize targeted follow-up",
      why: expect.stringContaining("Highest review priority"),
      zeroCases: false,
    });
  });

  it("maps a suppressed score status to Limited", () => {
    const suppressed = buildReviewCountyPreview(
      county({
        burgdorferi_status: "Present",
        evidence_completeness: 100,
        fips: "36001",
        human_status: "SUPPRESSED",
        tick_status: "Established",
      })
    );
    const allSuppressed = buildReviewCountyPreview(
      county({
        burgdorferi_status: "suppressed",
        evidence_completeness: 100,
        fips: "36003",
        human_status: "suppressed",
        tick_status: "suppressed",
      })
    );
    expect({
      allAvailability: allSuppressed.availability,
      availability: suppressed.availability,
      caveat: suppressed.caveat,
      genericCaveat: suppressed.caveat.includes(
        "can be reviewed for this county"
      ),
      why: suppressed.why,
      zeroCases: /0 cases/.test(`${suppressed.why} ${suppressed.caveat}`),
    }).toStrictEqual({
      allAvailability: "limited",
      availability: "limited",
      caveat: expect.stringContaining("Suppressed or privacy-protected"),
      genericCaveat: false,
      why: "Lower review priority",
      zeroCases: false,
    });
  });

  it("does not call incomplete inputs available in the preview rationale", () => {
    const missingTick = buildReviewCountyPreview(
      county({
        burgdorferi_status: "Present",
        evidence_completeness: 100,
        fips: "36001",
        human_status: "published_count_floor",
        tick_status: "No records",
      })
    );
    const incomplete = buildReviewCountyPreview(
      county({
        burgdorferi_status: "Present",
        evidence_completeness: 40,
        fips: "36005",
        human_status: "published_count_floor",
        tick_status: "Established",
      })
    );
    expect({
      incompleteCaveat: incomplete.caveat,
      incompleteQualified: incomplete.qualification?.availability,
      incompleteWhy: incomplete.why,
      missingTickAbsence: /ticks are absent/.test(missingTick.why),
      missingTickAvailable: /available/i.test(missingTick.why),
      missingTickCaveat: missingTick.caveat,
      missingTickQualified: missingTick.qualification?.availability,
      missingTickWhy: missingTick.why,
    }).toStrictEqual({
      incompleteCaveat: "Some scored inputs are unavailable in this release.",
      incompleteQualified: "limited",
      incompleteWhy: "Lower review priority",
      missingTickAbsence: false,
      missingTickAvailable: false,
      missingTickCaveat: expect.stringContaining(
        "does not establish that ticks are absent"
      ),
      missingTickQualified: "limited",
      missingTickWhy: "Lower review priority",
    });
  });

  it("identifies suppression when a human count is also absent", () => {
    const preview = buildReviewCountyPreview(
      county({
        burgdorferi_status: "SUPPRESSED",
        evidence_completeness: 100,
        fips: "36001",
        human_status: "missing",
        tick_status: "Established",
      })
    );
    expect({
      availability: preview.availability,
      caveat: preview.caveat,
      missingOnly: preview.caveat.includes(
        "published Lyme case count is unavailable"
      ),
      why: preview.why,
      zeroCases: /0 cases/.test(`${preview.why} ${preview.caveat}`),
    }).toStrictEqual({
      availability: "limited",
      caveat: expect.stringContaining("Suppressed or privacy-protected"),
      missingOnly: false,
      why: "Lower review priority",
      zeroCases: false,
    });
  });

  it("ignores an earlier preview response for a different county", () => {
    const albany = county({ county: "Albany", fips: "36001" });
    const suffolk = county({
      burgdorferi_status: "No records",
      color: "#e9602b",
      county: "Suffolk",
      evidence_completeness: 20,
      fips: "36103",
      human_status: "missing",
      priority: "Priority 1 — Review",
      tick_status: "No records",
    });
    const preview = reviewPreviewForSelection({
      counties: [albany, suffolk],
      response: { county: albany, requestedFips: "36001" },
      selectedFips: "36103",
    });
    expect({
      caveat: preview?.caveat,
      countyName: preview?.countyName,
      fips: preview?.fips,
      followUp: preview?.followUp,
      why: preview?.why,
    }).toStrictEqual({
      caveat: expect.stringContaining("not treated as zero"),
      countyName: "Suffolk",
      fips: "36103",
      followUp: "Prioritize targeted follow-up",
      why: expect.stringContaining("Highest review priority"),
    });
  });

  it("rejects a response whose county id does not match the request", () => {
    const albany = county({ county: "Albany", fips: "36001" });
    const impostor = county({
      county: "Not Albany",
      fips: "99999",
    });
    const preview = reviewPreviewForSelection({
      counties: [albany],
      response: { county: impostor, requestedFips: "36001" },
      selectedFips: "36001",
    });
    expect(preview?.countyName).toBe("Albany");
    expect(preview?.fips).toBe("36001");
  });

  it("drops Review-only controls and compare with an explicit note", () => {
    const handoff = buildReviewInvestigateHandoff({
      period: "2023-01-01",
      releaseId: "alpha-2026",
      scopeCode: "NY",
      searchParams: new URLSearchParams(
        "scope=NY&county=36001&dataset=alpha-2026&period=2023-01-01&sort=score&page=2&compare=08001,08013"
      ),
      selectedFips: "36103",
    });
    const url = new URL(handoff.href, "http://localhost");
    expect({
      compare: url.searchParams.get("compare"),
      county: url.searchParams.get("county"),
      dataset: url.searchParams.get("dataset"),
      notes: handoff.droppedNotes,
      page: url.searchParams.get("page"),
      period: url.searchParams.get("period"),
      scope: url.searchParams.get("scope"),
      sort: url.searchParams.get("sort"),
    }).toStrictEqual({
      compare: null,
      county: "36103",
      dataset: "alpha-2026",
      notes: [
        "Compare is not part of Investigate. This opens the selected county only.",
        "The Review list page stays on Review. Browser Back returns to it.",
        "Review sort stays on Review and is not copied to Investigate.",
      ],
      page: null,
      period: "2023-01-01",
      scope: "NY",
      sort: null,
    });
  });

  it("distinguishes duplicate county names by FIPS", () => {
    const west = county({
      county: "Jefferson",
      fips: "36045",
      state: "NY",
      state_name: "New York",
    });
    const east = county({
      color: "#efc64a",
      county: "Jefferson",
      fips: "36047",
      priority: "Priority 2 — Review",
      state: "NY",
      state_name: "New York",
    });
    const first = buildReviewCountyPreview(west);
    const second = buildReviewCountyPreview(east);
    expect(first.countyName).toBe(second.countyName);
    expect(first.fips).not.toBe(second.fips);
    expect(second.followUp).toBe("Conduct targeted follow-up");
    expect(second.why).toContain("Moderate review priority");
  });
});
