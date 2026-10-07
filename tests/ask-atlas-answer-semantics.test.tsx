import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/assistant",
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

const MODES = ["workspace", "drawer"] as const;

function literaturePayload(
  answer = "Reviewed studies describe exposure.",
  requestId = "request-1"
) {
  return {
    answer,
    assistant_policy_version: "policy-v1",
    citations: [
      {
        citation_id: "c1",
        claim_ids: ["claim-1"],
        passage_ids: ["passage-1"],
        pmid: "12345",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        source_label: "Reported corpus",
        title: "Source paper",
      },
    ],
    claims: [
      {
        citation_ids: ["c1"],
        claim_id: "claim-1",
        text: answer,
      },
    ],
    configuration_version: "config-v1",
    conversation_id: "conversation-1",
    conversation_token: "browser-secret",
    evidence_state: "limited",
    request_id: requestId,
    source_used: "literature_evidence",
    status: "answered",
  };
}

async function ask(question = "What does the evidence say?") {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe.each(MODES)("Ask Atlas answer semantics (%s)", (mode) => {
  beforeEach(() => {
    localStorage.clear();
    chatRequest.mockReset();
    window.history.replaceState(
      {},
      "",
      "/app/explore?county=08001&metric=reported-cases&scope=ALL"
    );
  });
  afterEach(() => cleanup());

  it("renders literature citations and source from the response", async () => {
    chatRequest.mockResolvedValue({ data: literaturePayload() });
    render(<EvidenceChat mode={mode} />);
    await ask();
    await expect(
      screen.findByText("Source: Literature evidence")
    ).resolves.toBeTruthy();
    const sources = document.querySelector<HTMLElement>(".chat-answer-sources");
    expect({
      confidence: screen.queryByText(/0\.92|confidence/i),
      evidence: screen.getByText("Evidence: Limited evidence").textContent,
      href: screen
        .getByRole("link", { name: /Source paper/i })
        .getAttribute("href"),
      label: screen.getByText(/Reported corpus/).textContent,
      source: sources?.dataset.sourceUsed,
      structured: screen.queryByRole("button", { name: /structured/i }),
    }).toStrictEqual({
      confidence: null,
      evidence: "Evidence: Limited evidence",
      href: "https://pubmed.ncbi.nlm.nih.gov/12345/",
      label: expect.stringContaining("Reported corpus"),
      source: "literature_evidence",
      structured: null,
    });
    expect(localStorage.getItem(CHAT_STORAGE_KEY)).not.toContain(
      "browser-secret"
    );
  });

  it("shows insufficient comparison evidence without a service-failure alert", async () => {
    chatRequest.mockResolvedValue({
      data: {
        ...literaturePayload("The sources cannot be compared."),
        evidence_state: "insufficient_to_compare",
      },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    await screen.findByText("Evidence: Insufficient evidence to compare");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Evidence service unavailable/)).toBeNull();
    expect(screen.queryByText(/Request timed out/)).toBeNull();
  });

  it("shows corpus absence separately from transport failure", async () => {
    chatRequest.mockResolvedValue({
      data: {
        ...literaturePayload("No passages matched this question."),
        citations: [],
        claims: [],
        evidence_state: "no_relevant_corpus_evidence",
        status: "no_evidence",
      },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    await screen.findByText(/governed corpus for this question/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Source: Literature evidence")).toBeNull();
    expect(screen.queryByText("Source paper")).toBeNull();
  });

  it("shows a refusal without citations or a retry", async () => {
    chatRequest.mockResolvedValue({
      data: {
        ...literaturePayload("I cannot give individual medical advice."),
        citations: [
          {
            citation_id: "c1",
            claim_ids: ["claim-1"],
            passage_ids: ["passage-1"],
            pmid: "12345",
            pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
            title: "Source paper",
          },
        ],
        evidence_state: "not_applicable",
        status: "safety_refusal",
      },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    await screen.findByText("I cannot give individual medical advice.");
    expect(
      document.querySelector("[data-assistant-state='safety_refusal']")
    ).toBeTruthy();
    expect(screen.queryByText("Source paper")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("fails closed when the citation is missing", async () => {
    chatRequest.mockResolvedValue({
      data: {
        ...literaturePayload("This answer has no citation."),
        citations: [],
        claims: [],
      },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    const alert = await screen.findByRole("alert");
    expect(alert.dataset.assistantState).toBe("response_unverified");
    expect(alert.dataset.closeReason).toBe("missing_citation");
    expect(screen.queryByText("This answer has no citation.")).toBeNull();
    expect(screen.queryByText("Reviewed literature source")).toBeNull();
    expect(screen.queryByText(/Insufficient evidence/)).toBeNull();
  });

  it("fails closed when the cited source does not match the claim", async () => {
    const payload = literaturePayload("Mismatched source answer.");
    payload.citations[0].claim_ids = ["other-claim"];
    chatRequest.mockResolvedValue({ data: payload });
    render(<EvidenceChat mode={mode} />);
    await ask();
    const alert = await screen.findByRole("alert");
    expect(alert.dataset.closeReason).toBe("mismatched_source");
    expect(screen.queryByText("Mismatched source answer.")).toBeNull();
    expect(screen.queryByText("Source paper")).toBeNull();
  });

  it("fails closed when the answer text is not the claim text", async () => {
    const payload = literaturePayload("Reviewed studies describe exposure.");
    payload.answer = "An uncited conclusion.";
    chatRequest.mockResolvedValue({ data: payload });
    render(<EvidenceChat mode={mode} />);
    await ask();
    const alert = await screen.findByRole("alert");
    expect({
      answer: screen.queryByText("An uncited conclusion."),
      claim: screen.queryByText("Reviewed studies describe exposure."),
      reason: alert.dataset.closeReason,
      source: screen.queryByText("Source paper"),
    }).toStrictEqual({
      answer: null,
      claim: null,
      reason: "partial",
      source: null,
    });
  });

  it("does not hydrate a rejected stored answer or send it in the next request", async () => {
    const cited = literaturePayload("A cited answer.", "request-cited");
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        conversations: [
          {
            createdAt: "2026-08-25T00:00:00.000Z",
            expiresAt: "2099-01-01T00:00:00.000Z",
            id: "conversation-1",
            title: "Stored",
            turns: [
              {
                createdAt: "2026-08-25T00:00:00.000Z",
                id: "user-rejected",
                role: "user",
                text: "Rejected question",
              },
              {
                createdAt: "2026-08-25T00:00:00.000Z",
                id: "assistant-rejected",
                response: { answer: "Partial only", status: "answered" },
                role: "assistant",
                text: "Partial only",
              },
              {
                createdAt: "2026-08-25T00:00:01.000Z",
                id: "user-cited",
                role: "user",
                text: "Cited question",
              },
              {
                createdAt: "2026-08-25T00:00:01.000Z",
                id: "assistant-cited",
                response: cited,
                role: "assistant",
                text: "An uncited conclusion.",
              },
            ],
            updatedAt: "2026-08-25T00:00:01.000Z",
          },
        ],
        version: 1,
      })
    );
    chatRequest.mockResolvedValue({
      data: literaturePayload("Follow-up answer.", "request-next"),
    });
    render(<EvidenceChat mode={mode} />);
    await screen.findByText("A cited answer.");
    expect({
      divergent: screen.queryByText("An uncited conclusion."),
      partial: screen.queryByText("Partial only"),
      rejectedQuestion: screen.queryByText("Rejected question"),
    }).toStrictEqual({
      divergent: null,
      partial: null,
      rejectedQuestion: null,
    });
    await ask("Follow-up question");
    await screen.findByText("Follow-up answer.");
    expect(chatRequest).toHaveBeenCalledWith(
      {
        history: [
          { content: "Cited question", role: "user" },
          { content: "A cited answer.", role: "assistant" },
        ],
        message: "Follow-up question",
      },
      { signal: expect.any(AbortSignal) }
    );
  });

  it("fails closed for a malformed or partial response", async () => {
    chatRequest.mockResolvedValue({
      data: { answer: "Partial only", status: "answered" },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    const alert = await screen.findByRole("alert");
    expect(alert.dataset.closeReason).toBe("malformed");
    expect(screen.queryByText("Partial only")).toBeNull();
  });

  it("does not present deferred comparison states as shipped", async () => {
    chatRequest.mockResolvedValue({
      data: {
        ...literaturePayload("These sources are aligned."),
        cross_source_state: "aligned",
        evidence_state: "aligned",
      },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    const alert = await screen.findByRole("alert");
    expect({
      aligned: screen.queryByText(/aligned/i),
      answer: screen.queryByText("These sources are aligned."),
      discordant: screen.queryByText(/discordant/i),
      partial: screen.queryByText(/partially aligned/i),
      reason: alert.dataset.closeReason,
    }).toStrictEqual({
      aligned: null,
      answer: null,
      discordant: null,
      partial: null,
      reason: "unsupported_comparison",
    });
  });

  it("does not present Structured or Both as an answer source", async () => {
    chatRequest.mockResolvedValue({
      data: {
        ...literaturePayload("Structured and literature both answered."),
        actual_sources_used: ["structured_atlas", "literature_evidence"],
        requested_source_mode: "Both",
      },
    });
    render(<EvidenceChat mode={mode} />);
    await ask();
    const alert = await screen.findByRole("alert");
    expect({
      both: screen.queryByText("Source: Both"),
      mode: screen.queryByRole("button", { name: /structured|both/i }),
      reason: alert.dataset.closeReason,
      structured: screen.queryByText("Source: Structured"),
    }).toStrictEqual({
      both: null,
      mode: null,
      reason: "unsupported_source",
      structured: null,
    });
  });

  it("shows a timeout separately from insufficient evidence", async () => {
    chatRequest.mockRejectedValueOnce(
      new AtlasApiError("timeout", "/v1/knowledge-graph/chat", 504, null)
    );
    render(<EvidenceChat mode={mode} />);
    await ask();
    const timeout = await screen.findByRole("alert");
    expect({
      corpus: screen.queryByText(/governed corpus/),
      insufficient: timeout.textContent?.includes("Insufficient") ?? false,
      state: timeout.dataset.assistantState,
      timedOut: timeout.textContent?.includes("timed out") ?? false,
    }).toStrictEqual({
      corpus: null,
      insufficient: false,
      state: "timeout",
      timedOut: true,
    });
  });

  it("shows a rate limit separately from insufficient evidence", async () => {
    chatRequest.mockRejectedValueOnce(
      new AtlasApiError("busy", "/v1/knowledge-graph/chat", 429, null)
    );
    render(<EvidenceChat mode={mode} />);
    await ask();
    const rate = await screen.findByRole("alert");
    expect({
      insufficient: screen.queryByText(/Insufficient evidence/),
      state: rate.dataset.assistantState,
    }).toStrictEqual({
      insufficient: null,
      state: "rate_limited",
    });
  });

  it("shows capacity separately from insufficient evidence and transport alerts", async () => {
    chatRequest.mockRejectedValueOnce(
      new AtlasApiError("busy", "/v1/knowledge-graph/chat", 503, null, null, {
        ...literaturePayload("The assistant is at capacity."),
        citations: [],
        claims: [],
        evidence_state: "not_applicable",
        status: "capacity_limited",
      })
    );
    render(<EvidenceChat mode={mode} />);
    await ask();
    await screen.findByText("Temporarily at capacity.");
    expect({
      alert: screen.queryByRole("alert"),
      capacity: document.querySelector(
        "[data-assistant-state='capacity_limited']"
      ),
      insufficient: screen.queryByText(/Insufficient evidence/),
    }).toStrictEqual({
      alert: null,
      capacity: expect.any(Element),
      insufficient: null,
    });
  });

  it("drops an older answer that resolves after a newer one", async () => {
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    chatRequest.mockReturnValueOnce(first.promise);
    chatRequest.mockReturnValueOnce(second.promise);
    render(<EvidenceChat mode={mode} />);
    await ask("First question");
    await screen.findByText("Searching reviewed evidence…");
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await ask("Second question");
    second.resolve({
      data: literaturePayload("Second answer stays.", "request-2"),
    });
    await screen.findByText("Second answer stays.");
    first.resolve({
      data: literaturePayload("First answer must not appear.", "request-1"),
    });
    await waitFor(() => {
      expect(screen.queryByText("First answer must not appear.")).toBeNull();
    });
    expect(screen.getByText("Second answer stays.")).toBeTruthy();
    expect(screen.queryByText("Searching reviewed evidence…")).toBeNull();
  });

  it("does not change county, metric, or scope when an answer arrives", async () => {
    const href =
      mode === "workspace"
        ? "/app/assistant?county=08001&dataset=alpha-2026&metric=reported-cases&scope=ALL"
        : "/app/explore?county=08001&metric=reported-cases&scope=ALL";
    window.history.replaceState({}, "", href);
    chatRequest.mockResolvedValue({ data: literaturePayload() });
    render(<EvidenceChat mode={mode} />);
    await ask();
    await screen.findByText("Source: Literature evidence");
    const url = new URL(window.location.href);
    expect({
      conversation: url.searchParams.get("conversation"),
      county: url.searchParams.get("county"),
      dataset: url.searchParams.get("dataset"),
      metric: url.searchParams.get("metric"),
      pathname: url.pathname,
      request: chatRequest.mock.calls[0]?.[0],
      scope: url.searchParams.get("scope"),
    }).toStrictEqual({
      conversation: mode === "workspace" ? "conversation-1" : null,
      county: "08001",
      dataset: mode === "workspace" ? "alpha-2026" : null,
      metric: "reported-cases",
      pathname: mode === "workspace" ? "/app/assistant" : "/app/explore",
      request: {
        history: [],
        message: "What does the evidence say?",
      },
      scope: "ALL",
    });
  });
});
