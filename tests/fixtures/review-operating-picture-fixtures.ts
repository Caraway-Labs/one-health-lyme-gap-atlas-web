import type {
  Candidate,
  DataGap,
  PublicReviewEvidenceReference,
  StateReview,
  StateReviewResultState,
} from "@/generated/models";

import { reviewScopeScoresFixture } from "./review-scope-api-fixtures";

const EVALUATED_AT = "2026-10-06T04:57:46.000Z";

export function reviewEvidenceReference(
  fips: string,
  status = "Present"
): PublicReviewEvidenceReference {
  return {
    county_fips: fips,
    family: "pathogen",
    limitations: ["Cumulative status is not a collection date."],
    public_record_ref: `public/${fips}`,
    release_id: "alpha-2026",
    retrieved_at: EVALUATED_AT,
    source_as_of: "2025-12-31",
    source_product: "CDC pathogen county status",
    source_version: "2025",
    status,
    target: "Borrelia burgdorferi sensu stricto",
  };
}

export function reviewCandidate(input: {
  caveat: string;
  countyName: string;
  fips: string;
  nextCheck?: string;
  reasonText: string;
  status?: string;
}): Candidate {
  return {
    completeness: "limited",
    county_fips: input.fips,
    county_name: input.countyName,
    county_url: `/v1/counties/${input.fips}`,
    evidence_families: ["pathogen"],
    evidence_references: [
      reviewEvidenceReference(input.fips, input.status ?? "Present"),
    ],
    freshness_comparability: "Cumulative through 2025; not a collection date.",
    limitations: [input.caveat],
    reason_codes: ["PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW"],
    reason_text: input.reasonText,
    suggested_next_check: input.nextCheck ?? "Review the cited source records.",
  };
}

export function buildStateReview(input: {
  candidates?: readonly Candidate[];
  gaps?: readonly DataGap[];
  resultState?: StateReviewResultState;
  state: string;
}): StateReview {
  return {
    configuration_sha256:
      "db6df73f7bce474000165fb2b0bad9767390c21aed160a1377be6a4893004d99",
    coverage: {
      abstained_counties: 0,
      assessed_counties:
        (input.candidates?.length ?? 0) + (input.gaps?.length ?? 0),
      eligible_counties: input.candidates?.length ?? 0,
      evaluated_counties: input.candidates?.length ?? 0,
      rule_coverage: {
        human_emerging: "disabled",
        human_vector_discordance: "disabled",
        pathogen_present_vector_reported: "disabled",
        vector_transition: "disabled",
      },
    },
    data_gaps: [...(input.gaps ?? [])],
    data_release_version: "alpha-2026",
    effective_observation_context:
      "Current cumulative county status; human snapshot 2023",
    evaluated_at: EVALUATED_AT,
    limitations: [
      "Review is not disease risk. Candidates come only from the review result.",
    ],
    methodology_id: "atlas-county-review",
    methodology_version: "1.0.0",
    requested_observation_context: null,
    requested_state: input.state,
    result_state: input.resultState ?? "candidates_found",
    review_candidates: [...(input.candidates ?? [])],
  };
}

const SCORE_FIXTURE_CAVEATS: Record<string, string> = {
  "08001": "Some scored inputs are unavailable in this release.",
  "08013": "Collection dates are unavailable for this status.",
  "36001": "A missing record is not treated as zero cases.",
};

/** Contract-shaped review for the counties already used by Review scope tests. */
export function defaultReviewForState(state: string): StateReview {
  const counties = reviewScopeScoresFixture.counties.filter(
    (county) => county.state === state
  );
  if (counties.length === 0) {
    return buildStateReview({
      resultState: "none_stand_out",
      state,
    });
  }
  const gaps =
    state === "CO"
      ? [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08031",
            detail:
              "Environmental context without an observed candidate stays a data gap.",
          },
        ]
      : [];
  return buildStateReview({
    candidates: counties.map((county) =>
      reviewCandidate({
        caveat:
          SCORE_FIXTURE_CAVEATS[county.fips] ??
          "The review result included a limitation for this county.",
        countyName: county.county,
        fips: county.fips,
        reasonText: `${county.county} is included because the review method returned it.`,
      })
    ),
    gaps,
    resultState: "candidates_found",
    state,
  });
}

export function stateReviewResponseForUrl(url: string): StateReview {
  const state = new URL(url).pathname.split("/").at(-2) ?? "";
  return defaultReviewForState(state);
}
