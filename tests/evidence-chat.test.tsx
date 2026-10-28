import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/assistant",
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

const { chatRequest } = vi.hoisted(() => ({
  chatRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => ({
  ...(await importOriginal()),
  askKnowledgeGraph: chatRequest as never,
}));

import { EvidenceChat } from "../src/components/evidence-chat";
import {
  ASK_ATLAS_CLIENT_DEADLINE_MS,
  ASK_ATLAS_PENDING_STATUS_DELAY_MS,
} from "../src/components/evidence-chat/use-evidence-chat";
import { AtlasApiError } from "../src/lib/api-mutator";
import { atlasAnalytics } from "../src/lib/atlas-analytics";
import {
  CHAT_STORAGE_KEY,
  loadConversations,
  saveConversations,
} from "../src/lib/knowledge-chat-storage";

function response(
  status = "answered",
  evidence_state = "limited",
  answer = "Evidence varies by study setting.",
  requestId = "request-1"
) {
  return {
    request_id: requestId,
    conversation_id: "conversation-1",
    conversation_token: "browser-secret",
    assistant_policy_version: "policy-v1",
    configuration_version: "config-v1",
    status,
    evidence_state,
    source_used: "literature_evidence",
    answer,
    claims:
      status === "answered"
        ? [
            {
              claim_id: "claim-1",
              text: answer,
              citation_ids: ["c1"],
            },
          ]
        : [],
    citations:
      status === "answered"
        ? [
            {
              citation_id: "c1",
              pmid: "12345",
              title: "A paper",
              pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
              claim_ids: ["claim-1"],
              passage_ids: ["passage-1"],
            },
          ]
        : [],
  };
}

function storedAnswer(id: string, text: string, createdAt: string) {
  return {
    createdAt,
    id,
    response: {
      answer: text,
      assistant_policy_version: "policy-v1",
      citations: [
        {
          citation_id: "c1",
          claim_ids: ["claim-1"],
          passage_ids: ["passage-1"],
          pmid: "12345",
          pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
          title: "A paper",
        },
      ],
      claims: [
        {
          citation_ids: ["c1"],
          claim_id: "claim-1",
          text,
        },
      ],
      configuration_version: "config-v1",
      conversation_id: id,
      evidence_state: "limited" as const,
      request_id: id,
      source_used: "literature_evidence" as const,
      status: "answered" as const,
    },
    role: "assistant" as const,
    text,
  };
}

async function submit() {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: "What does the evidence say?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe(EvidenceChat, () => {
  beforeEach(() => {
    localStorage.clear();
    chatRequest.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows literature starter prompts that populate the composer without submitting", async () => {
    render(<EvidenceChat />);
    const starter = screen.getByRole("button", {
      name: "Tick vectors and reservoir hosts",
    });
    expect(starter.dataset.atlasAnalyticsControl).toBe(
      "evidence_chat_starter_prompt"
    );
    fireEvent.click(starter);
    const question = screen.getByLabelText(
      "Your question"
    ) as HTMLTextAreaElement;
    expect(question.value).toContain("Ixodes tick vectors");
    expect(chatRequest).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(question);
  });

  it("hides starter prompts after a conversation begins", async () => {
    chatRequest.mockResolvedValue({ data: response() });
    render(<EvidenceChat />);
    expect(screen.getByText("Starter questions")).toBeTruthy();
    await submit();
    await screen.findByText("Evidence: Limited evidence");
    expect(screen.queryByText("Starter questions")).toBeNull();
  });

  it("surfaces a controlled error when the chat response fails schema validation", async () => {
    chatRequest.mockResolvedValue({
      data: { ...response(), status: "unverified" },
    });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Response could not be verified.");
    expect(
      screen.getByText(
        "Evidence chat response could not be verified. Please try again later."
      )
    ).toBeTruthy();
    expect(screen.queryByText("unverified")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("renders evidence and source indicators with a safe paper link and no stored token", async () => {
    chatRequest.mockResolvedValue({ data: response() });
    render(<EvidenceChat />);
    await submit();
    await expect(
      screen.findByText("Evidence: Limited evidence")
    ).resolves.toBeTruthy();
    expect(screen.getByText("Source: Literature evidence")).toBeTruthy();
    const link = screen.getByRole("link", { name: /A paper/i });
    expect({
      countLabel: screen.getByText("1 source for this answer").textContent,
      href: link.getAttribute("href"),
      linkClass: link.className,
      linkText: link.textContent,
      storage: localStorage.getItem(CHAT_STORAGE_KEY),
      request: chatRequest.mock.calls[0]?.[0],
    }).toStrictEqual({
      countLabel: "1 source for this answer",
      href: "https://pubmed.ncbi.nlm.nih.gov/12345/",
      linkClass: expect.stringContaining("citation-source-link"),
      linkText: expect.stringContaining("PMID 12345"),
      storage: expect.not.stringContaining("browser-secret"),
      request: {
        message: "What does the evidence say?",
        history: [],
      },
    });
  });

  it("renders a typed unavailable response and offers retry", async () => {
    chatRequest.mockRejectedValue(
      new AtlasApiError(
        "unavailable",
        "/v1/knowledge-graph/chat",
        503,
        null,
        null,
        response("evidence_unavailable", "evidence_unavailable")
      )
    );
    render(<EvidenceChat />);
    await submit();
    await expect(
      screen.findByText("Evidence varies by study setting.")
    ).resolves.toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(
      document.querySelector("[data-assistant-state='evidence_unavailable']")
    ).toBeTruthy();
    expect(
      screen.queryByText("The Atlas corpus does not support an answer.")
    ).toBeNull();
    expect(screen.queryByLabelText("Evidence details")).toBeNull();
    await waitFor(() =>
      expect(localStorage.getItem(CHAT_STORAGE_KEY)).not.toContain(
        "browser-secret"
      )
    );
  });

  it.each([
    ["single_study", "Single-study evidence"],
    ["consistent", "Consistent evidence"],
    ["mixed", "Mixed evidence"],
    ["conflicting", "Conflicting evidence"],
    ["insufficient_to_compare", "Insufficient evidence to compare"],
  ])("shows answered %s as %s", async (state, label) => {
    chatRequest.mockResolvedValue({ data: response("answered", state) });
    render(<EvidenceChat />);
    await submit();
    await expect(screen.findByText(`Evidence: ${label}`)).resolves.toBeTruthy();
    expect(screen.getByText("Source: Literature evidence")).toBeTruthy();
  });

  it("distinguishes Atlas corpus availability from scientific evidence", async () => {
    chatRequest.mockResolvedValue({
      data: response(
        "no_evidence",
        "no_relevant_corpus_evidence",
        "No passages matched this question."
      ),
    });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("No passages matched this question.");
    expect({
      corpus: screen.getByText(/governed Atlas corpus/).textContent,
      elsewhere: screen.queryByText(
        /not a finding that scientific evidence does not exist/
      )?.textContent,
      evidenceDetails: screen.queryByLabelText("Evidence details"),
      helpHref: screen
        .getByRole("link", {
          name: "Read how Atlas Assistant uses reviewed literature",
        })
        .getAttribute("href"),
      pubmed: screen.queryByText(/PubMed/i),
      source: screen.queryByText("Source: Literature evidence"),
    }).toStrictEqual({
      corpus: expect.stringContaining("governed Atlas corpus"),
      elsewhere: expect.stringContaining(
        "not a finding that scientific evidence does not exist"
      ),
      evidenceDetails: null,
      helpHref: "/docs/ai-enabled-decision-intelligence",
      pubmed: null,
      source: null,
    });
    expect(
      document.querySelector(
        "[data-assistant-state='no_relevant_corpus_evidence']"
      )
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit question" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it.each([
    "single_study",
    "consistent",
    "limited",
    "mixed",
    "conflicting",
    "insufficient_to_compare",
    "evidence_unavailable",
    "not_applicable",
  ] as const)(
    "does not present a corpus gap when no_evidence is paired with %s",
    async (evidenceState) => {
      chatRequest.mockResolvedValue({
        data: response(
          "no_evidence",
          evidenceState,
          "The service returned an unmatched evidence state."
        ),
      });
      render(<EvidenceChat />);
      await submit();
      const alert = await screen.findByRole("alert");
      expect({
        corpus: document.querySelector(
          "[data-assistant-state='no_relevant_corpus_evidence']"
        ),
        edit: screen.queryByRole("button", { name: "Edit question" }),
        reason: alert.dataset.closeReason,
        state: alert.dataset.assistantState,
      }).toStrictEqual({
        corpus: null,
        edit: null,
        reason: "partial",
        state: "response_unverified",
      });
    }
  );

  it("keeps the question focused for editing and announces corpus results", async () => {
    chatRequest.mockResolvedValue({
      data: response(
        "no_evidence",
        "no_relevant_corpus_evidence",
        "No passages matched this question."
      ),
    });
    render(<EvidenceChat />);
    await submit();
    const question = screen.getByLabelText("Your question");
    await screen.findByText(/governed Atlas corpus/);
    await waitFor(() => expect(document.activeElement).toBe(question));
    expect({
      live: document
        .querySelector(".chat-transcript")
        ?.getAttribute("aria-live"),
      value: (question as HTMLTextAreaElement).value,
    }).toStrictEqual({
      live: "polite",
      value: "What does the evidence say?",
    });
  });

  it("renders a safety refusal without evidence metadata", async () => {
    chatRequest.mockResolvedValue({
      data: response(
        "safety_refusal",
        "not_applicable",
        "I cannot give individual medical advice."
      ),
    });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("I cannot give individual medical advice.");
    expect({
      evidenceDetails: screen.queryByLabelText("Evidence details"),
      notApplicable: screen.queryByText(/Evidence state not applicable/),
      paper: screen.queryByRole("link", { name: "A paper" }),
      retry: screen.queryByRole("button", { name: "Retry" }),
      state: document.querySelector<HTMLElement>(
        "[data-assistant-state='safety_refusal']"
      )?.dataset.assistantState,
    }).toStrictEqual({
      evidenceDetails: null,
      notApplicable: null,
      paper: null,
      retry: null,
      state: "safety_refusal",
    });
  });

  it("renders a capacity response with retry and no evidence metadata", async () => {
    chatRequest.mockRejectedValue(
      new AtlasApiError(
        "busy",
        "/v1/knowledge-graph/chat",
        503,
        null,
        null,
        response(
          "capacity_limited",
          "not_applicable",
          "The assistant is at capacity. Please retry."
        )
      )
    );
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("The assistant is at capacity. Please retry.");
    expect({
      corpus: screen.queryByText(/governed Atlas corpus/i),
      evidenceDetails: screen.queryByLabelText("Evidence details"),
      literature: screen.queryByText(
        "The Atlas corpus does not support an answer."
      ),
      retryLater: screen.getByRole("button", { name: "Retry later" })
        .textContent,
      source: screen.queryByText("Source: Literature evidence"),
      state: document.querySelector<HTMLElement>(
        "[data-assistant-state='capacity_limited']"
      )?.dataset.assistantState,
    }).toStrictEqual({
      corpus: null,
      evidenceDetails: null,
      literature: null,
      retryLater: "Retry later",
      source: null,
      state: "capacity_limited",
    });
  });

  it("does not link to a non-PubMed citation URL", async () => {
    const unsafe = response();
    unsafe.citations[0].pubmed_url = "https://example.com/12345/";
    chatRequest.mockResolvedValue({ data: unsafe });
    render(<EvidenceChat />);
    await submit();
    await expect(screen.findByText("A paper")).resolves.toBeTruthy();
    expect(screen.queryByRole("link", { name: "A paper" })).toBeNull();
  });

  it("keeps one local turn pair when an operational failure is retried", async () => {
    chatRequest
      .mockRejectedValueOnce(
        new AtlasApiError(
          "unavailable",
          "/v1/knowledge-graph/chat",
          503,
          null,
          null,
          response(
            "evidence_unavailable",
            "evidence_unavailable",
            "Evidence is temporarily unavailable.",
            "request-down"
          )
        )
      )
      .mockResolvedValueOnce({
        data: response(
          "answered",
          "limited",
          "Evidence is available again.",
          "request-up"
        ),
      });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Evidence is temporarily unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Evidence is available again.");
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}");
    expect({
      conversations: stored.conversations.length,
      removedFailure: screen.queryByText(
        "Evidence is temporarily unavailable."
      ),
      turns: stored.conversations[0].turns.length,
    }).toStrictEqual({
      conversations: 1,
      removedFailure: null,
      turns: 2,
    });
    expect(chatRequest).toHaveBeenLastCalledWith(
      {
        message: "What does the evidence say?",
        history: [],
      },
      { signal: expect.any(AbortSignal) }
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText("Your question")
      )
    );
  });

  it("edits and resubmits after no corpus evidence without dropping the first result", async () => {
    chatRequest
      .mockResolvedValueOnce({
        data: response(
          "no_evidence",
          "no_relevant_corpus_evidence",
          "No passages matched this question.",
          "request-gap"
        ),
      })
      .mockResolvedValueOnce({
        data: {
          ...response(
            "answered",
            "single_study",
            "One admitted study matched the narrower question.",
            "request-next"
          ),
          conversation_id: "conversation-2",
        },
      });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText(/governed Atlas corpus/);
    fireEvent.click(screen.getByRole("button", { name: "Edit question" }));
    const question = screen.getByLabelText("Your question");
    expect(document.activeElement).toBe(question);
    fireEvent.change(question, {
      target: {
        value: "What does reviewed evidence say about Ixodes in Maine?",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText("Evidence: Single-study evidence");
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}");
    expect({
      corpusRemains: screen.getByText(/governed Atlas corpus/).textContent,
      id: stored.conversations[0].id,
      savedConversations: stored.conversations.length,
      turns: stored.conversations[0].turns.length,
    }).toStrictEqual({
      corpusRemains: expect.stringContaining("governed Atlas corpus"),
      id: "conversation-1",
      savedConversations: 1,
      turns: 4,
    });
    expect(chatRequest).toHaveBeenLastCalledWith(
      {
        message: "What does reviewed evidence say about Ixodes in Maine?",
        history: [
          {
            role: "user",
            content: "What does the evidence say?",
          },
          {
            role: "assistant",
            content: "No passages matched this question.",
          },
        ],
      },
      { signal: expect.any(AbortSignal) }
    );
  });

  it("does not render supplied citations for corpus gaps or refusals", async () => {
    const gap = response(
      "no_evidence",
      "no_relevant_corpus_evidence",
      "No passages matched this question."
    );
    gap.citations = [
      {
        citation_id: "c1",
        pmid: "12345",
        title: "A paper",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        claim_ids: ["claim-1"],
        passage_ids: ["passage-1"],
      },
    ];
    chatRequest.mockResolvedValue({ data: gap });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText(/governed Atlas corpus/);
    expect(screen.queryByRole("link", { name: "A paper" })).toBeNull();
    expect(screen.queryByText("A paper")).toBeNull();
  });

  it("hides history chrome until a conversation is saved and confirms clear all", async () => {
    chatRequest.mockResolvedValue({ data: response() });
    render(<EvidenceChat />);
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    expect(
      screen.getByText(/saved in this browser for up to 30 days/)
    ).toBeTruthy();
    await submit();
    await screen.findByText("Evidence: Limited evidence");
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(
      screen.getByRole("heading", { name: "Clear all saved chats?" })
    ).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear all",
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull()
    );
  });

  it("drops a late answer after history is cleared while that request is pending", async () => {
    const held = Promise.withResolvers<unknown>();
    chatRequest.mockResolvedValueOnce({ data: response() });
    chatRequest.mockReturnValueOnce(held.promise);
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Evidence: Limited evidence");
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "A question still in flight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText("Searching reviewed evidence…");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear all",
      })
    );
    await act(async () => {
      held.resolve({
        data: response(
          "answered",
          "limited",
          "Late answer must stay gone.",
          "request-late"
        ),
      });
      await held.promise;
    });
    expect(loadConversations()).toHaveLength(0);
    expect(screen.queryByText("Late answer must stay gone.")).toBeNull();
    expect(screen.queryByText("A question still in flight")).toBeNull();
    expect(screen.queryByText("Evidence: Limited evidence")).toBeNull();
  });

  it("drops a late failure after history is cleared while that request is pending", async () => {
    const held = Promise.withResolvers<unknown>();
    chatRequest.mockResolvedValueOnce({ data: response() });
    chatRequest.mockReturnValueOnce(held.promise);
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Evidence: Limited evidence");
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "A question still in flight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText("Searching reviewed evidence…");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear all",
      })
    );
    await act(async () => {
      held.reject(new Error("Failed to fetch"));
      await held.promise.catch(() => {});
    });
    expect(loadConversations()).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Evidence: Limited evidence")).toBeNull();
  });

  it("hides the empty-state hero when a browser failure is shown", async () => {
    chatRequest.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<EvidenceChat />);
    await submit();
    await screen.findByRole("alert");
    expect(screen.queryByText("Start with a research question")).toBeNull();
    expect(screen.queryByText("Starter questions")).toBeNull();
  });

  it("de-emphasizes the character counter until the limit is near", async () => {
    render(<EvidenceChat />);
    const question = screen.getByLabelText("Your question");
    fireEvent.change(question, { target: { value: "a".repeat(50) } });
    expect(screen.queryByText("50/1,000")).toBeNull();
    fireEvent.change(question, { target: { value: "a".repeat(920) } });
    expect(screen.getByText("920/1,000").className).toContain(
      "chat-char-count-near-limit"
    );
  });

  it("exposes the transcript region as keyboard-focusable", () => {
    render(<EvidenceChat />);
    const transcript = document.querySelector(".chat-transcript");
    expect(transcript?.getAttribute("tabindex")).toBe("0");
    expect(transcript?.getAttribute("role")).toBe("region");
  });

  it("keeps a browser failure distinct from corpus absence and retries once", async () => {
    chatRequest
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({
        data: response(
          "answered",
          "limited",
          "Evidence is available again.",
          "request-up"
        ),
      });
    render(<EvidenceChat />);
    await submit();
    const alert = await screen.findByRole("alert");
    expect({
      corpus: screen.queryByText(/governed Atlas corpus/i),
      message: alert.textContent,
      question: (screen.getByLabelText("Your question") as HTMLTextAreaElement)
        .value,
      state: alert.dataset.assistantState,
    }).toStrictEqual({
      corpus: null,
      message: expect.stringMatching(/could not complete the request/),
      question: "What does the evidence say?",
      state: "network_failure",
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Evidence: Limited evidence");
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}");
    expect({
      alert: screen.queryByRole("alert"),
      conversations: stored.conversations.length,
      turns: stored.conversations[0].turns.length,
    }).toStrictEqual({
      alert: null,
      conversations: 1,
      turns: 2,
    });
  });

  it("shows a recoverable notice for a missing conversation deep link", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    window.history.replaceState({}, "", "/assistant?conversation=missing-id");
    render(<EvidenceChat initialConversationId="missing-id" />);
    await expect(
      screen.findByText("Conversation not found in this browser.")
    ).resolves.toBeTruthy();
    const notice = document.querySelector(
      "[data-assistant-state='conversation_not_found']"
    );
    expect({
      composerEnabled: !(
        screen.getByLabelText("Your question") as HTMLTextAreaElement
      ).disabled,
      noticeVisible: Boolean(notice),
      storageEmpty: localStorage.getItem(CHAT_STORAGE_KEY) === null,
      urlStripped: replaceState.mock.calls.length > 0,
    }).toStrictEqual({
      composerEnabled: true,
      noticeVisible: true,
      storageEmpty: true,
      urlStripped: true,
    });
    fireEvent.click(
      within(notice as HTMLElement).getByRole("button", { name: "New chat" })
    );
    expect({
      notice: screen.queryByText("Conversation not found in this browser."),
      focus: document.activeElement,
    }).toStrictEqual({
      notice: null,
      focus: screen.getByLabelText("Your question"),
    });
  });

  it("uses the same evidence semantics in drawer layout", async () => {
    chatRequest.mockResolvedValue({ data: response() });
    render(<EvidenceChat mode="drawer" />);
    await submit();
    await expect(
      screen.findByText("Evidence: Limited evidence")
    ).resolves.toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open full workspace" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("documents drawer handoff before the first saved answer", () => {
    render(<EvidenceChat mode="drawer" />);
    expect(
      screen.getByText(/Unsent text in this drawer is not carried over/)
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "start in the workspace" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Open full workspace" })
    ).toBeNull();
  });

  it("opens a saved local conversation from a deep link", async () => {
    const future = "2030-01-01T00:00:00.000Z";
    saveConversations([
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: future,
        id: "saved-conversation",
        title: "Saved Lyme question",
        turns: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "turn-user",
            role: "user",
            text: "What is reviewed for deer ticks?",
          },
          storedAnswer(
            "turn-assistant",
            "Reviewed evidence varies by region.",
            "2026-01-01T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(<EvidenceChat initialConversationId="saved-conversation" />);
    await expect(
      screen.findByText("What is reviewed for deer ticks?")
    ).resolves.toBeTruthy();
    expect(
      screen.queryByText("Conversation not found in this browser.")
    ).toBeNull();
    const historySelect = screen.getByRole("button", {
      name: /^Saved Lyme question/,
    });
    expect(historySelect.getAttribute("aria-current")).toBe("true");
  });

  it("names the workspace with one Assistant region tied to the page heading", () => {
    render(<EvidenceChat />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Atlas Assistant",
    });
    expect(heading.id).toBe("atlas-assistant-heading-workspace");
    expect(
      screen.getAllByRole("region", { name: "Atlas Assistant" })
    ).toHaveLength(1);
  });

  it("drawer surface avoids a second Assistant region inside the dialog", () => {
    render(<EvidenceChat mode="drawer" />);
    expect(
      screen.queryByRole("region", { name: "Atlas Assistant" })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "Atlas Assistant" }).id
    ).toBe("atlas-assistant-heading-drawer");
  });

  it("focuses the composer after switching saved conversations", async () => {
    const future = "2030-01-01T00:00:00.000Z";
    saveConversations([
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: future,
        id: "first-conversation",
        title: "First saved question",
        turns: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "turn-user-1",
            role: "user",
            text: "First question",
          },
          storedAnswer(
            "turn-assistant-1",
            "First answer",
            "2026-01-01T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        expiresAt: future,
        id: "second-conversation",
        title: "Second saved question",
        turns: [
          {
            createdAt: "2026-01-02T00:00:00.000Z",
            id: "turn-user-2",
            role: "user",
            text: "Second question",
          },
          storedAnswer(
            "turn-assistant-2",
            "Second answer",
            "2026-01-02T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    render(<EvidenceChat initialConversationId="first-conversation" />);
    await screen.findByText("First question");
    fireEvent.click(
      screen.getByRole("button", { name: /^Second saved question/ })
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText("Your question")
      )
    );
    expect(screen.getByText("Second question")).toBeTruthy();
  });

  it("re-scrolls when a same-length conversation becomes active", async () => {
    const future = "2030-01-01T00:00:00.000Z";
    saveConversations([
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        expiresAt: future,
        id: "second-conversation",
        title: "Second saved question",
        turns: [
          {
            createdAt: "2026-01-02T00:00:00.000Z",
            id: "turn-user-2",
            role: "user",
            text: "Second question",
          },
          storedAnswer(
            "turn-assistant-2",
            "Second answer",
            "2026-01-02T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: future,
        id: "first-conversation",
        title: "First saved question",
        turns: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "turn-user-1",
            role: "user",
            text: "First question",
          },
          storedAnswer(
            "turn-assistant-1",
            "First answer",
            "2026-01-01T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(<EvidenceChat initialConversationId="first-conversation" />);
    await screen.findByText("First question");
    const scrolledConversation = () => {
      const transcript = document.querySelector(".chat-transcript");
      return transcript instanceof HTMLElement
        ? transcript.dataset.scrolledConversation
        : undefined;
    };
    expect(scrolledConversation()).toBe("first-conversation");
    fireEvent.click(
      screen.getByRole("button", { name: /^Second saved question/ })
    );
    await waitFor(() => {
      expect(scrolledConversation()).toBe("second-conversation");
    });
    expect(document.querySelector(".chat-transcript")?.textContent).toContain(
      "Second answer"
    );
  });

  it("moves focus to retry after a browser failure", async () => {
    chatRequest.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<EvidenceChat />);
    await submit();
    const retry = await screen.findByRole("button", { name: "Retry" });
    await waitFor(() => expect(document.activeElement).toBe(retry));
  });

  it("discards an in-flight answer after New chat so a later answer is not overwritten", async () => {
    const { promise: firstRequest, resolve: resolveFirst } =
      Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(firstRequest);
    chatRequest.mockImplementationOnce(async () => ({
      data: response(
        "answered",
        "limited",
        "Second answer stays.",
        "request-2"
      ),
    }));
    render(<EvidenceChat />);
    await submit();
    await expect(
      screen.findByText("Searching reviewed evidence…")
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "A later question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await expect(
      screen.findByText("Second answer stays.")
    ).resolves.toBeTruthy();
    resolveFirst({
      data: response(
        "answered",
        "limited",
        "First answer must not appear.",
        "request-1"
      ),
    });
    await waitFor(() => {
      expect(screen.queryByText("First answer must not appear.")).toBeNull();
    });
    expect(
      within(
        screen.getByRole("region", { name: "Conversation transcript" })
      ).getByText("Second answer stays.")
    ).toBeTruthy();
  });

  it("renders an HTTP 200 evidence_unavailable outcome with retry and the saved question", async () => {
    const track = vi.spyOn(atlasAnalytics, "track");
    const answer = "The evidence service did not complete this request.";
    try {
      chatRequest.mockResolvedValue({
        data: response(
          "evidence_unavailable",
          "evidence_unavailable",
          answer,
          "request-down"
        ),
        status: 200,
      });
      render(<EvidenceChat />);
      await submit();
      await screen.findByText("Evidence service unavailable.");
      const question = screen.getByLabelText(
        "Your question"
      ) as HTMLTextAreaElement;
      await waitFor(() => expect(document.activeElement).toBe(question));
      const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}");
      const retry = screen.getByRole("button", { name: "Retry" });
      expect({
        alert: screen.queryByRole("alert"),
        answer: screen.getByText(answer).textContent,
        composer: question.value,
        corpus: screen.queryByText(
          "No relevant literature in the Atlas corpus."
        ),
        denial: screen.getByText(/not a finding that the Atlas corpus/)
          .textContent,
        live: document
          .querySelector(".chat-transcript")
          ?.getAttribute("aria-live"),
        retryControl: retry.dataset.atlasAnalyticsControl,
        starters: screen.queryByText("Starter questions"),
        state: document.querySelector<HTMLElement>(
          "[data-assistant-state='evidence_unavailable']"
        )?.dataset.assistantState,
        timedOut: screen.queryByText(/Request timed out/),
        turns: stored.conversations[0].turns.map(
          (turn: {
            id: string;
            response?: { status?: string };
            role: string;
            text: string;
          }) => ({
            id: turn.id,
            responseStatus: turn.response?.status ?? null,
            role: turn.role,
            text: turn.text,
          })
        ),
      }).toStrictEqual({
        alert: null,
        answer,
        composer: "What does the evidence say?",
        corpus: null,
        denial: expect.stringContaining(
          "not a finding that the Atlas corpus has no relevant literature"
        ),
        live: "polite",
        retryControl: "evidence_chat_retry",
        starters: null,
        state: "evidence_unavailable",
        timedOut: null,
        turns: [
          {
            id: "request-down:user",
            responseStatus: null,
            role: "user",
            text: "What does the evidence say?",
          },
          {
            id: "request-down",
            responseStatus: "evidence_unavailable",
            role: "assistant",
            text: answer,
          },
        ],
      });
      expect(localStorage.getItem(CHAT_STORAGE_KEY)).not.toContain(
        "browser-secret"
      );
      // Only closed enums leave the page: no question text, answer, or ids.
      expect(track.mock.calls).toStrictEqual([
        [
          {
            eventType: "atlas_ask_submitted",
            properties: { ask_surface: "ask_atlas" },
          },
        ],
        [
          {
            eventType: "atlas_ask_answered",
            properties: {
              ask_outcome: "unavailable",
              ask_surface: "ask_atlas",
            },
          },
        ],
      ]);
    } finally {
      track.mockRestore();
    }
  });

  it("renders the same evidence_unavailable outcome when HTTP 200 includes Retry-After", async () => {
    chatRequest.mockResolvedValue({
      data: response(
        "evidence_unavailable",
        "evidence_unavailable",
        "The evidence service did not complete this request.",
        "request-down"
      ),
      headers: new Headers({ "Retry-After": "30" }),
      status: 200,
    });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Evidence service unavailable.");
    const panel = document.querySelector<HTMLElement>(
      "[data-assistant-state='evidence_unavailable']"
    );
    expect({
      composer: (screen.getByLabelText("Your question") as HTMLTextAreaElement)
        .value,
      copy: panel?.textContent,
      retry: screen.getByRole("button", { name: "Retry" }).textContent,
      state: panel?.dataset.assistantState,
      timedOut: screen.queryByText(/Request timed out/),
    }).toStrictEqual({
      composer: "What does the evidence say?",
      copy: "Evidence service unavailable. The evidence service could not complete this request. This is not a finding that the Atlas corpus has no relevant literature.Retry",
      retry: "Retry",
      state: "evidence_unavailable",
      timedOut: null,
    });
  });

  it("renders an HTTP 200 capacity_limited outcome with retry later", async () => {
    const answer = "The assistant is at capacity. Please retry.";
    chatRequest.mockResolvedValue({
      data: response(
        "capacity_limited",
        "not_applicable",
        answer,
        "request-busy"
      ),
      status: 200,
    });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText(answer);
    expect({
      alert: screen.queryByRole("alert"),
      composer: (screen.getByLabelText("Your question") as HTMLTextAreaElement)
        .value,
      corpus: screen.queryByText("No relevant literature in the Atlas corpus."),
      evidence: screen.queryByText(/Evidence:/),
      retryLater: screen.getByRole("button", { name: "Retry later" })
        .textContent,
      state: document.querySelector<HTMLElement>(
        "[data-assistant-state='capacity_limited']"
      )?.dataset.assistantState,
      timedOut: screen.queryByText(/Request timed out/),
    }).toStrictEqual({
      alert: null,
      composer: "What does the evidence say?",
      corpus: null,
      evidence: null,
      retryLater: "Retry later",
      state: "capacity_limited",
      timedOut: null,
    });
  });

  it("replaces an HTTP 200 operational turn when retry succeeds", async () => {
    chatRequest
      .mockResolvedValueOnce({
        data: response(
          "evidence_unavailable",
          "evidence_unavailable",
          "The evidence service did not complete this request.",
          "request-down"
        ),
        status: 200,
      })
      .mockResolvedValueOnce({
        data: response(
          "answered",
          "limited",
          "Evidence is available again.",
          "request-up"
        ),
        status: 200,
      });
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Evidence service unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Evidence: Limited evidence");
    const stored = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}");
    expect({
      removedFailure: screen.queryByText("Evidence service unavailable."),
      removedAnswer: screen.queryByText(
        "The evidence service did not complete this request."
      ),
      turns: stored.conversations[0].turns.map(
        (turn: {
          response?: { status?: string };
          role: string;
          text: string;
        }) => ({
          responseStatus: turn.response?.status ?? null,
          role: turn.role,
          text: turn.text,
        })
      ),
    }).toStrictEqual({
      removedFailure: null,
      removedAnswer: null,
      turns: [
        {
          responseStatus: null,
          role: "user",
          text: "What does the evidence say?",
        },
        {
          responseStatus: "answered",
          role: "assistant",
          text: "Evidence is available again.",
        },
      ],
    });
    expect(chatRequest).toHaveBeenLastCalledWith(
      {
        history: [],
        message: "What does the evidence say?",
      },
      { signal: expect.any(AbortSignal) }
    );
  });

  it("keeps a typed 502 body on the evidence-unavailable outcome", async () => {
    chatRequest.mockRejectedValue(
      new AtlasApiError(
        "bad gateway",
        "/v1/knowledge-graph/chat",
        502,
        null,
        null,
        response(
          "evidence_unavailable",
          "evidence_unavailable",
          "The evidence service did not complete this request."
        )
      )
    );
    render(<EvidenceChat />);
    await submit();
    await screen.findByText("Evidence service unavailable.");
    expect({
      alert: screen.queryByRole("alert"),
      state: document.querySelector<HTMLElement>(
        "[data-assistant-state='evidence_unavailable']"
      )?.dataset.assistantState,
      timedOut: screen.queryByText(/Request timed out/),
    }).toStrictEqual({
      alert: null,
      state: "evidence_unavailable",
      timedOut: null,
    });
  });

  it("hides the searching status until the wait is long enough to announce", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const held = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValue(held.promise);
    render(<EvidenceChat />);
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "What does the evidence say?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const question = screen.getByLabelText(
      "Your question"
    ) as HTMLTextAreaElement;
    expect({
      askBusy: screen
        .getByRole("button", { name: "Ask" })
        .getAttribute("aria-busy"),
      disabled: question.disabled,
      searching: screen.queryByText("Searching reviewed evidence…"),
    }).toStrictEqual({
      askBusy: "true",
      disabled: true,
      searching: null,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_PENDING_STATUS_DELAY_MS - 1);
    });
    expect(screen.queryByText("Searching reviewed evidence…")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const searching = screen.getByText("Searching reviewed evidence…");
    expect({
      atomic: searching.getAttribute("aria-atomic"),
      className: searching.className,
      live: searching.getAttribute("aria-live"),
      role: searching.getAttribute("role"),
    }).toStrictEqual({
      atomic: "true",
      className: "processing",
      live: "polite",
      role: "status",
    });
    await act(async () => {
      held.resolve({ data: response() });
    });
    expect({
      answer: screen.getByText("Evidence: Limited evidence").textContent,
      searching: screen.queryByText("Searching reviewed evidence…"),
    }).toStrictEqual({
      answer: "Evidence: Limited evidence",
      searching: null,
    });
  });

  it("keeps a fast answer from flashing the searching status", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const held = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValue(held.promise);
    render(<EvidenceChat />);
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "What does the evidence say?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(
      (screen.getByLabelText("Your question") as HTMLTextAreaElement).disabled
    ).toBeTruthy();
    await act(async () => {
      held.resolve({ data: response() });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_PENDING_STATUS_DELAY_MS);
    });
    expect({
      answer: screen.getByText("Evidence: Limited evidence").textContent,
      disabled: (screen.getByLabelText("Your question") as HTMLTextAreaElement)
        .disabled,
      searching: screen.queryByText("Searching reviewed evidence…"),
    }).toStrictEqual({
      answer: "Evidence: Limited evidence",
      disabled: false,
      searching: null,
    });
  });

  it("ends a stalled request at the client deadline and ignores a late answer", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const held = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValue(held.promise);
    render(<EvidenceChat />);
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "What does the evidence say?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_CLIENT_DEADLINE_MS);
    });
    const timeout = screen.getByRole("alert");
    const question = screen.getByLabelText(
      "Your question"
    ) as HTMLTextAreaElement;
    expect({
      message: timeout.textContent,
      question: question.value,
      retry: screen.getByRole("button", { name: "Retry" }).textContent,
      searching: screen.queryByText("Searching reviewed evidence…"),
      state: timeout.dataset.assistantState,
      stored: loadConversations(),
      title: timeout.querySelector("strong")?.textContent,
    }).toStrictEqual({
      message: expect.stringContaining(
        "The assistant did not answer before the request timed out. This is not a finding that the Atlas corpus lacks relevant literature."
      ),
      question: "What does the evidence say?",
      retry: "Retry",
      searching: null,
      state: "timeout",
      stored: [],
      title: "Request timed out.",
    });
    await act(async () => {
      held.resolve({
        data: response(
          "answered",
          "limited",
          "Late answer must stay gone.",
          "request-late"
        ),
      });
    });
    expect({
      focus: document.activeElement,
      late: screen.queryByText("Late answer must stay gone."),
      question: question.value,
      state: screen.getByRole("alert").dataset.assistantState,
      stored: loadConversations().length,
    }).toStrictEqual({
      focus: screen.getByRole("button", { name: "Retry" }),
      late: null,
      question: "What does the evidence say?",
      state: "timeout",
      stored: 0,
    });
  });

  it("does not show a timeout when New chat, another conversation, or unmount cancels the request", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    chatRequest.mockReturnValue(Promise.withResolvers<unknown>().promise);
    const future = "2030-01-01T00:00:00.000Z";
    saveConversations([
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        expiresAt: future,
        id: "second-conversation",
        title: "Second saved question",
        turns: [
          {
            createdAt: "2026-01-02T00:00:00.000Z",
            id: "turn-user-2",
            role: "user",
            text: "Second question",
          },
          storedAnswer(
            "turn-assistant-2",
            "Second answer",
            "2026-01-02T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: future,
        id: "first-conversation",
        title: "First saved question",
        turns: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "turn-user-1",
            role: "user",
            text: "First question",
          },
          storedAnswer(
            "turn-assistant-1",
            "First answer",
            "2026-01-01T00:00:00.000Z"
          ),
        ],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const view = render(
      <EvidenceChat initialConversationId="first-conversation" />
    );
    screen.getByText("First question");
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "A question still in flight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_PENDING_STATUS_DELAY_MS);
    });
    expect(screen.getByText("Searching reviewed evidence…").className).toBe(
      "processing"
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /Second saved question/ })[0]
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_CLIENT_DEADLINE_MS);
    });
    expect({
      answer: screen.getByText("Second answer").textContent,
      searching: screen.queryByText("Searching reviewed evidence…"),
      timeout: screen.queryByText("Request timed out."),
    }).toStrictEqual({
      answer: "Second answer",
      searching: null,
      timeout: null,
    });

    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "Another question still in flight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_CLIENT_DEADLINE_MS);
    });
    expect({
      searching: screen.queryByText("Searching reviewed evidence…"),
      timeout: screen.queryByText("Request timed out."),
    }).toStrictEqual({
      searching: null,
      timeout: null,
    });

    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "A question abandoned on unmount" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASK_ATLAS_CLIENT_DEADLINE_MS);
    });
    expect(screen.queryByText("Request timed out.")).toBeNull();
  });

  it("keeps a bare 504 on the timeout state", async () => {
    chatRequest.mockRejectedValue(
      new AtlasApiError("timeout", "/v1/knowledge-graph/chat", 504, null)
    );
    render(<EvidenceChat />);
    await submit();
    const timeout = await screen.findByRole("alert");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Retry" })
      )
    );
    expect({
      message: timeout.textContent,
      state: timeout.dataset.assistantState,
      title: timeout.querySelector("strong")?.textContent,
    }).toStrictEqual({
      message: expect.stringContaining(
        "The assistant did not answer before the request timed out. This is not a finding that the Atlas corpus lacks relevant literature."
      ),
      state: "timeout",
      title: "Request timed out.",
    });
  });

  it("keeps 429 and 422 on their current states and copy", async () => {
    chatRequest.mockRejectedValueOnce(
      new AtlasApiError("busy", "/v1/knowledge-graph/chat", 429, null)
    );
    const { unmount } = render(<EvidenceChat />);
    await submit();
    const rate = await screen.findByRole("alert");
    expect({
      retry: screen.getByRole("button", { name: "Retry" }).textContent,
      state: rate.dataset.assistantState,
      text: rate.textContent,
    }).toStrictEqual({
      retry: "Retry",
      state: "rate_limited",
      text: "Assistant is busy. The assistant is busy and did not finish this request. Please try again shortly.Retry",
    });
    unmount();
    chatRequest.mockRejectedValueOnce(
      new AtlasApiError("invalid", "/v1/knowledge-graph/chat", 422, null)
    );
    render(<EvidenceChat />);
    await submit();
    const invalid = await screen.findByRole("alert");
    expect({
      retry: screen.queryByRole("button", { name: "Retry" }),
      state: invalid.dataset.assistantState,
      text: invalid.textContent,
    }).toStrictEqual({
      retry: null,
      state: "request_not_processed",
      text: "Question not processed. That question could not be processed. Please revise it and try again.",
    });
  });

  it("describes near-limit character counts without a second live region", async () => {
    render(<EvidenceChat />);
    const question = screen.getByLabelText("Your question");
    fireEvent.change(question, { target: { value: "a".repeat(920) } });
    const counter = screen.getByText("920/1,000");
    expect(counter.getAttribute("aria-live")).toBeNull();
    expect(question.getAttribute("aria-describedby")).toBe(
      "chat-char-count-workspace"
    );
  });
});
