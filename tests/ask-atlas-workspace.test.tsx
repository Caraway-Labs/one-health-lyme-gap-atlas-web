import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AskAtlasChromeProvider,
  useAskAtlasChrome,
} from "@/features/ux-reset/ask-atlas/ask-atlas-chrome";
import { AskAtlasWorkspace } from "@/features/ux-reset/ask-atlas/ask-atlas-workspace";
import { AtlasApiError } from "@/lib/api-mutator";
import { CHAT_STORAGE_KEY } from "@/lib/knowledge-chat-storage";

let pathname = "/app/explore";
let search = new URLSearchParams(
  "scope=ALL&county=08001&metric=reported-cases"
);

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
  useSearchParams: () => search as unknown as ReadonlyURLSearchParams,
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
    </div>
  );
}

function chatResult(
  answer: string,
  requestId: string,
  conversationId: string,
  options: { pubmedUrl?: string } = {}
) {
  return {
    data: {
      answer,
      assistant_policy_version: "policy-v1",
      citations: [
        {
          citation_id: "c1",
          claim_ids: ["claim-1"],
          passage_ids: ["passage-1"],
          pmid: "12345",
          pubmed_url:
            options.pubmedUrl ?? "https://pubmed.ncbi.nlm.nih.gov/12345/",
          title: "Source paper",
        },
      ],
      claims: [{ citation_ids: ["c1"], claim_id: "claim-1", text: answer }],
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

function storedConversations(): {
  id: string;
  turns: { text: string }[];
}[] {
  const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}") as {
    conversations?: { id: string; turns?: { text: string }[] }[];
  };
  return (stored.conversations ?? []).map((conversation) => ({
    id: conversation.id,
    turns: conversation.turns ?? [],
  }));
}

async function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
  await screen.findByText("Searching reviewed evidence…");
}

