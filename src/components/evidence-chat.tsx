"use client";

import publicCopy from "@caraway-labs/one-health-lyme-gap-atlas-knowledge-graph/public-copy";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AssistantCountyContextNotice } from "@/components/assistant-county-context";
import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import {
  ChatHistoryEmptyHint,
  ChatHistoryMobileToggle,
  ChatHistoryWorkspace,
} from "@/components/evidence-chat-history";
import { Button } from "@/components/ui/button";
import { knowledgeGraphChatV1KnowledgeGraphChatPost } from "@/generated/atlas";
import type { KnowledgeChatResponse } from "@/generated/models";
import { KnowledgeGraphChatV1KnowledgeGraphChatPostResponse } from "@/generated/zod/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { validateApiResponse } from "@/lib/api-response-validation";
import { assistantWorkspaceHref } from "@/lib/assistant-context-handoff";
import {
  readAssistantConversationId,
  resolveActiveConversation,
  resolveConversationSelection,
  synchronizeAssistantConversationUrl,
} from "@/lib/assistant-conversation-url";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";
import {
  CHAT_STORAGE_EVENT,
  clearConversations,
  conversationHistory,
  createConversation,
  loadConversations,
  removeConversation,
  RETENTION_MS,
  saveConversations,
} from "@/lib/knowledge-chat-storage";

const CORPUS_LIMIT =
  "Atlas does not currently have relevant reviewed literature in its governed corpus for this question. This does not mean no scientific evidence exists elsewhere.";
const CORPUS_NEXT_STEP =
  "Edit this question and submit it again, or narrow it by species or pathogen, geography, study period, or a more specific scope. The Atlas literature corpus is expanding.";
const LITERATURE_HELP_HREF = "/docs/ai-enabled-decision-intelligence";

interface ClientFailure {
  message: string;
  retry: boolean;
  state: "network_failure" | "rate_limited" | "request_not_processed";
  title: string;
}

function isOperationalStatus(
  status: KnowledgeChatResponse["status"] | undefined
): boolean {
  return status === "evidence_unavailable" || status === "capacity_limited";
}

function retainsSubmittedQuestion(response: KnowledgeChatResponse): boolean {
  return (
    isOperationalStatus(response.status) ||
    (response.status === "no_evidence" &&
      response.evidence_state === "no_relevant_corpus_evidence")
  );
}

function shouldReplaceOperationalTurn(
  conversation: LocalConversation | undefined,
  question: string
): boolean {
  const user = conversation?.turns.at(-2);
  const assistant = conversation?.turns.at(-1);
  return (
    user?.role === "user" &&
    user.text === question &&
    isOperationalStatus(assistant?.response?.status)
  );
}

function clientFailure(error: unknown): ClientFailure {
  if (!(error instanceof AtlasApiError)) {
    return {
      message:
        "This browser could not complete the request. Check your connection and try again.",
      retry: true,
      state: "network_failure",
      title: "Connection problem.",
    };
  }
  if (error.status === 429) {
    return {
      message:
        "The assistant is busy and did not finish this request. Please try again shortly.",
      retry: true,
      state: "rate_limited",
      title: "Assistant is busy.",
    };
  }
  if (error.status === 422) {
    return {
      message:
        "That question could not be processed. Please revise it and try again.",
      retry: false,
      state: "request_not_processed",
      title: "Question not processed.",
    };
  }
  return {
    message:
      "The assistant service did not complete this request. This is not a finding that the Atlas corpus lacks relevant literature.",
    retry: true,
    state: "network_failure",
    title: "Service error.",
  };
}

function OutcomeActions({ children }: { children: ReactNode }) {
  return <div className="chat-state-actions">{children}</div>;
}

