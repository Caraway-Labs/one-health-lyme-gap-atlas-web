import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import { AssistantOutcome } from "@/components/evidence-chat/assistant-outcome";
import { classifyKnowledgeChatResponse } from "@/lib/ask-atlas-answer-contract";
import { safePubMedUrl } from "@/lib/evidence-chat-sources";

import {
  answeredQuietResponse,
  corpusGapResponse,
  manyCitationsResponse,
  oneCitationResponse,
  unsafeCitationResponse,
} from "../stories/fixtures/story-chat";
import { storyChatNearLimitMessage } from "../stories/support/story-chat-model";

describe("Storybook chat fixtures", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps a grounded citation on the PubMed host", () => {
    const response = oneCitationResponse();
    const decision = classifyKnowledgeChatResponse(response);
    const citation = response.citations?.[0];
    expect(decision.kind).toBe("grounded");
    expect(citation?.pmid).toBe("10000001");
    expect(
      safePubMedUrl(citation?.pubmed_url ?? "", citation?.pmid ?? "")
    ).toBe("https://pubmed.ncbi.nlm.nih.gov/10000001/");
    expect(manyCitationsResponse().citations).toHaveLength(2);
  });

  it("drops an unsafe citation URL", () => {
    const citation = unsafeCitationResponse().citations?.[0];
    expect(
      safePubMedUrl(citation?.pubmed_url ?? "", citation?.pmid ?? "")
    ).toBeNull();
  });

  it("renders no source list for a corpus gap", () => {
    const { container } = render(
      <EvidenceChatAnswerSources response={corpusGapResponse()} />
    );
    expect(container.querySelector(".chat-answer-sources")).toBeNull();
    expect(classifyKnowledgeChatResponse(corpusGapResponse()).kind).toBe(
      "corpus_gap"
    );
  });

  it("renders nothing for an answered outcome and keeps the near-limit draft under 1,000", () => {
    const { container } = render(
      <AssistantOutcome
        actionable
        onEditQuestion={() => {}}
        onRetry={() => {}}
        pending={false}
        question="Synthetic question"
        response={answeredQuietResponse()}
      />
    );
    expect(container.querySelector("[data-assistant-state]")).toBeNull();
    expect(storyChatNearLimitMessage.length).toBeGreaterThanOrEqual(900);
    expect(storyChatNearLimitMessage.length).toBeLessThanOrEqual(1000);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