describe("Ask Atlas research workspace", () => {
  beforeEach(() => {
    pathname = "/app/assistant";
    search = new URLSearchParams();
    localStorage.clear();
    chatRequest.mockReset();
    stubMatchMedia(false);
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
    window.history.replaceState({}, "", "/app/assistant");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks once in the sidecar and opens that conversation in the workspace", async () => {
    chatRequest.mockResolvedValue(
      chatResult(
        "Reviewed studies describe exposure.",
        "request-1",
        "conversation-1"
      )
    );
    pathname = "/app/explore";
    search = new URLSearchParams(
      "scope=ALL&county=08001&metric=reported-cases"
    );
    window.history.replaceState({}, "", "/app/explore?county=08001");
    const sidecar = render(
      <AskAtlasChromeProvider>
        <ChromeProbe />
      </AskAtlasChromeProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Atlas" }));
    await ask("How do reviewed studies describe tick exposure?");
    await screen.findByText("Reviewed studies describe exposure.");
    const handoff = screen.getByRole("link", { name: "Open full workspace" });
    expect({
      calls: chatRequest.mock.calls.length,
      href: handoff.getAttribute("href"),
      keys: Object.keys(chatRequest.mock.calls[0]?.[0] as object).toSorted(),
    }).toStrictEqual({
      calls: 1,
      href: "/app/assistant?county=08001&conversation=conversation-1",
      keys: ["history", "message"],
    });

    sidecar.unmount();
    pathname = "/app/assistant";
    search = new URLSearchParams("conversation=conversation-1");
    window.history.replaceState(
      {},
      "",
      "/app/assistant?conversation=conversation-1"
    );
    render(<AskAtlasWorkspace initialConversationId="conversation-1" />);
    await screen.findByText("Reviewed studies describe exposure.");
    expect({
      both: screen.queryByRole("tab", { name: /both/i }),
      calls: chatRequest.mock.calls.length,
      conversations: storedConversations().length,
      modes: screen.getByText(/Structured and Both modes are not available/)
        .textContent,
      structured: screen.queryByRole("button", { name: /structured/i }),
    }).toStrictEqual({
      both: null,
      calls: 1,
      conversations: 1,
      modes: expect.stringMatching(
        /Structured and Both modes are not available/
      ),
      structured: null,
    });
  });

  it("recovers a direct link when the conversation is not in this browser", async () => {
    window.history.replaceState(
      {},
      "",
      "/app/assistant?conversation=missing-id"
    );
    render(<AskAtlasWorkspace initialConversationId="missing-id" />);
    const notice = await screen.findByText(
      "Conversation not found in this browser."
    );
    expect(notice).toBeTruthy();
    expect(
      (screen.getByLabelText("Your question") as HTMLTextAreaElement).disabled
    ).toBeFalsy();
    expect(chatRequest).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("clears local history and recovers a stale conversation address", async () => {
    chatRequest.mockResolvedValue(
      chatResult("Saved answer.", "request-clear", "conversation-clear")
    );
    pathname = "/app/assistant";
    search = new URLSearchParams();
    window.history.replaceState({}, "", "/app/assistant");
    render(<AskAtlasWorkspace />);
    await ask("Question to clear");
    await screen.findByText("Saved answer.");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear all",
      })
    );
    await screen.findByText("Start with a research question");
    expect(storedConversations()).toStrictEqual([]);

    window.history.pushState(
      {},
      "",
      "/app/assistant?conversation=conversation-clear"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    await screen.findByText("Conversation not found in this browser.");
    expect(screen.queryByText("Saved answer.")).toBeNull();
  });

  it("restores the selected conversation on back and forward", async () => {
    chatRequest
      .mockResolvedValueOnce(
        chatResult("First saved answer.", "request-a", "conversation-a")
      )
      .mockResolvedValueOnce(
        chatResult("Second saved answer.", "request-b", "conversation-b")
      );
    pathname = "/app/assistant";
    search = new URLSearchParams();
    window.history.replaceState({}, "", "/app/assistant");
    render(<AskAtlasWorkspace />);
    await ask("First question");
    await screen.findByText("First saved answer.");
    fireEvent.click(screen.getAllByRole("button", { name: "New chat" })[0]);
    await ask("Second question");
    await screen.findByText("Second saved answer.");

    window.history.pushState(
      {},
      "",
      "/app/assistant?conversation=conversation-a"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => {
      expect(document.querySelector(".chat-transcript")?.textContent).toContain(
        "First saved answer."
      );
    });
    expect(
      document.querySelector(".chat-transcript")?.textContent
    ).not.toContain("Second saved answer.");

    window.history.pushState(
      {},
      "",
      "/app/assistant?conversation=conversation-b"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => {
      expect(document.querySelector(".chat-transcript")?.textContent).toContain(
        "Second saved answer."
      );
    });
  });

  it("shows a request failure without citations and retries once", async () => {
    chatRequest
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(
        chatResult(
          "Evidence is available again.",
          "request-up",
          "conversation-up"
        )
      );
    pathname = "/app/assistant";
    window.history.replaceState({}, "", "/app/assistant");
    render(<AskAtlasWorkspace />);
    await ask("What does the evidence say?");
    const alert = await screen.findByRole("alert");
    expect(alert.dataset.assistantState).toBe("network_failure");
    expect(document.querySelector(".citation-list")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Evidence is available again.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(chatRequest).toHaveBeenCalledTimes(2);
  });

  it("does not link a citation whose address is not PubMed", async () => {
    chatRequest.mockResolvedValue(
      chatResult("Cited answer.", "request-cite", "conversation-cite", {
        pubmedUrl: "https://example.com/not-pubmed",
      })
    );
    pathname = "/app/assistant";
    window.history.replaceState({}, "", "/app/assistant");
    render(<AskAtlasWorkspace />);
    await ask("Show the source");
    await screen.findByText("Cited answer.");
    expect(screen.getByText("Source paper")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Source paper/ })).toBeNull();
    expect(document.body.innerHTML).not.toContain(
      "https://example.com/not-pubmed"
    );
  });

  it("keeps an invalid county handoff out of the literature request", async () => {
    chatRequest.mockResolvedValue(
      chatResult("Literature only.", "request-stale", "conversation-stale")
    );
    pathname = "/app/assistant";
    search = new URLSearchParams("county=12abc&dataset=alpha-2026");
    window.history.replaceState(
      {},
      "",
      "/app/assistant?county=12abc&dataset=alpha-2026"
    );
    render(<AskAtlasWorkspace />);
    expect(
      document.querySelector("[data-assistant-county-state='invalid']")
        ?.textContent
    ).toContain("County context not applied");
    await ask("Question without county evidence");
    await screen.findByText("Literature only.");
    expect(chatRequest.mock.calls[0]?.[0]).toStrictEqual({
      history: [],
      message: "Question without county evidence",
    });
  });

  it("drops a late answer after a newer question is already saved", async () => {
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(first.promise);
    chatRequest.mockReturnValueOnce(second.promise);
    pathname = "/app/assistant";
    search = new URLSearchParams();
    window.history.replaceState({}, "", "/app/assistant");
    render(<AskAtlasWorkspace />);
    await ask("Old question");
    fireEvent.click(screen.getAllByRole("button", { name: "New chat" })[0]);
    await ask("New question");
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
      expect(
        storedConversations().flatMap((item) =>
          item.turns.map((turn) => turn.text)
        )
      ).toStrictEqual(["New question", "New answer stays."]);
    });
    expect(
      screen.queryByText("Old answer must not replace history.")
    ).toBeNull();
  });

  it("shows unavailable without a composer or a request when literature chat is off", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "false");
    pathname = "/app/assistant";
    render(<AskAtlasWorkspace />);
    expect(screen.getByTestId("ask-atlas-disabled").textContent).toContain(
      "service availability state"
    );
    expect(screen.queryByLabelText("Your question")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Ask$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /structured/i })).toBeNull();
    expect(chatRequest).not.toHaveBeenCalled();
  });

  it("hides citations when the service returns an evidence-unavailable answer", async () => {
    const payload = chatResult(
      "Service could not finish.",
      "request-503",
      "conversation-503"
    ).data;
    chatRequest.mockRejectedValue(
      new AtlasApiError(
        "unavailable",
        "/v1/knowledge-graph/chat",
        503,
        null,
        null,
        {
          ...payload,
          evidence_state: "evidence_unavailable",
          status: "evidence_unavailable",
        }
      )
    );
    pathname = "/app/assistant";
    window.history.replaceState({}, "", "/app/assistant");
    render(<AskAtlasWorkspace />);
    await ask("Question during an outage");
    await screen.findByText("Service could not finish.");
    expect(screen.queryByText("Source paper")).toBeNull();
    expect(document.querySelector(".citation-list")).toBeNull();
  });
});
