import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assistantConversationHref,
  readAssistantConversationId,
  resolveActiveConversation,
  resolveConversationSelection,
  synchronizeAssistantConversationUrl,
} from "@/lib/assistant-conversation-url";

describe("assistant conversation URL helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds assistant deep links", () => {
    expect(assistantConversationHref()).toBe("/assistant");
    expect(assistantConversationHref("conversation-1")).toBe(
      "/assistant?conversation=conversation-1"
    );
    expect(assistantConversationHref("legacy/id")).toBe(
      "/assistant?conversation=legacy%2Fid"
    );
  });

  it("reads conversation ids only from an assistant workspace route", () => {
    expect(
      readAssistantConversationId(
        "https://atlas.example/assistant?conversation=abc"
      )
    ).toBe("abc");
    expect(
      readAssistantConversationId(
        "https://atlas.example/app/assistant?conversation=abc"
      )
    ).toBe("abc");
    expect(
      readAssistantConversationId("https://atlas.example/?conversation=abc")
    ).toBeNull();
    expect(
      readAssistantConversationId(
        "https://atlas.example/app/review?conversation=abc"
      )
    ).toBeNull();
  });

  it("resolves missing and present local conversation selections", () => {
    expect(
      resolveConversationSelection("missing", [{ id: "saved" }])
    ).toStrictEqual({
      activeId: "__new__",
      missingConversationId: "missing",
    });
    expect(
      resolveConversationSelection("saved", [{ id: "saved" }])
    ).toStrictEqual({
      activeId: "saved",
      missingConversationId: null,
    });
    expect(resolveConversationSelection(null, [{ id: "saved" }])).toStrictEqual(
      {
        activeId: "saved",
        missingConversationId: null,
      }
    );
  });

  it("does not fall back to another conversation for an unknown id", () => {
    const conversations = [{ id: "saved" }];
    expect(
      resolveActiveConversation("missing", conversations, true)
    ).toBeUndefined();
    expect(
      resolveActiveConversation("__latest__", conversations, true)?.id
    ).toBe("saved");
    expect(
      resolveActiveConversation("__new__", conversations, true)
    ).toBeUndefined();
  });

  it("replaces stale assistant conversation query params", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const origin = window.location.origin;
    synchronizeAssistantConversationUrl(
      undefined,
      `${origin}/assistant?conversation=stale`
    );
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      `${origin}/assistant`
    );
    replaceState.mockClear();
    synchronizeAssistantConversationUrl(
      "conversation-2",
      `${origin}/assistant?conversation=conversation-1`
    );
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      `${origin}/assistant?conversation=conversation-2`
    );
    replaceState.mockClear();
    synchronizeAssistantConversationUrl(
      "conversation-2",
      `${origin}/app/assistant?county=08001&conversation=conversation-1`
    );
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      `${origin}/app/assistant?county=08001&conversation=conversation-2`
    );
  });
});
