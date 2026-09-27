"use client";

import publicCopy from "@caraway-labs/one-health-lyme-gap-atlas-knowledge-graph/public-copy";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { knowledgeGraphChatV1KnowledgeGraphChatPost } from "@/generated/atlas";
import type { KnowledgeChatResponse } from "@/generated/models";
import { KnowledgeGraphChatV1KnowledgeGraphChatPostResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";
import {
  CHAT_STORAGE_EVENT,
  clearConversations,
  conversationHistory,
  createConversation,
  loadConversations,
  removeConversation,
  saveConversations,
} from "@/lib/knowledge-chat-storage";

const evidenceLabels: Record<KnowledgeChatResponse["evidence_state"], string> =
  {
    single_study: "Single study",
    consistent: "Consistent evidence",
    limited: "Limited evidence",
    mixed: "Mixed evidence",
    conflicting: "Conflicting evidence",
    insufficient_to_compare: "Insufficient to compare",
    no_relevant_corpus_evidence: "No relevant corpus evidence",
    evidence_unavailable: "Evidence unavailable",
    not_applicable: "Evidence state not applicable",
  };

function safePubMedUrl(url: string, pmid: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "pubmed.ncbi.nlm.nih.gov" &&
      (parsed.pathname === `/${pmid}/` || parsed.pathname === `/${pmid}`) &&
      !parsed.search &&
      !parsed.hash
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function EvidenceChat({
  mode = "workspace",
  initialConversationId,
}: {
  mode?: "drawer" | "workspace";
  initialConversationId?: string;
}) {
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeId, setActiveId] = useState(
    initialConversationId ?? "__latest__"
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retryQuestion, setRetryQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const refresh = () => setConversations(loadConversations());
    refresh();
    window.addEventListener(CHAT_STORAGE_EVENT, refresh);
    return () => window.removeEventListener(CHAT_STORAGE_EVENT, refresh);
  }, []);

  const active =
    activeId === "__new__"
      ? undefined
      : (conversations.find((item) => item.id === activeId) ??
        conversations[0]);

  async function ask(question: string) {
    if (!question || pending) {
      return;
    }
    setPending(true);
    setError("");
    try {
      const isRetryOfUnavailable =
        retryQuestion === question &&
        ["evidence_unavailable", "capacity_limited"].includes(
          active?.turns.at(-1)?.response?.status ?? ""
        );
      const result = await knowledgeGraphChatV1KnowledgeGraphChatPost({
        message: question,
        history: conversationHistory(
          isRetryOfUnavailable && active
            ? { ...active, turns: active.turns.slice(0, -2) }
            : active
        ),
      });
      const response = validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        result.data
      );
      const safeResponse = { ...response, conversation_token: undefined };
      saveResponse(question, safeResponse);
      setMessage("");
      setRetryQuestion("");
    } catch (error) {
      setRetryQuestion(question);
      if (error instanceof AtlasApiError) {
        const parsed =
          KnowledgeGraphChatV1KnowledgeGraphChatPostResponse.safeParse(
            error.responseBody
          );
        if (parsed.success) {
          const response = { ...parsed.data, conversation_token: undefined };
          saveResponse(question, response);
          setMessage("");
        } else {
          setError(
            error.status === 429
              ? "The assistant is busy. Please try again shortly."
              : error.status === 422
                ? "That question could not be processed. Please revise it and try again."
                : "Evidence chat is unavailable. Please try again."
          );
        }
      } else {
        setError("Evidence chat is unavailable. Please try again.");
      }
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function saveResponse(question: string, response: KnowledgeChatResponse) {
    const conversation = active ?? createConversation(response, question);
    const now = new Date().toISOString();
    const updated: LocalConversation = {
      ...conversation,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      turns: [
        ...conversation.turns,
        {
          id: `${response.request_id}:user`,
          role: "user",
          text: question,
          createdAt: now,
        },
        {
          id: response.request_id,
          role: "assistant",
          text: response.answer,
          response,
          createdAt: now,
        },
      ],
      updatedAt: now,
    };
    const next = [
      updated,
      ...conversations.filter((item) => item.id !== updated.id),
    ].slice(0, 5);
    saveConversations(next);
    setConversations(next);
    setActiveId(updated.id);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(message.trim());
  }

  function deleteOne(id: string) {
    const next = removeConversation(id);
    setConversations(next);
    setActiveId(next[0]?.id ?? "");
  }

  return (
    <div className={`evidence-chat evidence-chat-${mode}`}>
      {mode === "workspace" && (
        <aside className="chat-history" aria-label="Local conversation history">
          <div>
            <strong>Recent chats</strong>
            <button
              type="button"
              onClick={() => {
                clearConversations();
                setConversations([]);
                setActiveId("");
                setError("");
              }}
              {...analyticsControlAttributes("evidence_chat_history_clear")}
            >
              Clear all
            </button>
          </div>
          {conversations.length === 0 ? (
            <p>No saved conversations yet.</p>
          ) : (
            conversations.map((item) => (
              <div className="history-row" key={item.id}>
                <button
                  type="button"
                  aria-current={active?.id === item.id}
                  onClick={() => setActiveId(item.id)}
                  {...analyticsControlAttributes(
                    "evidence_chat_history_select"
                  )}
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => deleteOne(item.id)}
                  {...analyticsControlAttributes(
                    "evidence_chat_history_delete"
                  )}
                >
                  ×
                </button>
              </div>
            ))
          )}
          <p className="retention-copy">
            Up to five conversations are stored in this browser for 30 days.
            Deleting here removes the local copy.
          </p>
        </aside>
      )}
      <section className="chat-panel" aria-label="Ask the evidence">
        <header>
          <div>
            <span className="kicker">Reviewed literature</span>
            <h1>
              {mode === "drawer"
                ? "Ask the evidence"
                : "Knowledge graph evidence workspace"}
            </h1>
          </div>
          <Button
            variant="secondary"
            {...analyticsControlAttributes("evidence_chat_new")}
            type="button"
            onClick={() => {
              setActiveId("__new__");
              setError("");
              setMessage("");
            }}
          >
            New chat
          </Button>
        </header>
        <p className="medical-notice">{publicCopy.medical_notice}</p>
        <div className="chat-transcript" aria-live="polite">
          {!active?.turns.length && (
            <div className="chat-empty">
              <strong>Start with a research question</strong>
              <p>
                Ask about surveillance, vectors and hosts, environmental
                exposure, diagnostics, interventions, or outcomes.
              </p>
            </div>
          )}
          {active?.turns.map((turn) => (
            <article className={`chat-turn ${turn.role}`} key={turn.id}>
              <strong>
                {turn.role === "user" ? "You" : "Evidence assistant"}
              </strong>
              <p>{turn.text}</p>
              {turn.response && (
                <div
                  className="chat-evidence-meta"
                  aria-label="Evidence details"
                >
                  <span>Source: Literature evidence</span>
                  <span>
                    Evidence: {evidenceLabels[turn.response.evidence_state]}
                  </span>
                </div>
              )}
              {turn.response?.citations?.length ? (
                <ol className="citation-list">
                  {turn.response.citations.map((citation) => (
                    <li key={citation.citation_id}>
                      {safePubMedUrl(citation.pubmed_url, citation.pmid) ? (
                        <a
                          href={
                            safePubMedUrl(citation.pubmed_url, citation.pmid) ??
                            undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {citation.title}
                        </a>
                      ) : (
                        <span>{citation.title}</span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>
          ))}
          {pending && (
            <p role="status" className="processing">
              Searching reviewed evidence…
            </p>
          )}
          {error && (
            <div role="alert" className="chat-error">
              <p>{error}</p>
              {retryQuestion && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => ask(retryQuestion)}
                  disabled={pending}
                >
                  Retry question
                </Button>
              )}
            </div>
          )}
          {!error &&
            retryQuestion &&
            ["evidence_unavailable", "capacity_limited"].includes(
              active?.turns.at(-1)?.response?.status ?? ""
            ) && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => ask(retryQuestion)}
                disabled={pending}
              >
                Retry question
              </Button>
            )}
        </div>
        <form className="chat-form" onSubmit={submit}>
          <label htmlFor={`chat-message-${mode}`}>Your question</label>
          <textarea
            id={`chat-message-${mode}`}
            ref={inputRef}
            value={message}
            maxLength={1000}
            onChange={(event) => setMessage(event.target.value)}
            disabled={pending}
            placeholder="What does reviewed evidence say about…"
          />
          <div>
            <small>{message.length}/1,000</small>
            <Button
              {...analyticsControlAttributes("evidence_chat_submit")}
              disabled={!message.trim() || pending}
              type="submit"
            >
              Ask
            </Button>
          </div>
        </form>
        <footer className="chat-attribution">
          Data supplied by the NCBI. NCBI does not endorse this product.{" "}
          {mode === "drawer" && (
            <Link
              href={
                active
                  ? `/knowledge-graph?conversation=${encodeURIComponent(active.id)}`
                  : "/knowledge-graph"
              }
            >
              Open full workspace
            </Link>
          )}
        </footer>
      </section>
    </div>
  );
}
