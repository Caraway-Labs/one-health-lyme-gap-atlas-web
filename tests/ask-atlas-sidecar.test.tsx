import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AskAtlasChromeProvider,
  useAskAtlasChrome,
} from "@/features/ux-reset/ask-atlas/ask-atlas-chrome";
import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
  usePublishAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromReview } from "@/features/ux-reset/ask-atlas/inherited-context";
import type { AskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/inherited-context";
import { AtlasApiError } from "@/lib/api-mutator";
import { CHAT_STORAGE_KEY } from "@/lib/knowledge-chat-storage";

let pathname = "/app/explore";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams() as ReadonlyURLSearchParams,
}));

const { chatRequest } = vi.hoisted(() => ({
  chatRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => ({
  ...(await importOriginal()),
  knowledgeGraphChatV1KnowledgeGraphChatPost: chatRequest as never,
}));

function stubMatchMedia(mobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches: query.includes("800px") ? mobile : false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

function ChromeProbe() {
  const chrome = useAskAtlasChrome();
  return (
    <div>
      <div data-testid="launcher-slot">{chrome.launcher}</div>
      <div data-testid="desktop-slot">{chrome.desktopPanel}</div>
      <div data-page-inert={chrome.pageInert ? "true" : "false"} />
      <div data-testid="modal-slot">{chrome.compactModal}</div>
    </div>
  );
}

function ContextProbe() {
  const context = useAskAtlasInheritedContext();
  return (
    <p data-testid="published-release">
      {context?.fields.release.state === "validated"
        ? context.fields.release.id
        : "none"}
    </p>
  );
}

function Publisher({ value }: { value: AskAtlasInheritedContext | null }) {
  usePublishAskAtlasInheritedContext(value);
  return null;
}

function chatResult(answer: string, requestId: string, conversationId: string) {
  return {
    data: {
      answer,
      assistant_policy_version: "policy-v1",
      configuration_version: "config-v1",
      conversation_id: conversationId,
      conversation_token: "browser-secret",
      evidence_state: "limited",
      request_id: requestId,
      source_used: "literature_evidence",
      status: "answered",
    },
  };
}

function storedTurnTexts(): string[] {
  const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}") as {
    conversations?: { turns?: { text: string }[] }[];
  };
  return (stored.conversations ?? []).flatMap((conversation) =>
    (conversation.turns ?? []).map((turn) => turn.text)
  );
}

function chromeTree() {
  return (
    <AskAtlasChromeProvider>
      <ChromeProbe />
      <button type="button">Governed measure</button>
    </AskAtlasChromeProvider>
  );
}

async function askFromOpenSidecar(question: string) {
  fireEvent.click(screen.getByRole("button", { name: "Ask Atlas" }));
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
  await screen.findByText("Searching reviewed evidence…");
}

describe("Ask Atlas reset sidecar", () => {
  beforeEach(() => {
    pathname = "/app/explore";
    localStorage.clear();
    chatRequest.mockReset();
    stubMatchMedia(false);
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps Action and other non-analytical routes free of a second assistant", () => {
    pathname = "/app/action";
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    expect(screen.queryByRole("button", { name: "Ask Atlas" })).toBeNull();
    expect(screen.queryByTestId("ask-atlas-panel")).toBeNull();
  });

  it("shows the disabled backend fixture and does not call the request adapter", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "false");
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Atlas" }));
    expect(screen.getByTestId("ask-atlas-disabled").textContent).toContain(
      "service availability state"
    );
    expect(screen.queryByLabelText("Your question")).toBeNull();
    expect(chatRequest).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("desktop-slot").querySelector("#ux-reset-ask-atlas")
    ).toBeTruthy();
    expect(
      document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
        .pageInert
    ).toBe("false");
  });

  it("uses a modal inert flag only while the compact sidecar is open", () => {
    stubMatchMedia(true);
    render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    expect(
      document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
        .pageInert
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Ask Atlas" }));
    expect({
      dialog: Boolean(
        screen.queryByRole("dialog", { name: "Atlas Assistant" })
      ),
      dock: screen
        .getByTestId("desktop-slot")
        .querySelector("#ux-reset-ask-atlas"),
      inert:
        document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
          .pageInert,
      modal: Boolean(
        screen.getByTestId("modal-slot").querySelector("#ux-reset-ask-atlas")
      ),
    }).toStrictEqual({
      dialog: true,
      dock: null,
      inert: "true",
      modal: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Close Ask Atlas" }));
    expect(screen.queryByTestId("ask-atlas-panel")).toBeNull();
    expect(
      document.querySelector<HTMLElement>("[data-page-inert]")?.dataset
        .pageInert
    ).toBe("false");
  });

  it("clears inherited context when the publishing page unmounts", () => {
    const review = inheritedContextFromReview({
      rankedCounties: [
        { county: "Adams", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    const { rerender } = render(
      <AskAtlasInheritedContextProvider>
        <Publisher value={review} />
        <ContextProbe />
      </AskAtlasInheritedContextProvider>
    );
    expect(screen.getByTestId("published-release").textContent).toBe(
      "alpha-2026"
    );
    rerender(
      <AskAtlasInheritedContextProvider>
        <ContextProbe />
      </AskAtlasInheritedContextProvider>
    );
    expect(screen.getByTestId("published-release").textContent).toBe("none");
  });

  it("drops a late answer from an unmounted sidecar without erasing the newer chat", async () => {
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(first.promise);
    chatRequest.mockReturnValueOnce(second.promise);
    const { rerender } = render(chromeTree());
    await askFromOpenSidecar("Old question from Explore");
    pathname = "/app/action";
    rerender(chromeTree());
    pathname = "/app/investigate";
    rerender(chromeTree());
    await askFromOpenSidecar("New question from Investigate");
    second.resolve(
      chatResult("New answer stays.", "request-new", "conversation-new")
    );
    await screen.findByText("New answer stays.");
    first.resolve(
      chatResult(
        "Old answer must not replace history.",
        "request-old",
        "conversation-old"
      )
    );
    await waitFor(() => {
      expect({
        aborted: (
          chatRequest.mock.calls[0]?.[1] as { signal?: AbortSignal } | undefined
        )?.signal?.aborted,
        texts: storedTurnTexts(),
        visibleOld: screen.queryByText("Old answer must not replace history."),
      }).toStrictEqual({
        aborted: true,
        texts: ["New question from Investigate", "New answer stays."],
        visibleOld: null,
      });
    });
  });

  it("drops a late rejected answer from an unmounted sidecar without erasing the newer chat", async () => {
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(first.promise);
    chatRequest.mockReturnValueOnce(second.promise);
    const { rerender } = render(chromeTree());
    await askFromOpenSidecar("Old question from Explore");
    pathname = "/app/action";
    rerender(chromeTree());
    pathname = "/app/investigate";
    rerender(chromeTree());
    await askFromOpenSidecar("New question from Investigate");
    second.resolve(
      chatResult("New answer stays.", "request-new", "conversation-new")
    );
    await screen.findByText("New answer stays.");
    first.reject(
      new AtlasApiError(
        "unavailable",
        "/v1/knowledge-graph/chat",
        503,
        null,
        null,
        chatResult(
          "Rejected answer must not replace history.",
          "request-old",
          "conversation-old"
        ).data
      )
    );
    await waitFor(() => {
      expect({
        texts: storedTurnTexts(),
        visibleNew: Boolean(screen.queryByText("New answer stays.")),
        visibleOld: screen.queryByText(
          "Rejected answer must not replace history."
        ),
      }).toStrictEqual({
        texts: ["New question from Investigate", "New answer stays."],
        visibleNew: true,
        visibleOld: null,
      });
    });
  });

  it("leaves focus on the page when a docked answer completes", async () => {
    const pending = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(pending.promise);
    render(chromeTree());
    await askFromOpenSidecar("Question while the page stays usable");
    const pageControl = screen.getByRole("button", {
      name: "Governed measure",
    });
    pageControl.focus();
    pending.resolve(
      chatResult(
        "Docked answer stays off the page.",
        "request-dock",
        "conversation-dock"
      )
    );
    await screen.findByText("Docked answer stays off the page.");
    await waitFor(() => expect(document.activeElement).toBe(pageControl));
  });

  it("leaves focus on the page when a docked answer fails", async () => {
    const pending = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(pending.promise);
    render(chromeTree());
    await askFromOpenSidecar("Question while the page stays usable");
    const pageControl = screen.getByRole("button", {
      name: "Governed measure",
    });
    pageControl.focus();
    pending.reject(new Error("Failed to fetch"));
    await screen.findByRole("button", { name: "Retry" });
    await waitFor(() => expect(document.activeElement).toBe(pageControl));
  });

  it("returns focus to the composer when the docked chat still owns the interaction", async () => {
    const pending = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(pending.promise);
    render(chromeTree());
    await askFromOpenSidecar("Question still in the sidecar");
    screen.getByRole("button", { name: "New chat" }).focus();
    pending.resolve(
      chatResult(
        "Composer keeps the keyboard.",
        "request-focus",
        "conversation-focus"
      )
    );
    await screen.findByText("Composer keeps the keyboard.");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText("Your question")
      )
    );
  });
});
