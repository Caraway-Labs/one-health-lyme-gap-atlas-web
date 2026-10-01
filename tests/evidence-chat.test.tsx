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
  knowledgeGraphChatV1KnowledgeGraphChatPost: chatRequest as never,
}));

import { EvidenceChat } from "../src/components/evidence-chat";
import { AtlasApiError } from "../src/lib/api-mutator";
import { CHAT_STORAGE_KEY } from "../src/lib/knowledge-chat-storage";

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
  afterEach(() => cleanup());

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
      screen.queryByText("No relevant literature in the Atlas corpus.")
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
      corpus: screen.getByText(/governed corpus for this question/).textContent,
      elsewhere: screen.queryByText(
        /does not mean no scientific evidence exists elsewhere/
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
      corpus: expect.stringContaining("governed corpus for this question"),
      elsewhere: expect.stringContaining(
        "does not mean no scientific evidence exists elsewhere"
      ),
      evidenceDetails: null,
      helpHref: "/docs/ai-enabled-decision-intelligence",
      pubmed: null,
      source: null,
    });
  });

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
    await screen.findByText(/governed corpus for this question/);
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
      corpus: screen.queryByText(/governed corpus/i),
      evidenceDetails: screen.queryByLabelText("Evidence details"),
      literature: screen.queryByText(
        "No relevant literature in the Atlas corpus."
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
    expect(chatRequest).toHaveBeenLastCalledWith({
      message: "What does the evidence say?",
      history: [],
    });
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
    await screen.findByText(/governed corpus for this question/);
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
      corpusRemains: screen.getByText(/governed corpus for this question/)
        .textContent,
      id: stored.conversations[0].id,
      savedConversations: stored.conversations.length,
      turns: stored.conversations[0].turns.length,
    }).toStrictEqual({
      corpusRemains: expect.stringContaining("governed corpus"),
      id: "conversation-1",
      savedConversations: 1,
      turns: 4,
    });
    expect(chatRequest).toHaveBeenLastCalledWith({
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
    });
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
    await screen.findByText(/governed corpus for this question/);
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
      corpus: screen.queryByText(/governed corpus/i),
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
});
