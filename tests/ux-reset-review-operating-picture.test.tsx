import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import { buildReviewCandidatePreview } from "@/features/ux-reset/review/review-candidate-preview";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  reviewMapCounties,
  reviewPictureState,
  reviewPictureSummary,
} from "@/features/ux-reset/review/review-operating-state";
import type { Candidate, StateReview } from "@/generated/models";
import { formatAtlasTimestamp } from "@/lib/atlas-evidence-metadata";

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

  it("surfaces every reference limitation, version, and retrieval timestamp", () => {
    const candidate = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    const referenceLimitations = [
      "Pathogen status is cumulative.",
      "Vector reports omit collection dates.",
      "Human counts are a snapshot.",
    ];
    const versions = ["pathogen-v1", "vector-v2", "human-v3"] as const;
    const retrievedAt = [
      "2026-01-02T03:04:05.000Z",
      "2026-02-03T04:05:06.000Z",
      "2026-03-04T05:06:07.000Z",
    ] as const;
    const records = [
      "public/08001-pathogen",
      "public/08001-vector",
      "public/08001-human",
    ] as const;
    candidate.evidence_references = [
      {
        ...reviewEvidenceReference("08001"),
        limitations: [referenceLimitations[0]],
        public_record_ref: records[0],
        retrieved_at: retrievedAt[0],
        source_version: versions[0],
      },
      {
        ...reviewEvidenceReference("08001", "Reported"),
        family: "vector",
        limitations: [referenceLimitations[1]],
        public_record_ref: records[1],
        retrieved_at: retrievedAt[1],
        source_product: "CDC vector county status",
        source_version: versions[1],
        target: "Ixodes scapularis",
      },
      {
        ...reviewEvidenceReference("08001", "Established"),
        family: "human",
        limitations: [referenceLimitations[2]],
        public_record_ref: records[2],
        retrieved_at: retrievedAt[2],
        source_product: "CDC human county snapshot",
        source_version: versions[2],
        target: "Human surveillance",
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
    const summary = provenance?.inspectSummary ?? "";
    const limitations = provenance?.limitations ?? [];
    expect({
      evidenceType: provenance?.evidenceType,
      limitations: limitations.filter((limitation) =>
        referenceLimitations.includes(limitation)
      ),
      observationPeriod: provenance?.observationPeriod,
      records: records.every((record) => summary.includes(record)),
      retrievals: retrievedAt.every((retrieved) => summary.includes(retrieved)),
      versions: versions.every((version) => summary.includes(version)),
    }).toStrictEqual({
      evidenceType: "Unavailable",
      limitations: [...referenceLimitations],
      observationPeriod: "Unavailable",
      records: true,
      retrievals: true,
      versions: true,
    });
  });

  it("keeps compact and inspect caveats and families aligned", () => {
    const absentCaveat =
      "The review result did not include an additional caveat.";
    const referenceOnly = "Vector reports omit collection dates.";
    const candidateLimitation = "Candidate limitation.";
    const sharedCaveat = "Shared caveat";
    const referenceCaveat = "Reference only";
    const freshness = "Cumulative through 2025.";
    const blankCandidate = (overrides: Partial<Candidate>): Candidate => ({
      ...reviewCandidate({
        caveat: "replaced",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_families: [],
      evidence_references: [],
      freshness_comparability: "",
      limitations: [],
      reason_codes: [],
      ...overrides,
    });
    const displayed = (candidate: Candidate) => {
      const preview = buildReviewCandidatePreview({
        candidate,
        methodologyId: "atlas-county-review",
        methodologyVersion: "1.0.0",
        stateCode: "CO",
        stateName: "Colorado",
      });
      const qualification = preview.qualification;
      if (!qualification) {
        throw new Error("Expected candidate qualification.");
      }
      const view = render(
        <>
          <EvidenceStateStrip model={qualification} />
          {qualification.reasonCode ? (
            <EvidenceProvenanceInspect
              availability={qualification.availability}
              provenance={qualification.provenance}
              reasonCode={qualification.reasonCode}
            />
          ) : (
            <EvidenceProvenanceInspect
              provenance={qualification.provenance}
              stateLabel={evidenceAvailabilityLabel(qualification.availability)}
            />
          )}
        </>
      );
      const strip = view.container.querySelector(".ux-reset-evidence-strip");
      const compact =
        strip?.querySelector(".ux-reset-evidence-caveat")?.textContent ?? "";
      const sourceFamily = strip?.querySelector("dd")?.textContent ?? "";
      const inspectItems = [
        ...view.container.querySelectorAll(
          "[data-testid='evidence-provenance-limitations'] li"
        ),
      ].map((item) => item.textContent ?? "");
      const inspectSource =
        view.container
          .querySelector("[data-testid='evidence-provenance-source'] dd")
          ?.textContent?.trim() ?? "";
      const referenceLine =
        view.container.querySelector(
          "[data-testid='evidence-provenance-references']"
        )?.textContent ?? "";
      cleanup();
      return {
        compact,
        inspectItems,
        inspectSource,
        referenceLine,
        sourceFamily,
      };
    };
    const reference = reviewEvidenceReference("08001");
    expect({
      duplicates: displayed(
        blankCandidate({
          evidence_families: [" pathogen ", "vector", "pathogen"],
          evidence_references: [
            {
              ...reference,
              family: "pathogen",
              limitations: [` ${sharedCaveat} `, referenceCaveat],
            },
            {
              ...reference,
              family: " vector ",
              limitations: [referenceCaveat, sharedCaveat],
            },
          ],
          freshness_comparability: sharedCaveat,
          limitations: [sharedCaveat, ` ${sharedCaveat} `],
        })
      ),
      empty: displayed(
        blankCandidate({
          evidence_families: ["", "  "],
          evidence_references: [
            { ...reference, family: "   ", limitations: ["", "  "] },
          ],
          freshness_comparability: "   ",
          limitations: [" ", ""],
        })
      ),
      partialReferences: displayed(
        blankCandidate({
          evidence_families: ["pathogen", "vector"],
          evidence_references: [
            { ...reference, family: "pathogen", limitations: [] },
          ],
          freshness_comparability: freshness,
        })
      ),
      referenceOnlyCaveat: displayed(
        blankCandidate({
          evidence_families: ["pathogen"],
          evidence_references: [{ ...reference, limitations: [referenceOnly] }],
        })
      ),
      summaryOnlyFamilies: displayed(
        blankCandidate({
          evidence_families: ["pathogen", "vector"],
          limitations: [candidateLimitation],
        })
      ),
    }).toStrictEqual({
      duplicates: {
        compact: `${sharedCaveat} ${referenceCaveat}`,
        inspectItems: [sharedCaveat, referenceCaveat],
        inspectSource: "pathogen, vector",
        referenceLine: expect.stringContaining("version 2025"),
        sourceFamily: "pathogen, vector",
      },
      empty: {
        compact: absentCaveat,
        inspectItems: [],
        inspectSource: "Unavailable",
        referenceLine: expect.stringContaining("Unavailable"),
        sourceFamily: "Unavailable",
      },
      partialReferences: {
        compact: freshness,
        inspectItems: [freshness],
        inspectSource: "pathogen, vector",
        referenceLine: expect.stringContaining("version 2025"),
        sourceFamily: "pathogen, vector",
      },
      referenceOnlyCaveat: {
        compact: referenceOnly,
        inspectItems: [referenceOnly],
        inspectSource: "pathogen",
        referenceLine: expect.stringContaining("version 2025"),
        sourceFamily: "pathogen",
      },
      summaryOnlyFamilies: {
        compact: candidateLimitation,
        inspectItems: [candidateLimitation],
        inspectSource: "pathogen, vector",
        referenceLine: "",
        sourceFamily: "pathogen, vector",
      },
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

  it("keeps gap source family and observation period unavailable", () => {
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Environmental context stays a data gap.",
    };
    const effectiveContext =
      "Current cumulative county status; human snapshot 2023";
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const picture = (review: StateReview) => (
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const reviews = [
      buildStateReview({
        gaps: [gap],
        resultState: "unsupported",
        state: "CO",
      }),
      buildStateReview({
        gaps: [gap],
        resultState: "insufficient_evidence",
        state: "CO",
      }),
      buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Denver",
            fips: "08001",
            reasonText: "Denver was returned by the method.",
          }),
        ],
        gaps: [gap],
        resultState: "candidates_found",
        state: "CO",
      }),
      buildStateReview({
        gaps: [gap],
        resultState: "none_stand_out",
        state: "CO",
      }),
    ];
    const snapshots = reviews.map((review) => {
      const view = render(picture(review));
      const gaps = screen.getByTestId("review-data-gaps");
      const gapText = screen.getByTestId("review-data-gap").textContent ?? "";
      const header = screen.getByTestId("review-methodology").textContent ?? "";
      const snapshot = {
        evidenceType:
          within(gaps).getByText("Evidence type").nextElementSibling
            ?.textContent,
        gapCode: gapText.includes(gap.code),
        gapDetail: gapText.includes(gap.detail),
        headerContext: header.includes(effectiveContext),
        observationPeriod:
          within(gaps).getByText("Observation period").nextElementSibling
            ?.textContent,
        resultState:
          screen.getByTestId("review-state-panel").dataset.resultState,
        sourceFamily:
          within(gaps).getByText("Source family").nextElementSibling
            ?.textContent,
      };
      view.unmount();
      return snapshot;
    });
    expect(snapshots).toStrictEqual([
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "data_gap_only",
        sourceFamily: "Unavailable",
      },
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "insufficient_evidence",
        sourceFamily: "Unavailable",
      },
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "candidates_found",
        sourceFamily: "Unavailable",
      },
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "none_stand_out",
        sourceFamily: "Unavailable",
      },
    ]);
  });

  it("shows evaluation time and configuration in the result provenance", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const picture = (review: StateReview) => (
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const present = buildStateReview({
      resultState: "none_stand_out",
      state: "CO",
    });
    const absent = buildStateReview({
      resultState: "insufficient_evidence",
      state: "CO",
    });
    absent.evaluated_at = " ";
    absent.configuration_sha256 = "";
    const read = (review: StateReview) => {
      const view = render(picture(review));
      const provenance = screen.getByTestId("review-result-provenance");
      fireEvent.click(within(provenance).getByText("Inspect provenance"));
      fireEvent.click(
        within(provenance).getByText("Technical reproducibility identifiers")
      );
      const value = (label: string) =>
        within(provenance).getByText(label).nextElementSibling?.textContent ??
        "";
      const snapshot = {
        configuration: value("Configuration"),
        evaluatedAt: value("Evaluated at"),
      };
      view.unmount();
      return snapshot;
    };
    const formatted = formatAtlasTimestamp(present.evaluated_at);
    expect({
      absent: read(absent),
      present: read(present),
    }).toStrictEqual({
      absent: {
        configuration: "Unavailable",
        evaluatedAt: "Unavailable",
      },
      present: {
        configuration: present.configuration_sha256,
        evaluatedAt: `${formatted} UTC (${present.evaluated_at})`,
      },
    });
  });

  it("shows the API result state without inventing a material limitation", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const empty = buildStateReview({
      resultState: "none_stand_out",
      state: "CO",
    });
    empty.limitations = [];
    const withLimitation = buildStateReview({
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
    });
    const read = (review: StateReview) => {
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={review}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const provenance = screen.getByTestId("review-result-provenance");
      fireEvent.click(within(provenance).getByText("Inspect provenance"));
      const state =
        within(provenance).getByTestId("evidence-provenance-state")
          .textContent ?? "";
      const limitations =
        within(provenance).getByTestId("evidence-provenance-limitations")
          .textContent ?? "";
      view.unmount();
      return {
        inventedLimited: state.includes("Limited"),
        inventedMaterial: limitations.includes("Material limitation"),
        limitations,
        state,
      };
    };
    expect({
      empty: read(empty),
      withLimitation: read(withLimitation),
    }).toStrictEqual({
      empty: {
        inventedLimited: false,
        inventedMaterial: false,
        limitations: expect.stringContaining(
          "No governed limitations were returned."
        ),
        state: expect.stringContaining("Nothing stands out"),
      },
      withLimitation: {
        inventedLimited: false,
        inventedMaterial: false,
        limitations: expect.stringContaining(
          "Review is not disease risk. Candidates come only from the review result."
        ),
        state: expect.stringContaining("Candidates found"),
      },
    });
  });

  it("keeps reason codes out of governed limitations", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const reasonCode = "PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW";
    const caveat = "Collection dates are unavailable.";
    const withoutCaveat = reviewCandidate({
      caveat: "replaced",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    withoutCaveat.evidence_references = [
      { ...reviewEvidenceReference("08001"), limitations: [] },
    ];
    withoutCaveat.freshness_comparability = "";
    withoutCaveat.limitations = [];
    withoutCaveat.reason_codes = [reasonCode];
    const withCaveat = reviewCandidate({
      caveat,
      countyName: "Boulder",
      fips: "08013",
      reasonText: "Boulder was returned by the method.",
    });
    withCaveat.reason_codes = [reasonCode];
    const read = (candidate: Candidate) => {
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={buildStateReview({
              candidates: [candidate],
              resultState: "candidates_found",
              state: "CO",
            })}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const qualification = screen.getByTestId("review-preview-qualification");
      fireEvent.click(within(qualification).getByText("Inspect provenance"));
      const limitations =
        within(qualification).getByTestId("evidence-provenance-limitations")
          .textContent ?? "";
      const state =
        within(qualification).getByTestId("evidence-provenance-state")
          .textContent ?? "";
      const codes = screen.getByTestId("review-reason-codes").textContent ?? "";
      view.unmount();
      return {
        codes,
        limitationsIncludeCode: limitations.includes(reasonCode),
        limitationsIncludeReasonLabel: limitations.includes("Reason code"),
        materialReason: state.includes("Coverage or methodology limits apply"),
        state,
      };
    };
    expect({
      withCaveat: read(withCaveat),
      withoutCaveat: read(withoutCaveat),
    }).toStrictEqual({
      withCaveat: {
        codes: expect.stringContaining(reasonCode),
        limitationsIncludeCode: false,
        limitationsIncludeReasonLabel: false,
        materialReason: true,
        state: expect.stringContaining("Limited"),
      },
      withoutCaveat: {
        codes: expect.stringContaining(reasonCode),
        limitationsIncludeCode: false,
        limitationsIncludeReasonLabel: false,
        materialReason: false,
        state: "Evidence stateLimited",
      },
    });
  });

  it("shows abstained counties when candidates were found", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Environmental context stays a data gap.",
    };
    const found = buildStateReview({
      candidates: [candidate],
      gaps: [gap],
      resultState: "candidates_found",
      state: "CO",
    });
    found.coverage.abstained_counties = 1;
    found.coverage.rule_coverage = {
      human_emerging: "disabled",
      pathogen_present_vector_reported: "enabled",
    };
    const noneAbstained = buildStateReview({
      candidates: [candidate],
      resultState: "candidates_found",
      state: "CO",
    });
    const insufficient = buildStateReview({
      gaps: [gap],
      resultState: "insufficient_evidence",
      state: "CO",
    });
    insufficient.coverage.abstained_counties = 2;
    const read = (review: StateReview) => {
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={review}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const section = screen.queryByTestId("review-abstained-outcomes");
      const text = section?.textContent ?? "";
      const rules = section
        ? [...section.querySelectorAll("li")].map(
            (item) => item.textContent ?? ""
          )
        : [];
      const snapshot = {
        candidate: Boolean(screen.queryByTestId("review-candidate")),
        gap: Boolean(screen.queryByTestId("review-data-gap")),
        namesCounty: text.includes("Denver") || text.includes("08001"),
        rules,
        text,
      };
      view.unmount();
      return snapshot;
    };
    expect({
      found: read(found),
      insufficient: read(insufficient),
      noneAbstained: read(noneAbstained),
    }).toStrictEqual({
      found: {
        candidate: true,
        gap: true,
        namesCounty: false,
        rules: [
          "human_emerging: disabled",
          "pathogen_present_vector_reported: enabled",
        ],
        text: expect.stringContaining(
          "1 county abstained. The review result did not name that county."
        ),
      },
      insufficient: {
        candidate: false,
        gap: true,
        namesCounty: false,
        rules: [],
        text: "",
      },
      noneAbstained: {
        candidate: true,
        gap: false,
        namesCounty: false,
        rules: [],
        text: "",
      },
    });
  });
});
