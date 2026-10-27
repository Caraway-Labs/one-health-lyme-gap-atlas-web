export const structuredAnswered = {
  answer: {
    actual_sources_used: ["structured_atlas"],
    claims: [
      {
        claim_id: "atlas:observation:obs-1",
        coverage_ids: [],
        literature_citation_ids: [],
        measure_ids: [],
        role: "finding",
        structured_refs: [
          {
            methodology_version: "semantic_county_assembly_v1",
            provenance_ref: "obs-1",
            release_id: "release-1",
            resource_id: "obs-1",
            resource_type: "observation",
            semantic_version: "2.0.0",
            source_id: "human",
            uri: null,
          },
        ],
        text: "County 36027, 2023-01-01 to 2023-12-31, case_count_floor_2023 is 10 cases (OBSERVED); source human, methodology version semantic_county_assembly_v1, release release-1.",
      },
    ],
    contract_version: "ask-atlas-v1",
    cross_source_state: null,
    freshness: [
      {
        compared_at: null,
        observation_id: "obs-1",
        policy_id: null,
        source_timestamp: null,
        state: "unknown",
      },
    ],
    kind: "answer",
    limitations: [
      "Published surveillance values are privacy-protected floors.",
    ],
    literature_citations: [],
    literature_evidence_state: null,
    outcome: "ANSWERED",
    replay: {
      assistant_policy_version: "assistant-policy-v1",
      configuration_version: null,
      literature_retrieval_configuration_version: null,
      model_id: null,
      prompt_version: null,
      provider_id: null,
      release_id: "release-1",
      routing_policy_version: "ask-atlas-structured-routing-v1",
      tool_contract_version: "ask-atlas-v1",
    },
    requested_source_mode: "Structured",
    structured_coverage: [],
    structured_evidence_refs: [
      {
        methodology_version: "semantic_county_assembly_v1",
        provenance_ref: "obs-1",
        release_id: "release-1",
        resource_id: "obs-1",
        resource_type: "observation",
        semantic_version: "2.0.0",
        source_id: "human",
        uri: null,
      },
    ],
    structured_measures: [],
  },
  tool_evidence: [
    {
      coverage: [],
      error_code: null,
      kind: "tool_result",
      measures: [],
      metadata: [],
      observations: [],
      release_id: "release-1",
      status: "ok",
      tool: "get_observations",
    },
  ],
} as const;

export const structuredClarification = {
  answer: {
    actual_sources_used: [],
    claims: [],
    contract_version: "ask-atlas-v1",
    cross_source_state: null,
    freshness: [],
    kind: "answer",
    limitations: [
      "Specify a measure, county FIPS, and complete annual period.",
    ],
    literature_citations: [],
    literature_evidence_state: null,
    outcome: "NEEDS_CLARIFICATION",
    replay: {
      assistant_policy_version: "assistant-policy-v1",
      release_id: null,
      routing_policy_version: "ask-atlas-structured-routing-v1",
      tool_contract_version: "ask-atlas-v1",
    },
    requested_source_mode: "Structured",
    structured_coverage: [],
    structured_evidence_refs: [],
    structured_measures: [],
  },
  tool_evidence: [],
} as const;

export const structuredInsufficient = {
  answer: {
    ...structuredClarification.answer,
    limitations: [
      "No governed observation exists for county 09001 in 2023; the numeric request cannot be answered for every selected slot.",
    ],
    outcome: "INSUFFICIENT_EVIDENCE",
  },
  tool_evidence: [],
} as const;

export const mixedInsufficientToCompare = {
  actual_sources_used: ["structured_atlas", "literature_evidence"],
  contract_version: "ask-atlas-mixed-v1",
  cross_source_state: "insufficient_to_compare",
  limitations: ["Published surveillance values are privacy-protected floors."],
  literature: {
    answer: "Reviewed studies describe tick exposure.",
    assistant_policy_version: "assistant-policy-v1",
    citations: [
      {
        citation_id: "c1",
        claim_ids: ["claim-1"],
        passage_ids: ["passage-1"],
        pmid: "12345",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        source_label: "PubMed / PMC Open Access",
        title: "Source paper",
      },
    ],
    claims: [
      {
        citation_ids: ["c1"],
        claim_id: "claim-1",
        text: "Reviewed studies describe tick exposure.",
      },
    ],
    configuration_version: "kg-v1.0.0",
    conversation_id: "conversation-1",
    evidence_state: "limited",
    request_id: "literature-request-1",
    source_used: "literature_evidence",
    status: "answered",
  },
  outcome: "INSUFFICIENT_EVIDENCE",
  requested_source_mode: "Both",
  structured: structuredAnswered,
} as const;

export const mixedLiteratureOnly = {
  actual_sources_used: ["literature_evidence"],
  contract_version: "ask-atlas-mixed-v1",
  cross_source_state: null,
  limitations: ["The structured branch was not used."],
  literature: mixedInsufficientToCompare.literature,
  outcome: "ANSWERED",
  requested_source_mode: "Both",
  structured: null,
} as const;
