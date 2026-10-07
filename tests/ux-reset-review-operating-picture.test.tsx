import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { buildReviewCandidatePreview } from "@/features/ux-reset/review/review-candidate-preview";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  reviewMapCounties,
  reviewPictureState,
  reviewPictureSummary,
} from "@/features/ux-reset/review/review-operating-state";
import type { StateReview } from "@/generated/models";

import {
  buildStateReview,
  reviewCandidate,
  reviewEvidenceReference,
} from "./fixtures/review-operating-picture-fixtures";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/review",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: vi.fn<typeof actual.fetchCountyDisplayGeometry>(
      async () => ({
        features: [],
        type: "FeatureCollection",
      })
    ),
  };
});

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
      methodologyId: "atlas-county-review",
      methodologyVersion: "1.0.0",
      stateCode: "CO",
      stateName: "Colorado",
    });
    const provenance = preview.qualification?.provenance;
    expect({
      availability: preview.availability,
      caveat: preview.caveat,
      evidenceType: provenance?.evidenceType,
      followUpLabel: preview.followUpLabel,
      observationPeriod: provenance?.observationPeriod,
      observedBasis: preview.observedBasis,
      sourceFamily: provenance?.sourceFamily,
      why: preview.why,
      zeroCases: /0 cases/.test(`${preview.why} ${preview.caveat}`),
    }).toStrictEqual({
      availability: "limited",
      caveat: expect.stringContaining("Collection dates are unavailable"),
      evidenceType: "Unavailable",
      followUpLabel: "Suggested next check",
      observationPeriod: "Unavailable",
      observedBasis: expect.stringContaining("Present"),
      sourceFamily: "pathogen",
      why: "Denver was returned by the method.",
      zeroCases: false,
    });
  });

  it("keeps governed provenance unavailable and lists every reference family", () => {
    const candidate = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    const pathogen = candidate.evidence_references[0];
    if (!pathogen) {
      throw new Error("Expected a review evidence reference.");
    }
    candidate.evidence_references = [
      pathogen,
      {
        ...reviewEvidenceReference("08001", "Reported"),
        family: "vector",
        public_record_ref: "public/08001-vector",
        source_as_of: "2024-06-01",
        source_product: "CDC vector county status",
        target: "Ixodes scapularis",
      },
    ];
    const preview = buildReviewCandidatePreview({
      candidate,
      methodologyId: "atlas-county-review",
      methodologyVersion: "1.0.0",
      stateCode: "CO",
      stateName: "Colorado",
    });
    const provenance = preview.qualification?.provenance;
    expect({
      evidenceType: provenance?.evidenceType,
      inspectsVector: provenance?.inspectSummary.includes(
        "CDC vector county status"
      ),
      observationPeriod: provenance?.observationPeriod,
      provenanceRef: provenance?.technical?.provenanceRef ?? null,
      sourceFamily: provenance?.sourceFamily,
      sourceId: provenance?.technical?.sourceId ?? null,
      usesSourceDateAsPeriod:
        provenance?.observationPeriod === "2025-12-31" ||
        provenance?.observationPeriod === "2024-06-01",
    }).toStrictEqual({
      evidenceType: "Unavailable",
      inspectsVector: true,
      observationPeriod: "Unavailable",
      provenanceRef: null,
      sourceFamily: "pathogen, vector",
      sourceId: null,
      usesSourceDateAsPeriod: false,
    });
  });

  it("clears a stale county when the result has no candidates", async () => {
    const onCountyChange =
      vi.fn<(fips: string | null, history: "push" | "replace") => void>();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Environmental context stays a data gap.",
    };
    const picture = (review: StateReview) => (
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          county="08001"
          period="2023-01-01"
          review={review}
          scopeCode="NY"
          stateName="New York"
          onCountyChange={onCountyChange}
        />
      </QueryClientProvider>
    );
    let view = render(
      picture(
        buildStateReview({
          candidates: [
            reviewCandidate({
              caveat: "Collection dates are unavailable.",
              countyName: "Denver",
              fips: "08001",
              reasonText: "Denver was returned by the method.",
            }),
          ],
          resultState: "candidates_found",
          state: "CO",
        })
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("review-candidate")).toBeTruthy()
    );
    expect(onCountyChange).not.toHaveBeenCalled();
    const noCandidateReviews = [
      buildStateReview({ resultState: "none_stand_out", state: "NY" }),
      buildStateReview({
        gaps: [gap],
        resultState: "insufficient_evidence",
        state: "NY",
      }),
      buildStateReview({
        gaps: [gap],
        resultState: "unsupported",
        state: "NY",
      }),
    ];
    const cleared: string[] = [];
    view.rerender(picture(noCandidateReviews[0]));
    for (const [index, review] of noCandidateReviews.entries()) {
      if (index > 0) {
        view.unmount();
        onCountyChange.mockClear();
        view = render(picture(review));
      }
      await waitFor(() => {
        if (onCountyChange.mock.calls.length === 0) {
          throw new Error("county was not cleared");
        }
      });
      const call = onCountyChange.mock.calls[0];
      cleared.push(call ? `${String(call[0])}:${call[1]}` : "missing");
    }
    view.unmount();
    expect(cleared).toStrictEqual([
      "null:replace",
      "null:replace",
      "null:replace",
    ]);
  });
});
