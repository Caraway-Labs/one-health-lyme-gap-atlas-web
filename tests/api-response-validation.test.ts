import { describe, expect, it } from "vitest";

import {
  CountyV1CountiesFipsGetResponse,
  KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "../src/generated/zod/atlas";
import {
  ApiResponseValidationError,
  validateApiResponse,
} from "../src/lib/api-response-validation";

const chatResponse = {
  answer: "Reviewed evidence is available.",
  assistant_policy_version: "policy-v1",
  configuration_version: "kg-v1.0.0",
  conversation_id: "conversation-1",
  evidence_state: "limited",
  request_id: "request-1",
  source_used: "literature_evidence",
  status: "answered",
};

const atlasMetadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-08-06T05:37:16Z",
  limitations: "Not individual risk.",
  loaded_at: "2026-08-15T00:00:00Z",
  methodology_version: "alpha-0.2.0",
  release_id: "alpha-2026-08-06",
  schema_version: "0.2.0",
  scope: "United States counties",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      note: "Published floor.",
      url: "https://cdc.gov",
      vintage: "2023",
    },
  ],
  states: [],
};

const countyScore = {
  access_signal: 10,
  community: 10,
  ecological: 10,
  human_weakness: 10,
  pathogen_signal: 10,
  rural_signal: 10,
  score: 10,
  svi_signal: 10,
  tick_signal: 10,
};

const scoreCollection = {
  counties: [
    {
      burgdorferi_status: "No records",
      color: "#000000",
      county: "Adams County",
      evidence_completeness: 50,
      fips: "08001",
      human_status: "no_county_linked_record",
      in_contiguous_tick_scope: true,
      priority: "Lower Atlas priority",
      score: countyScore,
      state: "CO",
      state_name: "Colorado",
      tick_status: "No records",
    },
  ],
  methodology_version: "alpha-0.2.0",
  release_id: "alpha-2026-08-06",
  settings: { ecological_share: 65 },
};

const countyDetail = {
  burgdorferi_status: "No records",
  case_count_floor_2023: null,
  color: "#000000",
  county: "Adams County",
  evidence_completeness: 50,
  fips: "08001",
  human_status: "no_county_linked_record",
  incidence_floor_2023: null,
  in_contiguous_tick_scope: true,
  pacificus_status: "No records",
  population: 520_149,
  priority: "Lower Atlas priority",
  release: atlasMetadata,
  rucc_2023: 1,
  scapularis_status: "No records",
  score: countyScore,
  state: "CO",
  state_name: "Colorado",
  state_unallocated_records_2023: null,
  svi_percentile: null,
  tick_status: "No records",
  uninsured_percent: null,
  uninsured_percentile: null,
};

describe("API response validation", () => {
  it("accepts a valid generated KnowledgeChatResponse schema", () => {
    expect(
      validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        chatResponse
      )
    ).toMatchObject(chatResponse);
  });

  it("accepts valid Atlas metadata and score collection schemas", () => {
    expect(
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        atlasMetadata
      )
    ).toMatchObject({ release_id: "alpha-2026-08-06" });
    expect(
      validateApiResponse(
        "Atlas scores",
        ScoresV1AtlasScoresGetResponse,
        scoreCollection
      )
    ).toMatchObject({ release_id: "alpha-2026-08-06" });
    expect(
      validateApiResponse(
        "County detail",
        CountyV1CountiesFipsGetResponse,
        countyDetail
      )
    ).toMatchObject({ fips: "08001" });
  });

  it("rejects malformed payloads with a controlled application error", () => {
    expect(() =>
      validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        { ...chatResponse, status: "unverified" }
      )
    ).toThrow(ApiResponseValidationError);
    expect(() =>
      validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        { ...chatResponse, status: "unverified" }
      )
    ).toThrow("Evidence chat response could not be verified.");
    expect(() =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        {
          ...atlasMetadata,
          release_id: 42,
        }
      )
    ).toThrow("Atlas metadata could not be verified.");
  });
});
