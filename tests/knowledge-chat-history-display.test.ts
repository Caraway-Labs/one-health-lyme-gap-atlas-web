// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  conversationEvidenceStrengthLabel,
  conversationTurnPreview,
  relativeConversationTime,
} from "../src/lib/knowledge-chat-history-display";
import type { LocalConversation } from "../src/lib/knowledge-chat-storage";

function conversationWithTurns(
  turns: LocalConversation["turns"]
): LocalConversation {
  return {
    createdAt: "2026-08-25T12:00:00.000Z",
    expiresAt: "2026-09-24T00:00:00.000Z",
    id: "c1",
    title: "What about ticks?",
    turns,
    updatedAt: "2026-08-25T12:00:00.000Z",
  };
}

describe("knowledge chat history display", () => {
  it("formats relative timestamps", () => {
    const now = Date.parse("2026-08-25T12:30:00.000Z");
    expect(relativeConversationTime("2026-08-25T12:29:10.000Z", now)).toBe(
      "Just now"
    );
    expect(relativeConversationTime("2026-08-25T11:45:00.000Z", now)).toBe(
      "45m ago"
    );
    expect(relativeConversationTime("2026-08-24T12:30:00.000Z", now)).toBe(
      "Yesterday"
    );
  });

  it("previews the latest assistant turn without inventing badges", () => {
    const withAnswer = conversationWithTurns([
      {
        createdAt: "2026-08-25T12:00:00.000Z",
        id: "u1",
        role: "user",
        text: "Long user question text",
      },
      {
        createdAt: "2026-08-25T12:00:01.000Z",
        id: "a1",
        role: "assistant",
        text: "Short assistant summary for re-find.",
        response: {
          answer: "Short assistant summary for re-find.",
          assistant_policy_version: "policy",
          configuration_version: "config",
          conversation_id: "c1",
          evidence_state: "limited",
          request_id: "r1",
          source_used: "literature_evidence",
          status: "answered",
        },
      },
    ]);
    expect(conversationTurnPreview(withAnswer)).toBe(
      "Short assistant summary for re-find."
    );
    expect(conversationEvidenceStrengthLabel(withAnswer)).toBe("Limited");

    const withoutAnswer = conversationWithTurns([
      {
        createdAt: "2026-08-25T12:00:00.000Z",
        id: "a1",
        role: "assistant",
        text: "Service unavailable",
        response: {
          answer: "Service unavailable",
          assistant_policy_version: "policy",
          configuration_version: "config",
          conversation_id: "c1",
          evidence_state: "evidence_unavailable",
          request_id: "r1",
          source_used: "literature_evidence",
          status: "evidence_unavailable",
        },
      },
    ]);
    expect(conversationEvidenceStrengthLabel(withoutAnswer)).toBeNull();
  });
});
