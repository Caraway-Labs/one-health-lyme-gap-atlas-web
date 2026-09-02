"use client";

import publicCopy from "@caraway-labs/one-health-lyme-gap-atlas-knowledge-graph/public-copy";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { knowledgeGraphChatV1KnowledgeGraphChatPost } from "@/generated/atlas";
import { KnowledgeGraphChatV1KnowledgeGraphChatPostResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";
import {
  CHAT_STORAGE_EVENT,
  clearConversations,
  createConversation,
  loadConversations,
  removeConversation,
  saveConversations,
} from "@/lib/knowledge-chat-storage";

export function EvidenceChat({
  mode = "workspace",
  initialConversationId,
  onOpenWorkspace,
}: {
  mode?: "drawer" | "workspace";
  initialConversationId?: string;
  onOpenWorkspace?: () => void;
}) {
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeId, setActiveId] = useState(
    initialConversationId ?? "__latest__"
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = message.trim();
    if (!question || pending) {
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await knowledgeGraphChatV1KnowledgeGraphChatPost({
        conversation_id: active?.id,
        conversation_token: active?.token,
        message: question,
      });
      const response = validateApiResponse(
        "Evidence chat response",
        KnowledgeGraphChatV1KnowledgeGraphChatPostResponse,
        result.data
      );
      const conversation = active ?? createConversation(response, question);
      const now = new Date().toISOString();
      const updated: LocalConversation = {
        ...conversation,
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        token: conversation.token || response.conversation_token || "",
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
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Evidence chat is unavailable."
      );
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
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
              }}
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
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => deleteOne(item.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
          <p className="retention-copy">
            Up to five conversations are stored in this browser for 30 days.
            Deleting here removes the local copy only; the server copy expires
            under its 30-day retention policy.
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
          <button
            className="button secondary"
            type="button"
            onClick={() => setActiveId("__new__")}
          >
            New chat
          </button>
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
              {turn.response?.citations?.length ? (
                <ol className="citation-list">
                  {turn.response.citations.map((citation) => (
                    <li key={citation.citation_id}>
                      <a
                        href={citation.pubmed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {citation.title} (PMID {citation.pmid})
                      </a>
                      <small>{citation.source_label}</small>
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
            <p role="alert" className="chat-error">
              {error} Try again in a moment.
            </p>
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
            <button
              className="button primary"
              disabled={!message.trim() || pending}
            >
              Ask
            </button>
          </div>
        </form>
        <footer className="chat-attribution">
          Data supplied by the NCBI. NCBI does not endorse this product.{" "}
          {mode === "drawer" && (
            <Link
              onClick={onOpenWorkspace}
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
