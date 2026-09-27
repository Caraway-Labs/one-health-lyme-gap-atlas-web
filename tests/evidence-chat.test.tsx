import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  answer = "Evidence varies by study setting."
) {
  return {
    request_id: "request-1",
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
    const link = screen.getByRole("link", { name: "A paper" });
    expect(link.getAttribute("href")).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/12345/"
    );
    expect(localStorage.getItem(CHAT_STORAGE_KEY)).not.toContain(
      "browser-secret"
    );
    expect(chatRequest).toHaveBeenCalledWith({
      message: "What does the evidence say?",
      history: [],
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
    expect(screen.getByRole("button", { name: "Retry question" })).toBeTruthy();
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
    await expect(
      screen.findByText("No passages matched this question.")
    ).resolves.toBeTruthy();
    expect(
      screen.getByText(
        "No relevant Atlas corpus evidence. Other scientific evidence may exist."
      )
    ).toBeTruthy();
    expect(screen.queryByLabelText("Evidence details")).toBeNull();
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
    await expect(
      screen.findByText("I cannot give individual medical advice.")
    ).resolves.toBeTruthy();
    expect(screen.queryByText(/Evidence state not applicable/)).toBeNull();
    expect(screen.queryByLabelText("Evidence details")).toBeNull();
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
    await expect(
      screen.findByText("The assistant is at capacity. Please retry.")
    ).resolves.toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry question" })).toBeTruthy();
    expect(screen.queryByLabelText("Evidence details")).toBeNull();
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
});
