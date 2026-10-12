import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AskAtlasLiteratureRequestError,
  parseLiteratureChatRequest,
  postLiteratureChat,
} from "@/lib/ask-atlas-literature-adapter";

const { chatRequest, mixedRequest, structuredRequest } = vi.hoisted(() => ({
  chatRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  mixedRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  structuredRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => ({
  ...(await importOriginal()),
  askAtlasMixed: mixedRequest,
  askAtlasStructured: structuredRequest,
  knowledgeGraphChatV1KnowledgeGraphChatPost: chatRequest as never,
}));

const literatureQuestion = {
  history: [
    { content: "What do reviewed studies say?", role: "user" as const },
    {
      content: "Reviewed studies describe exposure.",
      role: "assistant" as const,
    },
  ],
  message: "How do those studies describe tick exposure?",
};

describe("Ask Atlas literature request adapter", () => {
  beforeEach(() => {
    chatRequest.mockReset();
    mixedRequest.mockReset();
    structuredRequest.mockReset();
  });

  it("keeps a literature request to message and history", () => {
    expect(parseLiteratureChatRequest(literatureQuestion)).toStrictEqual(
      literatureQuestion
    );
  });

  it("drops unknown history fields before the request is sent", () => {
    expect(
      parseLiteratureChatRequest({
        history: [
          {
            content: "What do reviewed studies say?",
            county: "08001",
            role: "user",
          },
        ],
        message: "How do those studies describe tick exposure?",
      })
    ).toStrictEqual({
      history: [{ content: "What do reviewed studies say?", role: "user" }],
      message: "How do those studies describe tick exposure?",
    });
  });

  it("rejects page context, source mode, and session fields", () => {
    const rejected = [
      { ...literatureQuestion, county: "08001" },
      { ...literatureQuestion, page_ref: "review" },
      { ...literatureQuestion, source_mode: "Structured" },
      { ...literatureQuestion, geography_ids: ["08001"] },
      { ...literatureQuestion, freshness: [{ state: "stale" }] },
      { ...literatureQuestion, conversation_token: "browser-secret" },
      { ...literatureQuestion, conversation_id: "conversation-1" },
      { history: literatureQuestion.history, message: "" },
      { history: literatureQuestion.history, message: "x".repeat(1001) },
      {
        history: Array.from({ length: 13 }, () => ({
          content: "What do reviewed studies say?",
          role: "user" as const,
        })),
        message: literatureQuestion.message,
      },
    ];
    for (const input of rejected) {
      expect(() => parseLiteratureChatRequest(input)).toThrow(
        AskAtlasLiteratureRequestError
      );
    }
    expect(chatRequest).not.toHaveBeenCalled();
    expect(structuredRequest).not.toHaveBeenCalled();
    expect(mixedRequest).not.toHaveBeenCalled();
  });

  it("posts only the parsed literature body to the knowledge-chat client", async () => {
    const controller = new AbortController();
    chatRequest.mockResolvedValue({ data: { status: "answered" } });
    await postLiteratureChat(literatureQuestion, { signal: controller.signal });
    expect(chatRequest).toHaveBeenCalledOnce();
    expect(chatRequest.mock.calls[0]).toStrictEqual([
      literatureQuestion,
      { signal: controller.signal },
    ]);
    expect(structuredRequest).not.toHaveBeenCalled();
    expect(mixedRequest).not.toHaveBeenCalled();
  });
});
