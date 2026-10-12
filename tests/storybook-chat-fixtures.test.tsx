import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import { AssistantOutcome } from "@/components/evidence-chat/assistant-outcome";
import { classifyKnowledgeChatResponse } from "@/lib/ask-atlas-answer-contract";
import { safePubMedUrl } from "@/lib/evidence-chat-sources";

import { OutcomeStory } from "../stories/assistant-outcome.stories";
import { SourcesStory } from "../stories/evidence-chat-answer-sources.stories";
import { ConversationStory } from "../stories/evidence-chat-conversation.stories";
import {
  answeredQuietResponse,
  corpusGapResponse,
  manyCitationsResponse,
  oneCitationResponse,
  unsafeCitationResponse,
} from "../stories/fixtures/story-chat";
import { SidebarStory } from "../stories/sidebar.stories";
import { storyChatNearLimitMessage } from "../stories/support/story-chat-model";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/iframe.html",
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

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

  it("resets the chat transcript when the preset changes", () => {
    const view = render(<ConversationStory preset="empty" />);
    expect(screen.getByText("Start with a research question")).toBeTruthy();
    view.rerender(<ConversationStory preset="near-limit" />);
    expect(screen.getByText("900/1,000")).toBeTruthy();
    view.rerender(<ConversationStory preset="client-failure" />);
    expect(screen.getByText("Connection problem.")).toBeTruthy();
  });

  it("resets the sidebar when the collapsed control changes", () => {
    const state = () => {
      const sidebar = document.querySelector("[data-slot='sidebar']");
      return sidebar instanceof HTMLElement ? sidebar.dataset.state : undefined;
    };
    const view = render(<SidebarStory startCollapsed={false} />);
    expect(state()).toBe("expanded");
    view.rerender(<SidebarStory startCollapsed />);
    expect(state()).toBe("collapsed");
  });

  it("changes sources and outcomes when their presets change", () => {
    const sources = render(<SourcesStory preset="one" />);
    expect(screen.getByText("1 source for this answer")).toBeTruthy();
    sources.rerender(<SourcesStory preset="nongrounded" />);
    expect(screen.getByTestId("sources-absent").textContent).toBe(
      "No source list for this outcome."
    );
    sources.unmount();
    const outcome = render(<OutcomeStory preset="corpus" />);
    expect(
      screen.getByText("No relevant literature in the Atlas corpus.")
    ).toBeTruthy();
    outcome.rerender(<OutcomeStory preset="answered" />);
    expect(document.querySelector("[data-assistant-state]")).toBeNull();
    expect(screen.getByText(/no extra panel/)).toBeTruthy();
  });
});
