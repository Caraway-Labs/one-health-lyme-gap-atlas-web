import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantOutcome } from "@/components/evidence-chat/assistant-outcome";
import { retainsSubmittedQuestion } from "@/components/evidence-chat/client-failure";
import type { KnowledgeChatResponse } from "@/generated/models";
import { KnowledgeChatResponseEvidenceState } from "@/generated/models/knowledgeChatResponseEvidenceState";

const SUBMITTED_QUESTION = "How does temperature affect tick questing?";
const ignoreRetry = vi.fn<(question: string) => void>();

function response(
  evidenceState: KnowledgeChatResponse["evidence_state"],
  status: KnowledgeChatResponse["status"] = "no_evidence"
): KnowledgeChatResponse {
  return {
    answer:
      "No relevant evidence is currently admitted in the Atlas corpus for this question. This does not mean scientific evidence does not exist.",
    assistant_policy_version: "policy-v1",
    citations: [],
    claims: [],
    configuration_version: "config-v1",
    conversation_id: "conversation-1",
    evidence_state: evidenceState,
    request_id: "request-corpus",
    source_used: "literature_evidence",
    status,
  };
}

describe("corpus-gap assistant outcome", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the corpus state and edit control for no_relevant_corpus_evidence", () => {
    const onEditQuestion = vi.fn<(question: string) => void>();
    render(
      <AssistantOutcome
        actionable
        onEditQuestion={onEditQuestion}
        onRetry={ignoreRetry}
        pending={false}
        question={SUBMITTED_QUESTION}
        response={response("no_relevant_corpus_evidence")}
      />
    );
    const state = document.querySelector<HTMLElement>(
      "[data-assistant-state='no_relevant_corpus_evidence']"
    );
    screen.getByRole("button", { name: "Edit question" }).click();
    expect({
      className: state?.className,
      edit: onEditQuestion.mock.calls[0]?.[0],
      heading: screen.getByText("The Atlas corpus does not support an answer.")
        .textContent,
      limit: screen.getByText(/governed Atlas corpus/).textContent,
      retained: retainsSubmittedQuestion(
        response("no_relevant_corpus_evidence")
      ),
      retry: screen.queryByRole("button", { name: "Retry" }),
      science: screen.getByText(
        /not a finding that scientific evidence does not exist/
      ).textContent,
    }).toStrictEqual({
      className: expect.stringContaining("chat-state-corpus"),
      edit: SUBMITTED_QUESTION,
      heading: "The Atlas corpus does not support an answer.",
      limit: expect.stringContaining("limit of that corpus"),
      retained: true,
      retry: null,
      science: expect.stringContaining(
        "not a finding that scientific evidence does not exist"
      ),
    });
  });

  it.each(
    Object.values(KnowledgeChatResponseEvidenceState).filter(
      (evidenceState) => evidenceState !== "no_relevant_corpus_evidence"
    )
  )(
    "does not render the corpus state when no_evidence is paired with %s",
    (evidenceState) => {
      const { container } = render(
        <AssistantOutcome
          actionable
          onEditQuestion={() => {}}
          onRetry={ignoreRetry}
          pending={false}
          question={SUBMITTED_QUESTION}
          response={response(evidenceState)}
        />
      );
      expect(container.querySelector("[data-assistant-state]")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Edit question" })
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      expect(retainsSubmittedQuestion(response(evidenceState))).toBeFalsy();
    }
  );
});
