import { describe, expect, it } from "vitest";

import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";

describe("reset Ask Atlas workspace handoff", () => {
  it("keeps county and dataset and adds the local conversation id", () => {
    const href = resetAskAtlasWorkspaceHref(
      "/app/explore",
      new URLSearchParams(
        "scope=ALL&county=08001&metric=reported-cases&dataset=alpha-2026&conversation=page-local"
      ),
      "conversation-1"
    );
    expect(href).toBe(
      "/app/assistant?county=08001&dataset=alpha-2026&conversation=conversation-1"
    );
  });

  it("starts in the workspace without a conversation or page-local keys", () => {
    expect(
      resetAskAtlasWorkspaceHref(
        "/app/explore",
        new URLSearchParams("scope=CO&metric=reported-cases&page=2")
      )
    ).toBe("/app/assistant");
  });
});
