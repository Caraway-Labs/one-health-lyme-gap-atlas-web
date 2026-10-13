import { describe, expect, it } from "vitest";

import {
  GENERAL_REVIEW_STEPS_NOTE,
  RETIRED_FOLLOW_UP_PHRASES,
  SCORE_COLOR_BANDS,
  SINGLE_PERIOD_NOTE,
  SUGGESTED_FOLLOW_UP_INTERPRETATION,
  TICK_INFORMATION_LIMITED_NOTE,
  selectSuggestedFollowUp,
  type SuggestedFollowUpEvidence,
  type SuggestedFollowUpSelection,
} from "../src/features/ux-reset/review/suggested-follow-up-content";

function evidence(
  overrides: Partial<SuggestedFollowUpEvidence> = {}
): SuggestedFollowUpEvidence {
  return {
    burgdorferiStatus: "No records",
    caseCountFloor2023: 12,
    color: "#a9d2db",
    comparableReportingPeriods: null,
    humanStatus: "published_count_floor",
    incidenceFloor2023: 20,
    lowIncidenceBreakpoint: 10,
    pacificusStatus: "No records",
    priority: "Lower Atlas priority — Not a safety finding",
    rucc2023: null,
    scapularisStatus: "No records",
    sviPercentile: null,
    tickStatus: "Established",
    uninsuredPercent: null,
    uninsuredPercentile: null,
    ...overrides,
  };
}

function publicText(selection: SuggestedFollowUpSelection): string {
  return [
    selection.responseTitle,
    selection.introduction,
    selection.closing,
    selection.generalFallbackNote,
    selection.tickLimitedNote,
    selection.singlePeriodNote,
    selection.interpretationNote,
    selection.authoritativeReviewCategory,
    ...selection.activities.flatMap((activity) => [
      activity.title,
      activity.description,
      activity.partners,
      activity.purpose,
      activity.whyThisSuggestion,
      ...activity.resources.flatMap((resource) => [
        resource.label,
        resource.href,
      ]),
    ]),
  ]
    .filter((value): value is string => value !== null)
    .join("\n");
}

function whyFor(
  selection: SuggestedFollowUpSelection,
  activityId: string
): string {
  return (
    selection.activities.find((activity) => activity.id === activityId)
      ?.whyThisSuggestion ?? ""
  );
}

