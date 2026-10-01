"use client";

import publicCopy from "@caraway-labs/one-health-lyme-gap-atlas-knowledge-graph/public-copy";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { AssistantCountyContextNotice } from "@/components/assistant-county-context";
import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import {
  ChatHistoryEmptyHint,
  ChatHistoryMobileToggle,
} from "@/components/evidence-chat-history";
import { Button } from "@/components/ui/button";
import { assistantWorkspaceHref } from "@/lib/assistant-context-handoff";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import { AssistantOutcome } from "./assistant-outcome";
import type { EvidenceChatConversationModel } from "./use-evidence-chat";

export function EvidenceChatConversationContent({
  model,
}: {
  model: EvidenceChatConversationModel;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    active,
    ask,
    charCountNearLimit,
    conversations,
    editQuestion,
    failure,
    hasSavedConversations,
    inputRef,
    message,
    missingConversationId,
    mobileHistoryOpen,
    mobileHistoryToggleRef,
    mode,
    pending,
    retryQuestion,
    setMessage,
    setMobileHistoryOpen,
    showEmptyState,
    startNewChat,
    submit,
    workspaceHandoffConversationId,
  } = model;

  return (
    <section className="chat-panel" aria-label="Atlas Assistant">
      <header>
        <div>
          <span className="kicker">Reviewed literature</span>
          <h1>Atlas Assistant</h1>
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
              <span
                className="chat-char-count-placeholder"
                aria-hidden="true"
              />
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
          {mode === "drawer" &&
            (workspaceHandoffConversationId ? (
              <Link
                href={assistantWorkspaceHref(pathname, searchParams, {
                  conversation: workspaceHandoffConversationId,
                })}
              >
                Open full workspace
              </Link>
            ) : (
              <span className="chat-attribution-handoff-hint">
                Open full workspace after your first saved answer, or{" "}
                <Link href={assistantWorkspaceHref(pathname, searchParams)}>
                  start in the workspace
                </Link>
                . Unsent text in this drawer is not carried over.
              </span>
            ))}
        </footer>
      </div>
    </section>
  );
}
