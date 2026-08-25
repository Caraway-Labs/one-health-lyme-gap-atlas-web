// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAT_STORAGE_KEY,
  LocalConversation,
  clearConversations,
  loadConversations,
  removeConversation,
  saveConversations,
} from "../src/lib/knowledge-chat-storage";

function conversation(id: string, updatedAt: string, expiresAt: string): LocalConversation {
  return { id, token: `token-${id}`, title: id, createdAt: updatedAt, updatedAt, expiresAt, turns: [] };
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
    expect(loadConversations(Date.parse("2026-08-25T00:00:00.000Z"))).toHaveLength(5);
  });

  it("purges expired conversations and supports deletion", () => {
    saveConversations([
      conversation("live", "2026-08-25T00:00:00.000Z", "2026-09-24T00:00:00.000Z"),
      conversation("old", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
    ]);
    expect(loadConversations(Date.parse("2026-08-25T00:00:00.000Z")).map((item) => item.id)).toEqual(["live"]);
    expect(removeConversation("live")).toEqual([]);
    clearConversations();
    expect(JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}").conversations).toEqual([]);
  });
});
