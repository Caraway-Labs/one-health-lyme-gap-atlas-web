import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { KnowledgeChatResponse } from "@/generated/models";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

const CORPUS_LIMIT =
  "Atlas does not currently have relevant reviewed literature in its governed corpus for this question. This does not mean no scientific evidence exists elsewhere.";
const CORPUS_NEXT_STEP =
  "Edit this question and submit it again, or narrow it by species or pathogen, geography, study period, or a more specific scope. The Atlas literature corpus is expanding.";
const LITERATURE_HELP_HREF = "/docs/ai-enabled-decision-intelligence";

function OutcomeActions({ children }: { children: ReactNode }) {
  return <div className="chat-state-actions">{children}</div>;
}

export function AssistantOutcome({
  actionable,
  onEditQuestion,
  onRetry,
  pending,
  question,
  response,
}: {
  actionable: boolean;
  onEditQuestion: (question: string) => void;
  onRetry: (question: string) => void;
  pending: boolean;
  question: string;
  response: KnowledgeChatResponse;
}) {
  switch (response.status) {
    case "answered": {
      return null;
    }
    case "no_evidence": {
      if (response.evidence_state !== "no_relevant_corpus_evidence") {
        return null;
      }
      return (
        <div
          className="chat-state chat-state-corpus"
          data-assistant-state="no_relevant_corpus_evidence"
        >
          <p>
            <strong>No relevant literature in the Atlas corpus.</strong>{" "}
            {CORPUS_LIMIT}
          </p>
          <p>{CORPUS_NEXT_STEP}</p>
          <p>
            <Link href={LITERATURE_HELP_HREF}>
              Read how Atlas Assistant uses reviewed literature
            </Link>
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onEditQuestion(question)}
                {...analyticsControlAttributes("evidence_chat_edit_question")}
              >
                Edit question
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    case "evidence_unavailable": {
      return (
        <div
          className="chat-state chat-state-unavailable"
          data-assistant-state="evidence_unavailable"
        >
          <p>
            <strong>Evidence service unavailable.</strong> The evidence service
            could not complete this request. This is not a finding that the
            Atlas corpus has no relevant literature.
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRetry(question)}
                disabled={pending}
                {...analyticsControlAttributes("evidence_chat_retry")}
              >
                Retry
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    case "capacity_limited": {
      return (
        <div
          className="chat-state chat-state-capacity"
          data-assistant-state="capacity_limited"
        >
          <p>
            <strong>Temporarily at capacity.</strong> The assistant is capacity
            limited and could not answer right now. Try again later. This is not
            a finding about the literature.
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRetry(question)}
                disabled={pending}
                {...analyticsControlAttributes("evidence_chat_retry")}
              >
                Retry later
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    case "safety_refusal": {
      return (
        <div
          className="chat-state chat-state-refusal"
          data-assistant-state="safety_refusal"
        >
          <p>
            <strong>Request not answered.</strong> Atlas Assistant cannot answer
            this request. Revise it if you want to ask about reviewed
            literature.
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onEditQuestion(question)}
                {...analyticsControlAttributes("evidence_chat_edit_question")}
              >
                Edit question
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    default: {
      const unhandled: never = response.status;
      return unhandled;
    }
  }
}
