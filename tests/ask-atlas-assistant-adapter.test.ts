import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasApiError } from "@/lib/api-mutator";
import { AskAtlasAnswerContractError } from "@/lib/ask-atlas-answer-contract";
import { postAskAtlas } from "@/lib/ask-atlas-assistant-adapter";

import {
  mixedInsufficientToCompare,
  mixedLiteratureOnly,
  structuredAnswered,
  structuredClarification,
} from "./fixtures/ask-atlas-governed-responses";

const { chatRequest, mixedRequest, structuredRequest } = vi.hoisted(() => ({
  chatRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  mixedRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  structuredRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => ({
  ...(await importOriginal()),
  askAtlasMixed: mixedRequest as never,
  askAtlasStructured: structuredRequest as never,
  askKnowledgeGraph: chatRequest as never,
}));

function headers(requestId: string): Headers {
  return new Headers({ "X-Request-ID": requestId });
}

describe("Ask Atlas source-mode adapter", () => {
  beforeEach(() => {
    chatRequest.mockReset();
    mixedRequest.mockReset();
    structuredRequest.mockReset();
  });

  it("keeps literature on the knowledge-graph chat contract", async () => {
    chatRequest.mockResolvedValue({
      data: {
        answer: "Reviewed studies describe exposure.",
        assistant_policy_version: "policy-v1",
        citations: [
          {
            citation_id: "c1",
            claim_ids: ["claim-1"],
            passage_ids: ["passage-1"],
            pmid: "12345",
            pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
            title: "Source paper",
          },
        ],
        claims: [
          {
            citation_ids: ["c1"],
            claim_id: "claim-1",
            text: "Reviewed studies describe exposure.",
          },
        ],
        configuration_version: "config-v1",
        conversation_id: "conversation-1",
        evidence_state: "limited",
        request_id: "request-1",
        source_used: "literature_evidence",
        status: "answered",
      },
      headers: headers("request-1"),
      status: 200,
    });
    const result = await postAskAtlas({
      history: [
        { content: "Earlier question", role: "user" },
        { content: "Earlier answer", role: "assistant" },
      ],
      mode: "Literature",
      question: "What can tick surveillance tell us?",
    });
    expect(structuredRequest).not.toHaveBeenCalled();
    expect(mixedRequest).not.toHaveBeenCalled();
    expect(chatRequest.mock.calls[0]?.[0]).toStrictEqual({
      history: [
        { content: "Earlier question", role: "user" },
        { content: "Earlier answer", role: "assistant" },
      ],
      message: "What can tick surveillance tell us?",
    });
    expect(result.kind).toBe("literature");
  });

  it("posts Structured without history and keeps the header request id", async () => {
    structuredRequest.mockResolvedValue({
      data: structuredAnswered,
      headers: headers("structured-request-1"),
      status: 200,
    });
    const result = await postAskAtlas({
      context: {
        geography_ids: ["36027"],
        geography_type: "county",
        measure_id: "case_count_floor_2023",
        year: 2023,
      },
      history: [{ content: "Ignored by this endpoint", role: "user" }],
      mode: "Structured",
      question: "What is the 2023 Lyme case count for county 36027?",
    });
    expect(chatRequest).not.toHaveBeenCalled();
    expect(structuredRequest.mock.calls[0]?.[0]).toStrictEqual({
      context: {
        geography_ids: ["36027"],
        geography_type: "county",
        measure_id: "case_count_floor_2023",
        year: 2023,
      },
      question: "What is the 2023 Lyme case count for county 36027?",
      source_mode: "Structured",
    });
    expect(result).toMatchObject({
      kind: "structured",
      requestId: "structured-request-1",
      response: { answer: { outcome: "ANSWERED" } },
    });
  });

  it("accepts a typed clarification without inventing sources", async () => {
    structuredRequest.mockResolvedValue({
      data: structuredClarification,
      headers: headers("structured-request-2"),
      status: 200,
    });
    const result = await postAskAtlas({
      history: [],
      mode: "Structured",
      question: "What is the 2023 Lyme case count for county 09001?",
    });
    expect(result).toMatchObject({
      kind: "structured",
      response: {
        answer: {
          actual_sources_used: [],
          outcome: "NEEDS_CLARIFICATION",
        },
      },
    });
  });

  it("posts Both to the mixed endpoint and preserves insufficient_to_compare", async () => {
    mixedRequest.mockResolvedValue({
      data: mixedInsufficientToCompare,
      headers: headers("mixed-request-1"),
      status: 200,
    });
    const result = await postAskAtlas({
      history: [],
      mode: "Both",
      question: "What is the 2023 Lyme case count for county 36027?",
    });
    expect(structuredRequest).not.toHaveBeenCalled();
    expect(chatRequest).not.toHaveBeenCalled();
    expect(mixedRequest.mock.calls[0]?.[0]).toMatchObject({
      source_mode: "Both",
    });
    expect(mixedRequest.mock.calls[0]?.[0]).not.toHaveProperty("history");
    expect(result).toMatchObject({
      kind: "mixed",
      requestId: "mixed-request-1",
      response: {
        actual_sources_used: ["structured_atlas", "literature_evidence"],
        cross_source_state: "insufficient_to_compare",
      },
    });
  });

  it("reads a typed mixed failure body from an HTTP error", async () => {
    mixedRequest.mockRejectedValue(
      new AtlasApiError(
        "unavailable",
        "/v1/assistant/mixed",
        503,
        "mixed-request-503",
        30,
        mixedLiteratureOnly
      )
    );
    const result = await postAskAtlas({
      history: [],
      mode: "Both",
      question: "What does the governed literature say about Lyme disease?",
    });
    expect(result).toMatchObject({
      kind: "mixed",
      requestId: "mixed-request-503",
      response: {
        actual_sources_used: ["literature_evidence"],
        structured: null,
      },
    });
  });

  it("rejects a structured body that is not the documented response", async () => {
    structuredRequest.mockResolvedValue({
      data: { answer: { outcome: "aligned" } },
      headers: headers("bad"),
      status: 200,
    });
    await expect(
      postAskAtlas({
        history: [],
        mode: "Structured",
        question: "What is the 2023 Lyme case count for county 36027?",
      })
    ).rejects.toBeInstanceOf(AskAtlasAnswerContractError);
  });
});
