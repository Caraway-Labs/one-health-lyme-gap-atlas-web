import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
import {
  OUTCOME_MATRIX_STORY_PRESETS,
  storyChatNearLimitMessage,
} from "../stories/support/story-chat-model";
import { outcomeMatrixByStoryPreset } from "./fixtures/ask-atlas-outcome-matrix";

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

  it("clears pending when a new chat starts", () => {
    render(<ConversationStory preset="pending" />);
    expect(screen.getByText("Searching reviewed evidence…")).toBeTruthy();
    const pendingField = screen.getByRole("textbox", { name: "Your question" });
    expect(
      pendingField instanceof HTMLTextAreaElement && pendingField.disabled
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Start new chat" }));
    expect(screen.queryByText("Searching reviewed evidence…")).toBeNull();
    const readyField = screen.getByRole("textbox", { name: "Your question" });
    expect(
      readyField instanceof HTMLTextAreaElement && readyField.disabled
    ).toBeFalsy();
    expect(screen.getByText("Start with a research question")).toBeTruthy();
  });

  it("clears a client failure when a new chat starts", () => {
    render(<ConversationStory preset="client-failure" />);
    expect(screen.getByText("Connection problem.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText("Connection problem.")).toBeNull();
    expect(screen.getByText("Start with a research question")).toBeTruthy();
  });

  it("gives each grounded source story its own request id", () => {
    const presets = ["one", "many", "limited", "long", "unsafe"] as const;
    const view = render(
      <>
        {presets.map((preset) => (
          <SourcesStory key={preset} preset={preset} />
        ))}
      </>
    );
    const ids = [
      ...view.container.querySelectorAll<HTMLElement>("[id^='sources-']"),
    ].map((element) => element.id);
    expect(ids).toStrictEqual([
      "sources-story-chat-one",
      "sources-story-chat-many",
      "sources-story-chat-limited",
      "sources-story-chat-long",
      "sources-story-chat-unsafe",
    ]);
    const claimLists = [
      ...view.container.querySelectorAll<HTMLOListElement>("ol.citation-list"),
    ];
    expect(claimLists).toHaveLength(6);
    expect(
      claimLists.every(
        (list) => list.getAttribute("aria-label") === "Sources for this claim"
      )
    ).toBeTruthy();
    for (const list of claimLists) {
      expect(
        list
          .closest("[data-claim-id]")
          ?.querySelector("a, .citation-source-static")
      ).toBeTruthy();
    }
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

  it("renders each shared outcome fixture with its controls and question", () => {
    const rendered = OUTCOME_MATRIX_STORY_PRESETS.flatMap((preset) => {
      const outcome = outcomeMatrixByStoryPreset(preset);
      if (!outcome) {
        return [{ preset, missing: true }];
      }
      render(<ConversationStory preset={preset} />);
      const composer = screen.getByRole("textbox", {
        name: "Your question",
      });
      const view = {
        composer: composer instanceof HTMLTextAreaElement ? composer.value : "",
        edit: screen.queryByRole("button", { name: "Edit question" }) !== null,
        heading: screen.queryByText(outcome.heading) !== null,
        missing: false,
        preset,
        retry: screen.queryByRole("button", { name: /^Retry$/ }) !== null,
        retryLater:
          screen.queryByRole("button", { name: "Retry later" }) !== null,
        token:
          document.body.textContent?.includes("conversation_token") ?? false,
      };
      cleanup();
      return [view];
    });
    expect(rendered).toStrictEqual([
      {
        composer: "",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-answered-limited",
        retry: false,
        retryLater: false,
        token: false,
      },
      {
        composer: "",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-answered-single-study",
        retry: false,
        retryLater: false,
        token: false,
      },
      {
        composer: "Fixture question 06",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-capacity-limited",
        retry: false,
        retryLater: true,
        token: false,
      },
      {
        composer: "Fixture question 03",
        edit: true,
        heading: true,
        missing: false,
        preset: "matrix-corpus-gap",
        retry: false,
        retryLater: false,
        token: false,
      },
      {
        composer: "Fixture question 05",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-evidence-unavailable",
        retry: true,
        retryLater: false,
        token: false,
      },
      {
        composer: "Fixture question 11",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-network",
        retry: true,
        retryLater: false,
        token: false,
      },
      {
        composer: "Fixture question 09",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-rate-limited",
        retry: true,
        retryLater: false,
        token: false,
      },
      {
        composer: "",
        edit: true,
        heading: true,
        missing: false,
        preset: "matrix-safety-refusal",
        retry: false,
        retryLater: false,
        token: false,
      },
      {
        composer: "Fixture question 08",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-timeout",
        retry: true,
        retryLater: false,
        token: false,
      },
      {
        composer: "Fixture question 10",
        edit: false,
        heading: true,
        missing: false,
        preset: "matrix-unprocessable",
        retry: false,
        retryLater: false,
        token: false,
      },
    ]);
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
      screen.getByText("The Atlas corpus does not support an answer.")
    ).toBeTruthy();
    outcome.rerender(<OutcomeStory preset="answered" />);
    expect(document.querySelector("[data-assistant-state]")).toBeNull();
    expect(screen.getByText(/no extra panel/)).toBeTruthy();
  });
});