describe("suggested follow-up content", () => {
  it("maps all six score-color bands onto the four approved responses", () => {
    const mapped = SCORE_COLOR_BANDS.map((band) => {
      const selection = selectSuggestedFollowUp(
        evidence({
          color: band.color,
          priority: "Lower Atlas priority — Not a safety finding",
        })
      );
      return {
        approvedReviewCategory: selection.approvedReviewCategory,
        bandId: selection.bandId,
        hasActivities: selection.activities.length > 0,
        responseId: selection.responseId,
        responseTitle: selection.responseTitle,
      };
    });

    expect(mapped).toStrictEqual([
      {
        approvedReviewCategory: "Lower review priority",
        bandId: "map-ramp-1",
        hasActivities: true,
        responseId: "continue-routine-review",
        responseTitle: "Continue routine review",
      },
      {
        approvedReviewCategory: "Lower review priority",
        bandId: "map-ramp-2",
        hasActivities: true,
        responseId: "continue-routine-review",
        responseTitle: "Continue routine review",
      },
      {
        approvedReviewCategory: "Moderate review priority",
        bandId: "map-ramp-3",
        hasActivities: true,
        responseId: "monitor-the-pattern",
        responseTitle: "Monitor the pattern",
      },
      {
        approvedReviewCategory: "Moderate review priority",
        bandId: "map-ramp-4",
        hasActivities: true,
        responseId: "verify-with-local-information",
        responseTitle: "Verify with local information",
      },
      {
        approvedReviewCategory: "Highest review priority",
        bandId: "map-ramp-5",
        hasActivities: true,
        responseId: "prioritize-targeted-follow-up",
        responseTitle: "Prioritize targeted follow-up",
      },
      {
        approvedReviewCategory: "Highest review priority",
        bandId: "map-ramp-6",
        hasActivities: true,
        responseId: "prioritize-targeted-follow-up",
        responseTitle: "Prioritize targeted follow-up",
      },
    ]);
  });

  it("keeps a watch label when the light-green band is approved as moderate", () => {
    const watch = selectSuggestedFollowUp(
      evidence({
        color: "#87b982",
        priority: "Watch — Monitor signals",
      })
    );

    expect({
      approvedReviewCategory: watch.approvedReviewCategory,
      authoritativeReviewCategory: watch.authoritativeReviewCategory,
      conflict: watch.categoryConflict,
      responseTitle: watch.responseTitle,
    }).toStrictEqual({
      approvedReviewCategory: "Moderate review priority",
      authoritativeReviewCategory: "Monitor for changes",
      conflict: expect.stringContaining("map-ramp-3"),
      responseTitle: "Monitor the pattern",
    });
  });

  it("keeps a moderate label when the orange band is approved as highest", () => {
    const orangePriority2 = selectSuggestedFollowUp(
      evidence({
        color: "#f49a32",
        priority: "Priority 2 — Review",
      })
    );

    expect({
      approvedReviewCategory: orangePriority2.approvedReviewCategory,
      authoritativeReviewCategory: orangePriority2.authoritativeReviewCategory,
      conflict: orangePriority2.categoryConflict,
    }).toStrictEqual({
      approvedReviewCategory: "Highest review priority",
      authoritativeReviewCategory: "Moderate review priority",
      conflict: expect.stringContaining("map-ramp-5"),
    });
  });

  it("reports no category conflict when the red-orange band matches priority 1", () => {
    const aligned = selectSuggestedFollowUp(
      evidence({
        color: "#e9602b",
        priority: "Priority 1 — Investigate",
      })
    );

    expect({
      authoritativeReviewCategory: aligned.authoritativeReviewCategory,
      categoryConflict: aligned.categoryConflict,
    }).toStrictEqual({
      authoritativeReviewCategory: "Highest review priority",
      categoryConflict: null,
    });
  });

  it("does not assign a response from an out-of-scope or unknown color", () => {
    const unresolved = ["#e4e9ea", "", "#000000"].map((color) => {
      const selection = selectSuggestedFollowUp(evidence({ color }));
      return {
        activities: selection.activities,
        approvedReviewCategory: selection.approvedReviewCategory,
        responseId: selection.responseId,
      };
    });

    expect(unresolved).toStrictEqual([
      { activities: [], approvedReviewCategory: null, responseId: null },
      { activities: [], approvedReviewCategory: null, responseId: null },
      { activities: [], approvedReviewCategory: null, responseId: null },
    ]);
  });

  it("uses general activities when evidence does not support a tailored suggestion", () => {
    const selection = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "Present",
        incidenceFloor2023: 20,
      })
    );

    expect({
      generalFallbackNote: selection.generalFallbackNote,
      interpretationNote: selection.interpretationNote,
      untailored: selection.activities.every(
        (activity) => activity.whyThisSuggestion === null
      ),
    }).toStrictEqual({
      generalFallbackNote: GENERAL_REVIEW_STEPS_NOTE,
      interpretationNote: SUGGESTED_FOLLOW_UP_INTERPRETATION,
      untailored: true,
    });
  });

  it("prioritizes tick, human, and exposure checks for pathogen presence with low incidence", () => {
    const selection = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "Present",
        caseCountFloor2023: 0,
        color: "#efc64a",
        incidenceFloor2023: 4,
        priority: "Priority 2 — Review",
        tickStatus: "Reported",
      })
    );
    const tickWhy = whyFor(selection, "review-tick-evidence-behind-flag");

    expect({
      fallback: selection.generalFallbackNote,
      tailored: selection.activities
        .filter((activity) => activity.whyThisSuggestion !== null)
        .map((activity) => activity.id),
      tickWhy,
      transmissionClaim: publicText(selection).includes(
        "local transmission is established"
      ),
    }).toStrictEqual({
      fallback: null,
      tailored: [
        "check-human-surveillance-context",
        "clarify-likely-exposure-location",
        "review-tick-evidence-behind-flag",
      ],
      tickWhy: expect.stringContaining("observed zero"),
      transmissionClaim: false,
    });
  });

  it("does not treat the breakpoint boundary or a missing breakpoint as low incidence", () => {
    const atBreakpoint = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "Present",
        incidenceFloor2023: 10,
      })
    );
    const missingBreakpoint = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "Present",
        incidenceFloor2023: 1,
        lowIncidenceBreakpoint: null,
      })
    );

    expect(
      [atBreakpoint, missingBreakpoint].map((selection) =>
        selection.activities.some((activity) =>
          activity.whyThisSuggestion?.includes("low-incidence breakpoint")
        )
      )
    ).toStrictEqual([false, false]);
  });

  it("keeps a missing human record distinct from zero and from an assumed score input", () => {
    const missing = selectSuggestedFollowUp(
      evidence({
        caseCountFloor2023: null,
        humanStatus: "no_county_linked_record",
        incidenceFloor2023: null,
      })
    );
    const zero = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "No records",
        caseCountFloor2023: 0,
        humanStatus: "published_count_floor",
        incidenceFloor2023: 0,
      })
    );

    expect({
      missingWhy: whyFor(missing, "review-updated-surveillance-data"),
      zeroAssumed: zero.activities.some((activity) =>
        activity.whyThisSuggestion?.includes("missing-human assumption")
      ),
    }).toStrictEqual({
      missingWhy: expect.stringContaining("not an observed case count"),
      zeroAssumed: false,
    });
  });

  it("distinguishes no pathogen record and unknown pathogen status from a negative test", () => {
    const noRecord = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "No records",
        tickStatus: "Reported",
      })
    );
    const unknown = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "Unknown",
        tickStatus: "Established",
      })
    );

    expect({
      noRecordWhy: whyFor(noRecord, "keep-local-tick-information-current"),
      unknownMentionsNegative: publicText(unknown)
        .toLowerCase()
        .includes("negative test"),
      unknownWhy: whyFor(unknown, "keep-local-tick-information-current"),
    }).toStrictEqual({
      noRecordWhy: expect.stringContaining("No records"),
      unknownMentionsNegative: false,
      unknownWhy: expect.stringContaining("Unknown"),
    });
  });

  it("adds the limited-tick note only for missing published tick records on routine review", () => {
    const missing = selectSuggestedFollowUp(
      evidence({
        pacificusStatus: "No records",
        scapularisStatus: null,
        tickStatus: "No records",
      })
    );
    const unknown = selectSuggestedFollowUp(
      evidence({
        pacificusStatus: null,
        scapularisStatus: null,
        tickStatus: "Unknown",
      })
    );
    const documented = selectSuggestedFollowUp(
      evidence({
        scapularisStatus: "Reported",
        tickStatus: "No records",
      })
    );

    expect({
      documented: documented.tickLimitedNote,
      missing: missing.tickLimitedNote,
      unknown: unknown.tickLimitedNote,
    }).toStrictEqual({
      documented: null,
      missing: TICK_INFORMATION_LIMITED_NOTE,
      unknown: null,
    });
  });

  it("adds the single-period caveat for monitoring and does not claim a trend", () => {
    const onePeriod = selectSuggestedFollowUp(
      evidence({
        color: "#87b982",
        comparableReportingPeriods: 1,
        priority: "Watch — Monitor signals",
      })
    );
    const comparable = selectSuggestedFollowUp(
      evidence({
        color: "#87b982",
        comparableReportingPeriods: 2,
        priority: "Watch — Monitor signals",
      })
    );

    expect({
      comparableNote: comparable.singlePeriodNote,
      onePeriodNote: onePeriod.singlePeriodNote,
      trendClaim: `${publicText(onePeriod)}\n${publicText(comparable)}`
        .toLowerCase()
        .includes("increasing trend"),
    }).toStrictEqual({
      comparableNote: null,
      onePeriodNote: SINGLE_PERIOD_NOTE,
      trendClaim: false,
    });
  });

  it("asks about displayed access context without treating it as underdiagnosis", () => {
    const percentOnly = selectSuggestedFollowUp(
      evidence({
        uninsuredPercent: 14,
      })
    );
    const percentile = selectSuggestedFollowUp(
      evidence({
        color: "#e9602b",
        priority: "Priority 1 — Investigate",
        sviPercentile: 0.8,
        uninsuredPercentile: 0.4,
      })
    );
    const percentWhy = whyFor(
      percentOnly,
      "consider-focused-education-or-outreach"
    );
    const scoreWhy = whyFor(
      percentile,
      "consider-focused-education-or-outreach"
    );

    expect({
      outreachCount: percentile.activities.filter(
        (activity) => activity.id === "consider-focused-education-or-outreach"
      ).length,
      percentWhy,
      scoreWhy,
    }).toStrictEqual({
      outreachCount: 1,
      percentWhy: expect.stringContaining(
        "does not treat it as a score contribution"
      ),
      scoreWhy: expect.stringContaining("social vulnerability percentile"),
    });
  });

  it("suppresses duplicate activities when several rules select the same suggestion", () => {
    const selection = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "No records",
        color: "#e9602b",
        humanStatus: "no_county_linked_record",
        incidenceFloor2023: null,
        priority: "Priority 1 — Investigate",
        rucc2023: 8,
        sviPercentile: 0.9,
        tickStatus: "Reported",
      })
    );
    const ids = selection.activities.map((activity) => activity.id);

    expect({
      first: ids[0],
      ids,
      unique: new Set(ids).size,
    }).toStrictEqual({
      first: "review-human-surveillance-findings",
      ids,
      unique: ids.length,
    });
  });

  it("keeps species guidance aligned with the documented tick and omits retired phrases", () => {
    const western = selectSuggestedFollowUp(
      evidence({
        burgdorferiStatus: "Unknown",
        pacificusStatus: "Established",
        scapularisStatus: "No records",
        tickStatus: "Established",
      })
    );
    const text = publicText(western);

    expect({
      resources: western.activities
        .find(
          (activity) => activity.id === "keep-local-tick-information-current"
        )
        ?.resources.map((resource) => resource.id),
      retired: RETIRED_FOLLOW_UP_PHRASES.some((phrase) =>
        text.includes(phrase)
      ),
      showsIdentifier: western.activities.some(
        (activity) => activity.title === activity.id
      ),
      deadline: text.includes("within 2 weeks"),
    }).toStrictEqual({
      resources: ["tick-pathogen-records", "western-blacklegged-tick-guidance"],
      retired: false,
      showsIdentifier: false,
      deadline: false,
    });
  });
});