function AssistantOutcome({
  actionable,
  onEditQuestion,
  onRetry,
  pending,
  question,
  response,
}: {
  actionable: boolean;
  onEditQuestion: (question: string) => void;
  onRetry: (question: string) => void;
  pending: boolean;
  question: string;
  response: KnowledgeChatResponse;
}) {
  switch (response.status) {
    case "answered": {
      return null;
    }
    case "no_evidence": {
      if (response.evidence_state !== "no_relevant_corpus_evidence") {
        return null;
      }
      return (
        <div
          className="chat-state chat-state-corpus"
          data-assistant-state="no_relevant_corpus_evidence"
        >
          <p>
            <strong>No relevant literature in the Atlas corpus.</strong>{" "}
            {CORPUS_LIMIT}
          </p>
          <p>{CORPUS_NEXT_STEP}</p>
          <p>
            <Link href={LITERATURE_HELP_HREF}>
              Read how Atlas Assistant uses reviewed literature
            </Link>
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onEditQuestion(question)}
                {...analyticsControlAttributes("evidence_chat_edit_question")}
              >
                Edit question
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    case "evidence_unavailable": {
      return (
        <div
          className="chat-state chat-state-unavailable"
          data-assistant-state="evidence_unavailable"
        >
          <p>
            <strong>Evidence service unavailable.</strong> The evidence service
            could not complete this request. This is not a finding that the
            Atlas corpus has no relevant literature.
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRetry(question)}
                disabled={pending}
                {...analyticsControlAttributes("evidence_chat_retry")}
              >
                Retry
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    case "capacity_limited": {
      return (
        <div
          className="chat-state chat-state-capacity"
          data-assistant-state="capacity_limited"
        >
          <p>
            <strong>Temporarily at capacity.</strong> The assistant is capacity
            limited and could not answer right now. Try again later. This is not
            a finding about the literature.
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRetry(question)}
                disabled={pending}
                {...analyticsControlAttributes("evidence_chat_retry")}
              >
                Retry later
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    case "safety_refusal": {
      return (
        <div
          className="chat-state chat-state-refusal"
          data-assistant-state="safety_refusal"
        >
          <p>
            <strong>Request not answered.</strong> Atlas Assistant cannot answer
            this request. Revise it if you want to ask about reviewed
            literature.
          </p>
          {actionable && (
            <OutcomeActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onEditQuestion(question)}
                {...analyticsControlAttributes("evidence_chat_edit_question")}
              >
                Edit question
              </Button>
            </OutcomeActions>
          )}
        </div>
      );
    }
    default: {
      const unhandled: never = response.status;
      return unhandled;
    }
  }
}

export function EvidenceChat({
  mode = "workspace",
  initialConversationId,
}: {
  mode?: "drawer" | "workspace";
  initialConversationId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const syncWorkspaceUrl = mode === "workspace";
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState(
    initialConversationId ?? "__latest__"
  );
  const [missingConversationId, setMissingConversationId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientFailure | null>(null);
  const [retryQuestion, setRetryQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusQuestionOnSettle = useRef(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const mobileHistoryToggleRef = useRef<HTMLButtonElement>(null);

  const applyConversationSelection = useCallback(
    (
      requestedId: string | null | undefined,
      nextConversations: LocalConversation[]
    ) => {
      const selection = resolveConversationSelection(
        requestedId,
        nextConversations
      );
      setActiveId(selection.activeId);
      setMissingConversationId(selection.missingConversationId);
      if (syncWorkspaceUrl && selection.missingConversationId) {
        synchronizeAssistantConversationUrl();
      }
    },
    [syncWorkspaceUrl]
  );

  const syncActiveConversationUrl = useCallback(
    (conversationId: string) => {
      if (!syncWorkspaceUrl || conversationId === "__latest__") {
        return;
      }
      if (conversationId === "__new__" || conversationId === "") {
        synchronizeAssistantConversationUrl();
        return;
      }
      if (conversations.some((item) => item.id === conversationId)) {
        synchronizeAssistantConversationUrl(conversationId);
      }
    },
    [conversations, syncWorkspaceUrl]
  );

  const startNewChat = useCallback(
    (focusComposer = true) => {
      setActiveId("__new__");
      setMissingConversationId(null);
      setFailure(null);
      setRetryQuestion("");
      setMessage("");
      if (syncWorkspaceUrl) {
        synchronizeAssistantConversationUrl();
      }
      if (focusComposer) {
        inputRef.current?.focus();
      }
    },
    [syncWorkspaceUrl]
  );

  useEffect(() => {
    const loaded = loadConversations();
    const refresh = () => setConversations(loadConversations());
    // eslint-disable-next-line react/set-state-in-effect -- hydrate browser-local chat history once on mount.
    setConversations(loaded);
    setHydrated(true);
    if (syncWorkspaceUrl) {
      const requestedId =
        initialConversationId ?? readAssistantConversationId() ?? undefined;
      applyConversationSelection(requestedId, loaded);
    }
    window.addEventListener(CHAT_STORAGE_EVENT, refresh);
    return () => window.removeEventListener(CHAT_STORAGE_EVENT, refresh);
  }, [applyConversationSelection, initialConversationId, syncWorkspaceUrl]);

  useEffect(() => {
    if (syncWorkspaceUrl && missingConversationId) {
      synchronizeAssistantConversationUrl();
    }
  }, [missingConversationId, syncWorkspaceUrl]);

  useEffect(() => {
    if (!syncWorkspaceUrl || !hydrated) {
      return;
    }
    function onPopState() {
      const requestedId = readAssistantConversationId();
      applyConversationSelection(requestedId, loadConversations());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyConversationSelection, hydrated, syncWorkspaceUrl]);

  useEffect(() => {
    if (!syncWorkspaceUrl || !hydrated || missingConversationId) {
      return;
    }
    syncActiveConversationUrl(activeId);
  }, [
    activeId,
    hydrated,
    missingConversationId,
    syncActiveConversationUrl,
    syncWorkspaceUrl,
  ]);

  useEffect(() => {
    if (pending || !focusQuestionOnSettle.current) return;
    focusQuestionOnSettle.current = false;
    inputRef.current?.focus();
  }, [pending]);

  const active = resolveActiveConversation(activeId, conversations, hydrated);

  const showEmptyState =
    !active?.turns.length && !pending && !failure && !missingConversationId;
  const charCountNearLimit = message.length >= 900;

  function rememberOutcome(question: string, response: KnowledgeChatResponse) {
    setFailure(null);
    setMessage(retainsSubmittedQuestion(response) ? question : "");
    setRetryQuestion(isOperationalStatus(response.status) ? question : "");
  }

  function editQuestion(question: string) {
    setFailure(null);
    setMessage(question);
    inputRef.current?.focus();
  }

  async function ask(question: string) {
    if (!question || pending) {
      return;
    }
    const replaceOperationalTurn = shouldReplaceOperationalTurn(
      active,
      question
    );
    setPending(true);
    setFailure(null);
    try {
      const result = await knowledgeGraphChatV1KnowledgeGraphChatPost({
        message: question,
        history: conversationHistory(
          replaceOperationalTurn && active
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
      saveResponse(question, safeResponse, replaceOperationalTurn);
      rememberOutcome(question, safeResponse);
    } catch (error) {
      const parsed =
        error instanceof AtlasApiError
          ? KnowledgeGraphChatV1KnowledgeGraphChatPostResponse.safeParse(
              error.responseBody
            )
          : null;
      if (parsed?.success) {
        const response = { ...parsed.data, conversation_token: undefined };
        saveResponse(question, response, replaceOperationalTurn);
        rememberOutcome(question, response);
      } else {
        const nextFailure = clientFailure(error);
        setRetryQuestion(nextFailure.retry ? question : "");
        setFailure(nextFailure);
      }
    } finally {
      focusQuestionOnSettle.current = true;
      setPending(false);
    }
  }

  function saveResponse(
    question: string,
    response: KnowledgeChatResponse,
    replaceOperationalTurn: boolean
  ) {
    const conversation = active ?? createConversation(response, question);
    const now = new Date().toISOString();
    const priorTurns = replaceOperationalTurn
      ? conversation.turns.slice(0, -2)
      : conversation.turns;
    const updated: LocalConversation = {
      ...conversation,
      expiresAt: new Date(Date.parse(now) + RETENTION_MS).toISOString(),
      turns: [
        ...priorTurns,
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
    setMissingConversationId(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(message.trim());
  }

  function deleteOne(id: string) {
    const next = removeConversation(id);
    setConversations(next);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? "__new__");
      setMissingConversationId(null);
    }
  }

  function clearAllConversations() {
    clearConversations();
    setConversations([]);
    setMobileHistoryOpen(false);
    startNewChat(false);
  }

  const hasSavedConversations = conversations.length > 0;
  const workspaceClassName = [
    "evidence-chat",
    `evidence-chat-${mode}`,
    mode === "workspace" && !hasSavedConversations
      ? "evidence-chat-workspace--no-history"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={workspaceClassName}>
      {mode === "workspace" && hasSavedConversations && (
        <ChatHistoryWorkspace
          activeConversationId={active?.id}
          conversations={conversations}
          mobileHistoryOpen={mobileHistoryOpen}
          mobileToggleRef={mobileHistoryToggleRef}
          onClearAll={clearAllConversations}
          onDelete={deleteOne}
          onMobileHistoryOpenChange={setMobileHistoryOpen}
          onSelect={(id) => {
            setActiveId(id);
            setMissingConversationId(null);
            setFailure(null);
            setRetryQuestion("");
          }}
        />
      )}
      <section className="chat-panel" aria-label="Atlas Assistant">
        <header>
          <div>
            <span className="kicker">Reviewed literature</span>
            <h1>{mode === "drawer" ? "Atlas Assistant" : "Atlas Assistant"}</h1>
          </div>
          <div className="chat-panel-header-actions">
            {mode === "workspace" && (
              <ChatHistoryMobileToggle
                conversationCount={conversations.length}
                mobileToggleRef={mobileHistoryToggleRef}
                onOpenChange={setMobileHistoryOpen}
                open={mobileHistoryOpen}
              />
            )}
            <Button
              variant="secondary"
              {...analyticsControlAttributes("evidence_chat_new")}
              type="button"
              onClick={() => startNewChat()}
            >
              New chat
            </Button>
          </div>
        </header>
        {mode === "workspace" && !hasSavedConversations && (
          <ChatHistoryEmptyHint />
        )}
        <AssistantCountyContextNotice />
        <p className="medical-notice">{publicCopy.medical_notice}</p>
        {/* tabIndex satisfies axe scrollable-region-focusable for overflow transcript */}
        <div
          className="chat-transcript"
          aria-label="Conversation transcript"
          aria-live="polite"
          role="region"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard access to scrollable transcript
          tabIndex={0}
        >
          <div className="chat-transcript-flow">
            {missingConversationId ? (
              <div
                className="chat-notice"
                data-assistant-state="conversation_not_found"
                role="status"
              >
                <p>
                  <strong>Conversation not found in this browser.</strong> This
                  link points to a chat that is not saved here. Start a new chat
                  to continue.
                </p>
                <div className="chat-state-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => startNewChat()}
                    {...analyticsControlAttributes("evidence_chat_new")}
                  >
                    New chat
                  </Button>
                </div>
              </div>
            ) : null}
            {showEmptyState && (
              <div className="chat-empty">
                <strong>Start with a research question</strong>
                <p>
                  Ask about surveillance, vectors and hosts, environmental
                  exposure, diagnostics, interventions, or outcomes.
                </p>
              </div>
            )}
            {(active?.turns ?? []).map((turn, index, turns) => {
              const priorQuestion =
                turn.role === "assistant" ? (turns[index - 1]?.text ?? "") : "";
              return (
                <article className={`chat-turn ${turn.role}`} key={turn.id}>
                  <strong>
                    {turn.role === "user" ? "You" : "Evidence assistant"}
                  </strong>
                  <p>{turn.text}</p>
                  {turn.response && (
                    <EvidenceChatAnswerSources response={turn.response} />
                  )}
                  {turn.response && (
                    <AssistantOutcome
                      actionable={turn.id === turns.at(-1)?.id}
                      onEditQuestion={editQuestion}
                      onRetry={ask}
                      pending={pending}
                      question={priorQuestion}
                      response={turn.response}
                    />
                  )}
                </article>
              );
            })}
            {pending && (
              <p role="status" className="processing">
                Searching reviewed evidence…
              </p>
            )}
            {failure && (
              <div
                role="alert"
                className="chat-error"
                data-assistant-state={failure.state}
              >
                <p>
                  <strong>{failure.title}</strong> {failure.message}
                </p>
                {failure.retry && retryQuestion ? (
                  <div className="chat-state-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => ask(retryQuestion)}
                      disabled={pending}
                      {...analyticsControlAttributes("evidence_chat_retry")}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="chat-composer-dock">
          <form className="chat-form" onSubmit={submit}>
            <label htmlFor={`chat-message-${mode}`}>Your question</label>
            <textarea
              id={`chat-message-${mode}`}
              ref={inputRef}
              rows={2}
              value={message}
              maxLength={1000}
              onChange={(event) => setMessage(event.target.value)}
              disabled={pending}
              placeholder="What does reviewed evidence say about…"
            />
            <div className="chat-form-actions">
              {charCountNearLimit ? (
                <small
                  className="chat-char-count chat-char-count-near-limit"
                  aria-live="polite"
                >
                  {message.length}/1,000
                </small>
              ) : (
                <span className="chat-char-count-placeholder" aria-hidden="true" />
              )}
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
                href={assistantWorkspaceHref(pathname, searchParams, {
                  conversation: active?.id,
                })}
              >
                Open full workspace
              </Link>
            )}
          </footer>
        </div>
      </section>
    </div>
  );
}
