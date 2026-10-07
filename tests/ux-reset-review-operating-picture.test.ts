import { describe, expect, it } from "vitest";

import { buildReviewCandidatePreview } from "@/features/ux-reset/review/review-candidate-preview";
import {
  reviewMapCounties,
  reviewPictureState,
  reviewPictureSummary,
} from "@/features/ux-reset/review/review-operating-state";

import {
  buildStateReview,
  reviewCandidate,
} from "./fixtures/review-operating-picture-fixtures";

describe("Review operating picture state", () => {
  it("keeps backend result states distinct and does not promote gaps", () => {
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Environmental context stays a data gap.",
    };
    const found = buildStateReview({
      candidates: [
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Zed",
          fips: "08099",
          reasonText: "Zed was returned by the method.",
        }),
        reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Adams",
          fips: "08001",
          reasonText: "Adams was returned by the method.",
        }),
      ],
      gaps: [gap],
      resultState: "candidates_found",
      state: "CO",
    });
    const insufficientSummary = reviewPictureSummary("insufficient_evidence");
    expect({
      dataGapOnly: reviewPictureState(
        buildStateReview({
          gaps: [gap],
          resultState: "unsupported",
          state: "CO",
        })
      ),
      found: reviewPictureState(found),
      fips: found.review_candidates.map((entry) => entry.county_fips),
      gapPromoted: found.review_candidates.some(
        (entry) => entry.county_fips === "08031"
      ),
      insufficient: reviewPictureState(
        buildStateReview({
          gaps: [gap],
          resultState: "insufficient_evidence",
          state: "CO",
        })
      ),
      insufficientMentionsNothing:
        insufficientSummary.includes("Nothing stands out"),
      none: reviewPictureState(
        buildStateReview({ resultState: "none_stand_out", state: "CO" })
      ),
      noneSummary: reviewPictureSummary("none_stand_out"),
      unsupported: reviewPictureState(
        buildStateReview({ resultState: "unsupported", state: "CO" })
      ),
    }).toStrictEqual({
      dataGapOnly: "data_gap_only",
      found: "candidates_found",
      fips: ["08099", "08001"],
      gapPromoted: false,
      insufficient: "insufficient_evidence",
      insufficientMentionsNothing: false,
      none: "none_stand_out",
      noneSummary: expect.stringContaining("Nothing stands out"),
      unsupported: "unsupported",
    });
  });

  it("frames the map to state geometry and keeps candidate order without geometry", () => {
    expect(
      reviewMapCounties({
        candidateFips: ["08001"],
        geometryFips: ["08001", "08031", "36001"],
        scopeCode: "CO",
      }).map((entry) => entry.fips)
    ).toStrictEqual(["08001", "08031"]);
    expect(
      reviewMapCounties({
        candidateFips: ["08099", "08001"],
        geometryFips: [],
        scopeCode: "CO",
      }).map((entry) => entry.fips)
    ).toStrictEqual(["08099", "08001"]);
  });

  it("builds a limited candidate preview from the returned record", () => {
    const preview = buildReviewCandidatePreview({
      candidate: reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      effectiveContext: "Current cumulative county status",
      methodologyId: "atlas-county-review",
      methodologyVersion: "1.0.0",
      stateCode: "CO",
      stateName: "Colorado",
    });
    expect({
      availability: preview.availability,
      caveat: preview.caveat,
      followUpLabel: preview.followUpLabel,
      observedBasis: preview.observedBasis,
      why: preview.why,
      zeroCases: /0 cases/.test(`${preview.why} ${preview.caveat}`),
    }).toStrictEqual({
      availability: "limited",
      caveat: expect.stringContaining("Collection dates are unavailable"),
      followUpLabel: "Suggested next check",
      observedBasis: expect.stringContaining("Present"),
      why: "Denver was returned by the method.",
      zeroCases: false,
    });
  });
});
