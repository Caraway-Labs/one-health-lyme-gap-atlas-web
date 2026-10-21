import { describe, expect, it } from "vitest";

import {
  hrefWithoutObsoleteAskAtlasPageReference,
  resetAskAtlasWorkspaceHref,
} from "@/features/ux-reset/ask-atlas/workspace-href";

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
      "/askatlas?county=08001&dataset=alpha-2026&conversation=conversation-1"
    );
  });

  it("starts in the workspace without a conversation or page-local keys", () => {
    expect(
      resetAskAtlasWorkspaceHref(
        "/app/explore",
        new URLSearchParams("scope=CO&metric=reported-cases&page=2")
      )
    ).toBe("/askatlas");
  });

  it("does not add page_ref when the source URL carries one", () => {
    expect(
      resetAskAtlasWorkspaceHref(
        "/explore",
        new URLSearchParams("county=08001&dataset=alpha-2026&page_ref=old")
      )
    ).toBe("/askatlas?county=08001&dataset=alpha-2026");
  });
});

describe("obsolete Ask Atlas page reference", () => {
  it("drops valid, duplicate, and malformed page_ref values and keeps conversation", () => {
    expect(
      hrefWithoutObsoleteAskAtlasPageReference(
        "/askatlas?page_ref=not-json&page_ref=again&county=08001&conversation=kept"
      )
    ).toBe("/askatlas?county=08001&conversation=kept");
    expect(
      hrefWithoutObsoleteAskAtlasPageReference(
        "https://onehealthatlas.org/askatlas?conversation=abc#notes"
      )
    ).toBe("/askatlas?conversation=abc#notes");
  });
});
