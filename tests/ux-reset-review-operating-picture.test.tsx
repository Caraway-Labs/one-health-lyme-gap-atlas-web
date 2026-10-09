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
  normalizeReviewCounty,
  reviewCandidateFipsForScope,
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
        features: [
          {
            geometry: { coordinates: [-104.8, 39.8], type: "Point" },
            properties: { fips: "08001" },
            type: "Feature",
          },
          {
            geometry: { coordinates: [-73.9, 42.6], type: "Point" },
            properties: { fips: "36001" },
            type: "Feature",
          },
        ],
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

  it("keeps a review county only when its prefix matches a lower-48 scope", () => {
    expect({
      all: normalizeReviewCounty("ALL", "08001"),
      blank: normalizeReviewCounty("CO", null),
      dcMatch: normalizeReviewCounty("DC", "11001"),
      dcMismatch: normalizeReviewCounty("DC", "08001"),
      match: normalizeReviewCounty("NY", "36001"),
      mismatch: normalizeReviewCounty("NY", "08001"),
      trimmed: normalizeReviewCounty("NY", " 36001 "),
      unsupported: normalizeReviewCounty("PR", "08001"),
    }).toStrictEqual({
      all: "08001",
      blank: null,
      dcMatch: "11001",
      dcMismatch: null,
      match: "36001",
      mismatch: null,
      trimmed: "36001",
      unsupported: null,
    });
  });

  it("accepts review geography only inside the requested lower-48 state", () => {
    expect({
      alaska: reviewCandidateFipsForScope("02013", "AK"),
      blank: reviewCandidateFipsForScope(" ", "CO"),
      hawaii: reviewCandidateFipsForScope("15001", "HI"),
      malformed: reviewCandidateFipsForScope("0800", "CO"),
      match: reviewCandidateFipsForScope(" 08031 ", "CO"),
      otherState: reviewCandidateFipsForScope("36001", "CO"),
      puertoRico: reviewCandidateFipsForScope("72001", "PR"),
    }).toStrictEqual({
      alaska: null,
      blank: null,
      hawaii: null,
      malformed: null,
      match: "08031",
      otherState: null,
      puertoRico: null,
    });
  });

  it("frames the map from in-state geometry and ignores candidate identifiers", () => {
    const fips = (
      geometryFips: readonly string[],
      scopeCode: string
    ): string[] =>
      reviewMapCounties({ geometryFips, scopeCode }).map((entry) => entry.fips);
    expect({
      alaska: fips(["02013", "08001"], "AK"),
      empty: fips([], "CO"),
      hawaii: fips(["15001"], "HI"),
      inState: fips(["08001", "08031", "36001"], "CO"),
      otherState: fips(["36001", "36003"], "CO"),
    }).toStrictEqual({
      alaska: [],
      empty: [],
      hawaii: [],
      inState: ["08001", "08031"],
      otherState: [],
    });
  });

  it("shows an empty map when geometry has no features in the requested state", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    const geometry = vi.mocked(fetchCountyDisplayGeometry);
    const restore = geometry.getMockImplementation();
    geometry.mockResolvedValue({
      features: [
        {
          geometry: { coordinates: [-73.9, 42.6], type: "Point" },
          properties: { fips: "36001" },
          type: "Feature",
        },
        {
          geometry: { coordinates: [-73.7, 42.8], type: "Point" },
          properties: { fips: "36003" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    try {
      render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={buildStateReview({
              candidates: [
                reviewCandidate({
                  caveat: "Collection dates are unavailable.",
                  countyName: "Adams",
                  fips: "08001",
                  reasonText: "Adams was returned by the method.",
                }),
              ],
              resultState: "candidates_found",
              state: "CO",
            })}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      await waitFor(() => {
        if (!screen.queryByTestId("review-state-map-empty")) {
          throw new Error("empty map notice was not shown");
        }
      });
      const investigate =
        screen.getByTestId("review-investigate").getAttribute("href") ?? "";
      expect({
        candidate: screen.getByTestId("review-candidate").textContent,
        county: new URL(investigate, "http://localhost").searchParams.get(
          "county"
        ),
        empty: screen.getByTestId("review-state-map-empty").textContent,
        loading: (
          screen.getByTestId("review-state-map-region").textContent ?? ""
        ).includes("Loading map"),
        map: screen.queryByTestId("mock-atlas-map"),
        summary: screen.getByTestId("review-result-summary").textContent,
      }).toStrictEqual({
        candidate: expect.stringContaining("Adams, CO"),
        county: "08001",
        empty: "No county shapes were returned to draw for this result.",
        loading: false,
        map: null,
        summary: expect.stringContaining("counties to inspect"),
      });
    } finally {
      if (restore) {
        geometry.mockImplementation(restore);
      }
    }
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
          county="36001"
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
              countyName: "Albany",
              fips: "36001",
              reasonText: "Albany was returned by the method.",
            }),
          ],
          resultState: "candidates_found",
          state: "NY",
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

  it("does not publish a county when the result state contradicts its candidates", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Environmental context stays a data gap.",
    };
    const adams = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Adams",
      fips: "08001",
      reasonText: "Adams was returned by the method.",
    });
    const mismatches = [
      {
        name: "noneStandOut",
        review: buildStateReview({
          candidates: [adams],
          resultState: "none_stand_out",
          state: "CO",
        }),
      },
      {
        name: "insufficient",
        review: buildStateReview({
          candidates: [adams],
          gaps: [gap],
          resultState: "insufficient_evidence",
          state: "CO",
        }),
      },
      {
        name: "unsupported",
        review: buildStateReview({
          candidates: [adams],
          gaps: [gap],
          resultState: "unsupported",
          state: "CO",
        }),
      },
      {
        name: "emptyFound",
        review: buildStateReview({
          resultState: "candidates_found",
          state: "CO",
        }),
      },
      {
        name: "emptyFoundWithGaps",
        review: buildStateReview({
          gaps: [gap],
          resultState: "candidates_found",
          state: "CO",
        }),
      },
    ] as const;
    const onCountyChange =
      vi.fn<(fips: string | null, history: "push" | "replace") => void>();
    const readMismatch = async (review: StateReview) => {
      onCountyChange.mockClear();
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            county="08001"
            review={review}
            scopeCode="CO"
            stateName="Colorado"
            onCountyChange={onCountyChange}
          />
        </QueryClientProvider>
      );
      await waitFor(() => {
        if (onCountyChange.mock.calls[0]?.[0] !== null) {
          throw new Error("county was still published");
        }
      });
      const summary =
        screen.getByTestId("review-result-summary").textContent ?? "";
      const backend =
        screen.getByTestId("review-backend-result").textContent ?? "";
      const publishedCall = onCountyChange.mock.calls[0];
      const snapshot = {
        backendClaimsFinding:
          backend.includes("Nothing stands out") ||
          backend.includes("Candidates found"),
        candidate: screen.queryByTestId("review-candidate"),
        compare: screen.queryByTestId("review-compare"),
        investigate: screen.queryByTestId("review-investigate"),
        published: publishedCall ? publishedCall[0] : "missing",
        resultState:
          screen.getByTestId("review-state-panel").dataset.resultState,
        summary,
      };
      view.unmount();
      return snapshot;
    };
    const rejected = [];
    for (const entry of mismatches) {
      rejected.push({
        ...(await readMismatch(entry.review)),
        name: entry.name,
      });
    }
    onCountyChange.mockClear();
    const keptView = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          county="08001"
          review={buildStateReview({
            candidates: [adams],
            gaps: [gap],
            resultState: "candidates_found",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
          onCountyChange={onCountyChange}
        />
      </QueryClientProvider>
    );
    await waitFor(() => {
      if (!screen.queryByTestId("review-candidate")) {
        throw new Error("consistent candidate was not shown");
      }
    });
    const kept = {
      candidate: screen.getByTestId("review-candidate").textContent,
      investigate: screen
        .getByTestId("review-investigate")
        .getAttribute("href"),
      published: onCountyChange.mock.calls.length,
      resultState: screen.getByTestId("review-state-panel").dataset.resultState,
    };
    keptView.unmount();
    const unavailable = {
      backendClaimsFinding: false,
      candidate: null,
      compare: null,
      investigate: null,
      published: null,
      resultState: "unavailable",
      summary: "Unavailable",
    };
    expect({ kept, rejected }).toStrictEqual({
      kept: {
        candidate: expect.stringContaining("Adams, CO"),
        investigate: expect.stringContaining("county=08001"),
        published: 0,
        resultState: "candidates_found",
      },
      rejected: [
        { ...unavailable, name: "noneStandOut" },
        { ...unavailable, name: "insufficient" },
        { ...unavailable, name: "unsupported" },
        { ...unavailable, name: "emptyFound" },
        { ...unavailable, name: "emptyFoundWithGaps" },
      ],
    });
  });

  it("omits candidate FIPS that are not in the requested state", async () => {
    const onCountyChange =
      vi.fn<(fips: string | null, history: "push" | "replace") => void>();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = (countyName: string, fips: string) =>
      reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName,
        fips,
        reasonText: `${countyName} was returned by the method.`,
      });
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          county="36001"
          review={buildStateReview({
            candidates: [
              candidate("Adams", "08001"),
              candidate("Albany", "36001"),
              candidate("Short", "0800"),
              candidate("Boulder", " 08013 "),
            ],
            resultState: "candidates_found",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
          onCountyChange={onCountyChange}
        />
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("review-candidate")).toHaveLength(2)
    );
    const listed = screen
      .getAllByTestId("review-candidate")
      .map((entry) => entry.dataset.fips);
    const investigate =
      screen.getByTestId("review-investigate").getAttribute("href") ?? "";
    const compare =
      screen.getByTestId("review-compare").getAttribute("href") ?? "";
    const note =
      screen.getByTestId("review-omitted-candidates").textContent ?? "";
    view.unmount();
    expect({
      compareCounty: new URL(compare, "http://localhost").searchParams.get(
        "county"
      ),
      investigateCounty: new URL(
        investigate,
        "http://localhost"
      ).searchParams.get("county"),
      listed,
      note,
      published: onCountyChange.mock.calls,
      wrongState: investigate.includes("36001") || compare.includes("36001"),
    }).toStrictEqual({
      compareCounty: "08001",
      investigateCounty: "08001",
      listed: ["08001", "08013"],
      note: "2 candidates were omitted because their county FIPS is not in Colorado.",
      published: [["08001", "replace"]],
      wrongState: false,
    });
  });

  it("treats an unusable review release as unavailable instead of a loading map", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const reviewFor = (release: string) => {
      const review = buildStateReview({
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
      review.data_release_version = release;
      return review;
    };
    const read = () => {
      const investigate =
        screen.getByTestId("review-investigate").getAttribute("href") ?? "";
      const compare =
        screen.getByTestId("review-compare").getAttribute("href") ?? "";
      const regionText = (
        screen.getByTestId("review-state-map-region").textContent ?? ""
      ).replaceAll(/\s+/g, " ");
      return {
        compareDataset: new URL(compare, "http://localhost").searchParams.get(
          "dataset"
        ),
        county: new URL(investigate, "http://localhost").searchParams.get(
          "county"
        ),
        investigateDataset: new URL(
          investigate,
          "http://localhost"
        ).searchParams.get("dataset"),
        loading: regionText.includes("Loading map"),
        map: Boolean(screen.queryByTestId("mock-atlas-map")),
        releaseLabel: (
          screen.getByTestId("review-methodology").textContent ?? ""
        ).replaceAll(/\s+/g, " "),
        unavailable: regionText.includes(
          "The map is unavailable. This result did not include a release Atlas can request."
        ),
      };
    };
    const valid = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={reviewFor("alpha-2026")}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    await waitFor(() => {
      if (!screen.queryByTestId("mock-atlas-map")) {
        throw new Error("map did not leave the loading state");
      }
    });
    const usable = read();
    valid.unmount();
    const invalid = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={reviewFor("bad release")}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const unusable = read();
    invalid.unmount();
    expect({ unusable, usable }).toStrictEqual({
      unusable: {
        compareDataset: null,
        county: "08001",
        investigateDataset: null,
        loading: false,
        map: false,
        releaseLabel: expect.stringContaining("Release Unavailable"),
        unavailable: true,
      },
      usable: {
        compareDataset: "alpha-2026",
        county: "08001",
        investigateDataset: "alpha-2026",
        loading: false,
        map: true,
        releaseLabel: expect.stringContaining("Release alpha-2026"),
        unavailable: false,
      },
    });
  });

  it("keeps the first candidate when a county FIPS is repeated", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={buildStateReview({
            candidates: [
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Adams",
                fips: "08001",
                reasonText: "Adams was returned first.",
              }),
              reviewCandidate({
                caveat: "A later copy is not a second county.",
                countyName: "Denver",
                fips: " 08001 ",
                reasonText: "Denver was returned second.",
              }),
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Boulder",
                fips: "08013",
                reasonText: "Boulder was returned once.",
              }),
            ],
            resultState: "candidates_found",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const rows = screen.getAllByTestId("review-candidate").map((row) => ({
      fips: row.dataset.fips ?? "",
      name: row.textContent?.includes("Adams, CO")
        ? "Adams"
        : row.textContent?.includes("Boulder, CO")
          ? "Boulder"
          : "other",
    }));
    const investigate =
      screen.getByTestId("review-investigate").getAttribute("href") ?? "";
    const snapshot = {
      county: new URL(investigate, "http://localhost").searchParams.get(
        "county"
      ),
      duplicateNote: screen.getByTestId("review-omitted-duplicate-candidates")
        .textContent,
      outOfScope: screen.queryByTestId("review-omitted-candidates"),
      preview: screen.getByTestId("review-preview-why").textContent,
      rows,
      secondReason: screen.queryByText("Denver was returned second."),
    };
    view.unmount();
    expect(snapshot).toStrictEqual({
      county: "08001",
      duplicateNote:
        "1 candidate was omitted because its county FIPS was already listed.",
      outOfScope: null,
      preview: "Adams was returned first.",
      rows: [
        { fips: "08001", name: "Adams" },
        { fips: "08013", name: "Boulder" },
      ],
      secondReason: null,
    });
  });

  it("clears the URL county when every candidate FIPS is out of scope", async () => {
    const onCountyChange =
      vi.fn<(fips: string | null, history: "push" | "replace") => void>();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          county="36001"
          review={buildStateReview({
            candidates: [
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Albany",
                fips: "36001",
                reasonText: "Albany was returned by the method.",
              }),
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Malformed",
                fips: "08",
                reasonText: "A malformed FIPS was returned.",
              }),
            ],
            resultState: "candidates_found",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
          onCountyChange={onCountyChange}
        />
      </QueryClientProvider>
    );
    await waitFor(() => {
      if (onCountyChange.mock.calls.length === 0) {
        throw new Error("county was not cleared");
      }
    });
    const note =
      screen.getByTestId("review-omitted-candidates").textContent ?? "";
    const listed = screen.queryByTestId("review-candidate");
    const investigate = screen.queryByTestId("review-investigate");
    view.unmount();
    expect({
      investigate,
      listed,
      note,
      published: onCountyChange.mock.calls,
    }).toStrictEqual({
      investigate: null,
      listed: null,
      note: "2 candidates were omitted because their county FIPS is not in Colorado.",
      published: [[null, "replace"]],
    });
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
        valueStateReason: (gaps.textContent ?? "").includes(
          "Unavailable for this release"
        ),
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
        valueStateReason: false,
      },
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "insufficient_evidence",
        sourceFamily: "Unavailable",
        valueStateReason: false,
      },
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "candidates_found",
        sourceFamily: "Unavailable",
        valueStateReason: false,
      },
      {
        evidenceType: "Unavailable",
        gapCode: true,
        gapDetail: true,
        headerContext: true,
        observationPeriod: "Unavailable",
        resultState: "none_stand_out",
        sourceFamily: "Unavailable",
        valueStateReason: false,
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

  it("does not present malformed timestamps, versions, or ids as authoritative", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = {
      ...reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_references: [
        {
          ...reviewEvidenceReference("08001"),
          county_fips: "12",
          public_record_ref: "bad record!!",
          release_id: "bad release",
          retrieved_at: "yesterday",
          source_as_of: "2025-02-31",
          source_version: "bad version",
        },
      ],
      reason_codes: ["not a code"],
    };
    const malformed = buildStateReview({
      candidates: [candidate],
      gaps: [
        {
          code: "bad code",
          county_fips: "NOPE",
          detail: "Lineage is unavailable.",
        },
      ],
      resultState: "candidates_found",
      state: "CO",
    });
    malformed.configuration_sha256 = "not-a-hash";
    malformed.data_release_version = "bad release";
    malformed.evaluated_at = "not-a-timestamp";
    malformed.methodology_id = "not an id";
    malformed.methodology_version = "v 1";
    malformed.result_state = "bogus" as StateReview["result_state"];
    const dateOnly = buildStateReview({
      resultState: "none_stand_out",
      state: "CO",
    });
    dateOnly.evaluated_at = "2026-10-06";
    const impossible = buildStateReview({
      resultState: "none_stand_out",
      state: "CO",
    });
    impossible.evaluated_at = "2026-02-31T00:00:00Z";
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
      fireEvent.click(
        within(provenance).getByText("Technical reproducibility identifiers")
      );
      const evaluatedAt =
        within(provenance).getByText("Evaluated at").nextElementSibling
          ?.textContent ?? "";
      const configuration =
        within(provenance).getByText("Configuration").nextElementSibling
          ?.textContent ?? "";
      const time = provenance.querySelector("time");
      view.unmount();
      return {
        configuration,
        evaluatedAt,
        time: time?.getAttribute("dateTime") ?? null,
      };
    };
    const dateOnlyProvenance = read(dateOnly);
    const impossibleProvenance = read(impossible);
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={malformed}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const panel = screen.getByTestId("review-state-panel");
    const provenance = screen.getByTestId("review-result-provenance");
    fireEvent.click(within(provenance).getByText("Inspect provenance"));
    fireEvent.click(
      within(provenance).getByText("Technical reproducibility identifiers")
    );
    const qualification = screen.getByTestId("review-preview-qualification");
    fireEvent.click(within(qualification).getByText("Inspect provenance"));
    const reference =
      within(qualification)
        .getByTestId("evidence-provenance-references")
        .querySelector("li")?.textContent ?? "";
    const basis = screen.getByTestId("review-observed-basis").textContent ?? "";
    const header = (screen.getByTestId("review-methodology").textContent ?? "")
      .replaceAll(/\s+/g, " ")
      .trim();
    const backend =
      screen.getByTestId("review-backend-result").textContent ?? "";
    const investigate =
      screen.getByTestId("review-investigate").getAttribute("href") ?? "";
    const compare =
      screen.getByTestId("review-compare").getAttribute("href") ?? "";
    const gap = screen.queryByTestId("review-data-gap");
    const omittedGaps =
      screen.getByTestId("review-omitted-gaps").textContent ?? "";
    const reasonCodes = screen.queryByTestId("review-reason-codes");
    const snapshot = {
      backendNamesBogus: backend.includes("bogus"),
      basisKeepsSourceDate: basis.includes("as of 2025-02-31"),
      compareNamesRelease: compare.includes("bad"),
      configuration:
        within(provenance).getByText("Configuration").nextElementSibling
          ?.textContent,
      configurationAttribute: panel.dataset.configurationSha256 ?? null,
      dateOnly: dateOnlyProvenance,
      evaluatedAt:
        within(provenance).getByText("Evaluated at").nextElementSibling
          ?.textContent,
      gap,
      header,
      omittedGaps,
      impossible: impossibleProvenance,
      investigateNamesRelease: investigate.includes("bad"),
      reasonCodes: (reasonCodes?.textContent ?? "").includes("not a code"),
      reference,
      resultState: panel.dataset.resultState,
      time: provenance.querySelector("time")?.getAttribute("dateTime") ?? null,
    };
    view.unmount();
    expect(snapshot).toStrictEqual({
      backendNamesBogus: false,
      basisKeepsSourceDate: true,
      compareNamesRelease: false,
      configuration: "Unavailable",
      configurationAttribute: null,
      dateOnly: {
        configuration: dateOnly.configuration_sha256,
        evaluatedAt: "Unavailable",
        time: null,
      },
      evaluatedAt: "Unavailable",
      gap: null,
      header:
        "Method not an id v 1. Release Unavailable. Current cumulative county status; human snapshot 2023.",
      impossible: {
        configuration: impossible.configuration_sha256,
        evaluatedAt: "Unavailable",
        time: null,
      },
      investigateNamesRelease: false,
      omittedGaps:
        "1 data gap was omitted because its county FIPS is not in Colorado.",
      reasonCodes: true,
      reference: expect.stringContaining(
        "county Unavailable; source as of 2025-02-31; version bad version; retrieved Unavailable; record bad record!!; release bad release"
      ),
      resultState: "unavailable",
      time: null,
    });
    expect(reference).not.toContain("yesterday");
    expect(backend).toContain("Unavailable");
  });

  it("keeps source-native statuses and marks a blank status unavailable", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const reported = {
      ...reviewEvidenceReference("08001"),
      status: "Reported",
      target: "Ixodes scapularis",
    };
    const noRecords = {
      ...reviewEvidenceReference("08001", "No records"),
      source_product: "CDC vector county status",
      target: "Ixodes pacificus",
    };
    const blank = {
      ...reviewEvidenceReference("08001"),
      status: " ",
      target: "Ixodes scapularis",
    };
    const read = (references: (typeof reported)[]) => {
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={buildStateReview({
              candidates: [
                {
                  ...reviewCandidate({
                    caveat: "Collection dates are unavailable.",
                    countyName: "Denver",
                    fips: "08001",
                    reasonText: "Denver was returned by the method.",
                  }),
                  evidence_references: references,
                },
              ],
              resultState: "candidates_found",
              state: "CO",
            })}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const basis =
        screen.getByTestId("review-observed-basis").textContent ?? "";
      view.unmount();
      return basis;
    };
    const present = read([reported, noRecords]);
    const missing = read([blank]);
    expect({
      blank: missing.includes("Ixodes scapularis: Unavailable"),
      noRecords: present.includes("Ixodes pacificus: No records"),
      reported: present.includes("Ixodes scapularis: Reported"),
    }).toStrictEqual({
      blank: true,
      noRecords: true,
      reported: true,
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
        heading: state.startsWith("Review result"),
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
        heading: true,
        inventedLimited: false,
        inventedMaterial: false,
        limitations: expect.stringContaining(
          "No governed limitations were returned."
        ),
        state: expect.stringContaining("Nothing stands out"),
      },
      withLimitation: {
        heading: true,
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
      const method =
        within(qualification).getByTestId("evidence-provenance-method")
          .textContent ?? "";
      view.unmount();
      return {
        codes,
        limitationsIncludeCode: limitations.includes(reasonCode),
        limitationsIncludeReasonLabel: limitations.includes("Reason code"),
        materialReason: state.includes("Coverage or methodology limits apply"),
        method,
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
        method: "Methodatlas-county-review. Version 1.0.0.",
        state: expect.stringContaining("Limited"),
      },
      withoutCaveat: {
        codes: expect.stringContaining(reasonCode),
        limitationsIncludeCode: false,
        limitationsIncludeReasonLabel: false,
        materialReason: false,
        method: "Methodatlas-county-review. Version 1.0.0.",
        state: "Evidence stateLimited",
      },
    });
  });

  it("shows the review method on candidate inspect", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    const read = (methodologyId: string, methodologyVersion: string) => {
      const review = buildStateReview({
        candidates: [candidate],
        resultState: "candidates_found",
        state: "CO",
      });
      review.methodology_id = methodologyId;
      review.methodology_version = methodologyVersion;
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={review}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const qualification = screen.getByTestId("review-preview-qualification");
      fireEvent.click(within(qualification).getByText("Inspect provenance"));
      const method =
        within(qualification).getByTestId("evidence-provenance-method")
          .textContent ?? "";
      view.unmount();
      return method;
    };
    const present = read("atlas-county-review", "1.0.0");
    const missing = read(" ", "");
    expect({
      missing,
      presentId: present.includes("atlas-county-review"),
      presentVersion: present.includes("1.0.0"),
      unavailable: missing.includes("Unavailable"),
    }).toStrictEqual({
      missing: "MethodUnavailable",
      presentId: true,
      presentVersion: true,
      unavailable: true,
    });
  });

  it("keeps each reference release id when they differ", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const read = (references: ReturnType<typeof reviewEvidenceReference>[]) => {
      const candidate = {
        ...reviewCandidate({
          caveat: "Collection dates are unavailable.",
          countyName: "Denver",
          fips: "08001",
          reasonText: "Denver was returned by the method.",
        }),
        evidence_references: references,
      };
      const review = buildStateReview({
        candidates: [candidate],
        resultState: "candidates_found",
        state: "CO",
      });
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={review}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const qualification = screen.getByTestId("review-preview-qualification");
      fireEvent.click(within(qualification).getByText("Inspect provenance"));
      const lines = within(qualification)
        .getAllByTestId("evidence-provenance-references")
        .flatMap((list) =>
          [...list.querySelectorAll("li")].map((item) => item.textContent ?? "")
        );
      view.unmount();
      return lines;
    };
    const shared = reviewEvidenceReference("08001");
    const mixed = read([
      shared,
      {
        ...reviewEvidenceReference("08001", "Reported"),
        family: "vector",
        release_id: "beta-2026",
        source_product: "CDC vector county status",
      },
    ]);
    const blank = read([{ ...shared, release_id: " " }]);
    expect({
      blank,
      first: mixed[0]?.includes("release alpha-2026"),
      second: mixed[1]?.includes("release beta-2026"),
    }).toStrictEqual({
      blank: [expect.stringContaining("release Unavailable")],
      first: true,
      second: true,
    });
  });

  it("does not treat a blank reference value as shared provenance", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const populated = reviewEvidenceReference("08001");
    const candidate = {
      ...reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_references: [
        populated,
        {
          ...reviewEvidenceReference("08001", "Reported"),
          family: "vector",
          public_record_ref: " ",
          release_id: "",
        },
      ],
    };
    const review = buildStateReview({
      candidates: [candidate],
      resultState: "candidates_found",
      state: "CO",
    });
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const qualification = screen.getByTestId("review-preview-qualification");
    fireEvent.click(within(qualification).getByText("Inspect provenance"));
    fireEvent.click(
      within(qualification).getByText("Technical reproducibility identifiers")
    );
    const technicalValue = (label: string) =>
      within(qualification).queryByText(label)?.nextElementSibling
        ?.textContent ?? "";
    const lines = [
      ...within(qualification)
        .getByTestId("evidence-provenance-references")
        .querySelectorAll("li"),
    ].map((item) => item.textContent ?? "");
    const snapshot = {
      blankRecord: lines[1]?.includes("record Unavailable"),
      blankRelease: lines[1]?.includes("release Unavailable"),
      populatedRecord: lines[0]?.includes("record public/08001"),
      populatedRelease: lines[0]?.includes("release alpha-2026"),
      provenanceRef: technicalValue("Provenance reference"),
      releaseId: technicalValue("Release ID"),
    };
    view.unmount();
    expect(snapshot).toStrictEqual({
      blankRecord: true,
      blankRelease: true,
      populatedRecord: true,
      populatedRelease: true,
      provenanceRef: "",
      releaseId: "",
    });
  });

  it("normalizes a blank observed basis", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = {
      ...reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_references: [
        {
          ...reviewEvidenceReference("08001"),
          source_as_of: " ",
          source_product: "",
          status: " ",
          target: "",
        },
      ],
    };
    const review = buildStateReview({
      candidates: [candidate],
      resultState: "candidates_found",
      state: "CO",
    });
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const basis = screen.getByTestId("review-observed-basis").textContent ?? "";
    view.unmount();
    expect(basis).toBe(
      "Unavailable: Unavailable (Unavailable, FIPS 08001, as of Unavailable)"
    );
  });

  it("normalizes a blank review result header", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const review = buildStateReview({
      resultState: "none_stand_out",
      state: "CO",
    });
    review.methodology_id = " ";
    review.methodology_version = "";
    review.effective_observation_context = " ";
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const header = (screen.getByTestId("review-methodology").textContent ?? "")
      .replaceAll(/\s+/g, " ")
      .trim();
    view.unmount();
    expect(header).toBe(
      "Method Unavailable Unavailable. Release alpha-2026. Unavailable."
    );
  });

  it("keeps each reference county on its inspect line", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = {
      ...reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_references: [
        reviewEvidenceReference("08001"),
        {
          ...reviewEvidenceReference("08031", "Reported"),
          family: "vector",
        },
        {
          ...reviewEvidenceReference("08001"),
          county_fips: " ",
          family: "human",
          public_record_ref: "public/08001-human",
          retrieved_at: "",
        },
      ],
    };
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
    const lines = [
      ...within(qualification)
        .getByTestId("evidence-provenance-references")
        .querySelectorAll("li"),
    ].map((item) => item.textContent ?? "");
    const basis = screen.getByTestId("review-observed-basis").textContent ?? "";
    view.unmount();
    expect({
      basisNamesBlank: basis.includes("FIPS Unavailable"),
      basisNamesOtherCounty: basis.includes("FIPS 08031"),
      blankCounty: lines[2]?.includes("county Unavailable"),
      blankRetrieved: lines[2]?.includes("retrieved Unavailable"),
      candidateCounty: lines[0]?.includes("county 08001"),
      otherCounty: lines[1]?.includes("county 08031"),
    }).toStrictEqual({
      basisNamesBlank: true,
      basisNamesOtherCounty: true,
      blankCounty: true,
      blankRetrieved: true,
      candidateCounty: true,
      otherCounty: true,
    });
  });

  it("explains a candidate when the reason text is blank", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const reasonCode = "PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW";
    const read = (candidate: ReturnType<typeof reviewCandidate>) => {
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
      const row =
        screen.getByTestId("review-candidate").querySelector("small")
          ?.textContent ?? "";
      const why = screen.getByTestId("review-preview-why").textContent ?? "";
      view.unmount();
      return { row, why };
    };
    const withCode = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    withCode.reason_text = " ";
    withCode.reason_codes = [reasonCode];
    const withoutCode = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    withoutCode.reason_codes = [" "];
    withoutCode.reason_text = "";
    expect({
      withCode: read(withCode),
      withoutCode: read(withoutCode),
    }).toStrictEqual({
      withCode: { row: reasonCode, why: reasonCode },
      withoutCode: {
        row: "The review result did not include a reason for this county.",
        why: "The review result did not include a reason for this county.",
      },
    });
  });

  it("normalizes blank gap, county, and limitation text", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    candidate.county_name = " ";
    const review = buildStateReview({
      candidates: [candidate],
      gaps: [
        { code: " ", county_fips: " 08031 ", detail: " " },
        { code: " ", county_fips: "", detail: " " },
      ],
      resultState: "candidates_found",
      state: "CO",
    });
    review.limitations = [" ", "Review is not disease risk."];
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const rowName =
      screen.getByTestId("review-candidate").querySelector("strong")
        ?.textContent ?? "";
    const gapRow = screen.getByTestId("review-data-gap").textContent ?? "";
    const omitted = screen.getByTestId("review-omitted-gaps").textContent ?? "";
    const limitations = [
      ...screen.getByTestId("review-limitations").querySelectorAll("li"),
    ].map((item) => item.textContent ?? "");
    view.unmount();
    expect({
      gapRow,
      limitations,
      omitted,
      rowName: rowName.replaceAll(/\s+/g, " ").trim(),
    }).toStrictEqual({
      gapRow: "FIPS 08031 Unavailable. Unavailable",
      limitations: ["Review is not disease risk."],
      omitted:
        "1 data gap was omitted because its county FIPS is not in Colorado.",
      rowName: "Unavailable, CO",
    });
  });

  it("omits data-gap counties that are outside the requested state", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = {
      ...reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_references: [
        reviewEvidenceReference("08001"),
        reviewEvidenceReference("36001", "Reported"),
        {
          ...reviewEvidenceReference("08001"),
          county_fips: " ",
        },
      ],
    };
    const mixed = buildStateReview({
      candidates: [candidate],
      gaps: [
        {
          code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
          county_fips: " 08031 ",
          detail: "Environmental context stays a data gap.",
        },
        {
          code: "OUT_OF_STATE",
          county_fips: "36001",
          detail: "New York must not become a Colorado gap.",
        },
        {
          code: "MALFORMED",
          county_fips: "08",
          detail: "A short FIPS must not become a Colorado gap.",
        },
      ],
      resultState: "candidates_found",
      state: "CO",
    });
    mixed.coverage.rule_coverage = {
      ...mixed.coverage.rule_coverage,
      "08031": "in state",
      "36001": "out of state",
    };
    const mixedView = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={mixed}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const gaps = screen.getByTestId("review-data-gaps");
    const gapRows = screen.getAllByTestId("review-data-gap").map((row) => ({
      code: row.dataset.code ?? "",
      fips: row.dataset.fips ?? "",
    }));
    const investigate =
      screen.getByTestId("review-investigate").getAttribute("href") ?? "";
    const basis = screen.getByTestId("review-observed-basis").textContent ?? "";
    const rules = [
      ...screen.getByTestId("review-rule-coverage").querySelectorAll("li"),
    ].map((item) => item.textContent ?? "");
    const mixedSnapshot = {
      basisBlank: basis.includes("FIPS Unavailable"),
      basisOtherState: basis.includes("FIPS 36001"),
      caveatUsesOtherState: (gaps.textContent ?? "").includes(
        "New York must not become a Colorado gap."
      ),
      county: new URL(investigate, "http://localhost").searchParams.get(
        "county"
      ),
      gapRows,
      inStateDetail: (gaps.textContent ?? "").includes(
        "Environmental context stays a data gap."
      ),
      omitted: screen.getByTestId("review-omitted-gaps").textContent,
      resultState: screen.getByTestId("review-state-panel").dataset.resultState,
      rulesIncludeInStateKey: rules.some((rule) => rule.startsWith("08031:")),
      rulesIncludeName: rules.some((rule) =>
        rule.startsWith("human_emerging:")
      ),
      rulesIncludeOtherState: rules.some((rule) => rule.startsWith("36001:")),
    };
    mixedView.unmount();
    const unsupportedView = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={buildStateReview({
            gaps: [
              {
                code: "OUT_OF_STATE",
                county_fips: "36001",
                detail: "New York must not become a Colorado gap.",
              },
            ],
            resultState: "unsupported",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const unsupportedSnapshot = {
      gapRow: screen.queryByTestId("review-data-gap"),
      gapSection: screen.queryByTestId("review-data-gaps"),
      omitted: screen.getByTestId("review-omitted-gaps").textContent,
      otherStateDetail: (
        screen.getByTestId("review-state-panel").textContent ?? ""
      ).includes("New York must not become a Colorado gap."),
      resultState: screen.getByTestId("review-state-panel").dataset.resultState,
      summary: screen.getByTestId("review-result-summary").textContent,
    };
    unsupportedView.unmount();
    expect({
      mixed: mixedSnapshot,
      unsupported: unsupportedSnapshot,
    }).toStrictEqual({
      mixed: {
        basisBlank: true,
        basisOtherState: true,
        caveatUsesOtherState: false,
        county: "08001",
        gapRows: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            fips: "08031",
          },
        ],
        inStateDetail: true,
        omitted:
          "2 data gaps were omitted because their county FIPS is not in Colorado.",
        resultState: "candidates_found",
        rulesIncludeInStateKey: true,
        rulesIncludeName: true,
        rulesIncludeOtherState: false,
      },
      unsupported: {
        gapRow: null,
        gapSection: null,
        omitted:
          "1 data gap was omitted because its county FIPS is not in Colorado.",
        otherStateDetail: false,
        resultState: "unsupported",
        summary: "No review rule is enabled for this result.",
      },
    });
  });

  it("marks a blank reference revision and version unavailable", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const candidate = {
      ...reviewCandidate({
        caveat: "Collection dates are unavailable.",
        countyName: "Denver",
        fips: "08001",
        reasonText: "Denver was returned by the method.",
      }),
      evidence_references: [
        {
          ...reviewEvidenceReference("08001"),
          source_as_of: " ",
          source_version: "",
        },
      ],
    };
    const review = buildStateReview({
      candidates: [candidate],
      resultState: "candidates_found",
      state: "CO",
    });
    const view = render(
      <QueryClientProvider client={client}>
        <ReviewOperatingPicture
          review={review}
          scopeCode="CO"
          stateName="Colorado"
        />
      </QueryClientProvider>
    );
    const qualification = screen.getByTestId("review-preview-qualification");
    fireEvent.click(within(qualification).getByText("Inspect provenance"));
    const line =
      within(qualification)
        .getByTestId("evidence-provenance-references")
        .querySelector("li")?.textContent ?? "";
    view.unmount();
    expect({
      revision: line.includes("source as of Unavailable"),
      version: line.includes("version Unavailable"),
    }).toStrictEqual({
      revision: true,
      version: true,
    });
  });

  it("shows returned rule coverage without turning rules into counties", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Lineage is unavailable.",
    };
    const candidate = reviewCandidate({
      caveat: "Collection dates are unavailable.",
      countyName: "Denver",
      fips: "08001",
      reasonText: "Denver was returned by the method.",
    });
    const rules = {
      human_emerging: "disabled",
      vector_transition: "insufficient",
    };
    const read = (review: StateReview, coverage: Record<string, string>) => {
      review.coverage.rule_coverage = coverage;
      const view = render(
        <QueryClientProvider client={client}>
          <ReviewOperatingPicture
            review={review}
            scopeCode="CO"
            stateName="Colorado"
          />
        </QueryClientProvider>
      );
      const section = screen.queryByTestId("review-rule-coverage");
      const items = section
        ? within(section)
            .getAllByRole("listitem")
            .map((item) => item.textContent)
        : [];
      const sectionText = section?.textContent ?? "";
      view.unmount();
      return {
        items,
        namesCounty:
          sectionText.includes("08031") || sectionText.includes("Denver"),
      };
    };
    expect({
      blankStatus: read(
        buildStateReview({
          gaps: [gap],
          resultState: "unsupported",
          state: "CO",
        }),
        { human_emerging: " " }
      ),
      empty: read(
        buildStateReview({
          gaps: [gap],
          resultState: "unsupported",
          state: "CO",
        }),
        {}
      ),
      insufficient: read(
        buildStateReview({
          gaps: [gap],
          resultState: "insufficient_evidence",
          state: "CO",
        }),
        rules
      ),
      mixed: read(
        buildStateReview({
          candidates: [candidate],
          gaps: [gap],
          resultState: "candidates_found",
          state: "CO",
        }),
        rules
      ),
      unsupported: read(
        buildStateReview({
          gaps: [gap],
          resultState: "unsupported",
          state: "CO",
        }),
        rules
      ),
    }).toStrictEqual({
      blankStatus: {
        items: ["human_emerging: Unavailable"],
        namesCounty: false,
      },
      empty: { items: [], namesCounty: false },
      insufficient: {
        items: ["human_emerging: disabled", "vector_transition: insufficient"],
        namesCounty: false,
      },
      mixed: {
        items: ["human_emerging: disabled", "vector_transition: insufficient"],
        namesCounty: false,
      },
      unsupported: {
        items: ["human_emerging: disabled", "vector_transition: insufficient"],
        namesCounty: false,
      },
    });
  });
});
