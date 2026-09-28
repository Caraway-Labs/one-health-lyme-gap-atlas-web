// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import type { LocalConversation } from "../src/lib/knowledge-chat-storage";
import {
  CHAT_STORAGE_KEY,
  clearConversations,
  conversationHistory,
  loadConversations,
  removeConversation,
  saveConversations,
} from "../src/lib/knowledge-chat-storage";

function conversation(
  id: string,
  updatedAt: string,
  expiresAt: string
): LocalConversation {
  return {
    createdAt: updatedAt,
    expiresAt,
    id,
    title: id,
    turns: [],
    updatedAt,
  };
}

describe("knowledge chat local storage", () => {
  beforeEach(() => localStorage.clear());

  it("keeps only five newest non-expired conversations", () => {
    const future = "2026-09-30T00:00:00.000Z";
    saveConversations([
      conversation("6", "2026-08-06T00:00:00.000Z", future),
      conversation("5", "2026-08-05T00:00:00.000Z", future),
      conversation("4", "2026-08-04T00:00:00.000Z", future),
      conversation("3", "2026-08-03T00:00:00.000Z", future),
      conversation("2", "2026-08-02T00:00:00.000Z", future),
      conversation("1", "2026-08-01T00:00:00.000Z", future),
    ]);
    expect(
      loadConversations(Date.parse("2026-08-25T00:00:00.000Z"))
    ).toHaveLength(5);
  });

  it("purges expired conversations and supports deletion", () => {
    saveConversations([
      conversation(
        "live",
        "2026-08-25T00:00:00.000Z",
        "2026-09-24T00:00:00.000Z"
      ),
      conversation(
        "old",
        "2026-07-01T00:00:00.000Z",
        "2026-08-01T00:00:00.000Z"
      ),
    ]);
    expect(
      loadConversations(Date.parse("2026-08-25T00:00:00.000Z")).map(
        (item) => item.id
      )
    ).toStrictEqual(["live"]);
    expect(removeConversation("live")).toStrictEqual([]);
    clearConversations();
    expect(
      JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}").conversations
    ).toStrictEqual([]);
  });

  it("safely clears malformed roots and discards invalid persisted conversations", () => {
    localStorage.setItem(CHAT_STORAGE_KEY, "not json");
    expect(loadConversations()).toStrictEqual([]);

    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        conversations: [
          conversation(
            "valid",
            "2026-08-25T00:00:00.000Z",
            "2026-09-24T00:00:00.000Z"
          ),
          {
            ...conversation(
              "bad-role",
              "2026-08-25T00:00:00.000Z",
              "2026-09-24T00:00:00.000Z"
            ),
            turns: [
              {
                createdAt: "2026-08-25T00:00:00.000Z",
                id: "turn",
                role: "system",
                text: "no",
              },
            ],
          },
          {
            ...conversation(
              "bad-time",
              "not-a-time",
              "2026-09-24T00:00:00.000Z"
            ),
          },
        ],
        version: 1,
      })
    );
    expect(
      loadConversations(Date.parse("2026-08-26T00:00:00.000Z")).map(
        (item) => item.id
      )
    ).toStrictEqual(["valid"]);
  });

  it("preserves old chat text while discarding incompatible response metadata", () => {
    const stored = conversation(
      "bad-response",
      "2026-08-25T00:00:00.000Z",
      "2026-09-24T00:00:00.000Z"
    );
    stored.turns = [
      {
        createdAt: "2026-08-25T00:00:00.000Z",
        id: "assistant",
        role: "assistant",
        response: { answer: "text", conversation_id: "id" } as never,
        text: "text",
      },
    ];
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ conversations: [stored], version: 1 })
    );
    const loaded = loadConversations(Date.parse("2026-08-26T00:00:00.000Z"));
    expect(loaded[0].turns[0].text).toBe("text");
    expect(loaded[0].turns[0].response).toBeUndefined();
  });

  it("removes legacy continuation tokens from browser storage", () => {
    const stored = {
      ...conversation(
        "legacy",
        "2026-08-25T00:00:00.000Z",
        "2026-09-24T00:00:00.000Z"
      ),
      token: "secret",
    };
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ version: 1, conversations: [stored] })
    );
    expect(
      loadConversations(Date.parse("2026-08-26T00:00:00.000Z"))
    ).toHaveLength(1);
    expect(localStorage.getItem(CHAT_STORAGE_KEY)).not.toContain("secret");
  });

  it("sends only six complete recent turn pairs without tokens", () => {
    const stored = conversation(
      "history",
      "2026-08-25T00:00:00.000Z",
      "2026-09-24T00:00:00.000Z"
    );
    stored.turns = Array.from({ length: 8 }, (_, index) => [
      {
        id: `u${index}`,
        role: "user" as const,
        text: `question ${index}`,
        createdAt: stored.createdAt,
      },
      {
        id: `a${index}`,
        role: "assistant" as const,
        text: `answer ${index}`,
        createdAt: stored.createdAt,
      },
    ]).flat();
    expect(conversationHistory(stored)).toHaveLength(12);
    expect(conversationHistory(stored)[0]).toStrictEqual({
      role: "user",
      content: "question 2",
    });
  });

  it("omits operational failures from the history sent back to the API", () => {
    const stored = conversation(
      "history",
      "2026-08-25T00:00:00.000Z",
      "2026-09-24T00:00:00.000Z"
    );
    stored.turns = [
      {
        id: "user-gap",
        role: "user",
        text: "Where is the literature?",
        createdAt: stored.createdAt,
      },
      {
        id: "assistant-gap",
        role: "assistant",
        text: "No passages matched this question.",
        createdAt: stored.createdAt,
        response: {
          request_id: "request-gap",
          conversation_id: "history",
          configuration_version: "config",
          assistant_policy_version: "policy",
          status: "no_evidence",
          answer: "No passages matched this question.",
          evidence_state: "no_relevant_corpus_evidence",
          source_used: "literature_evidence",
        },
      },
      {
        id: "user-down",
        role: "user",
        text: "Try again",
        createdAt: stored.createdAt,
      },
      {
        id: "assistant-down",
        role: "assistant",
        text: "Evidence is temporarily unavailable.",
        createdAt: stored.createdAt,
        response: {
          request_id: "request-down",
          conversation_id: "history",
          configuration_version: "config",
          assistant_policy_version: "policy",
          status: "evidence_unavailable",
          answer: "Evidence is temporarily unavailable.",
          evidence_state: "evidence_unavailable",
          source_used: "literature_evidence",
        },
      },
    ];
    expect(conversationHistory(stored)).toStrictEqual([
      { role: "user", content: "Where is the literature?" },
      { role: "assistant", content: "No passages matched this question." },
    ]);
  });
});
