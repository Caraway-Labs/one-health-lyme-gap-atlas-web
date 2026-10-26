"use client";

import publicCopy from "@caraway-labs/one-health-lyme-gap-atlas-knowledge-graph/public-copy";
import { SquarePen } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { AssistantCountyContextNotice } from "@/components/assistant-county-context";
import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import {
  AskAtlasHistoryControl,
  ChatHistoryEmptyHint,
  ChatHistoryMobileToggle,
} from "@/components/evidence-chat-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { classifyKnowledgeChatResponse } from "@/lib/ask-atlas-answer-contract";
import {
  ASK_ATLAS_ENABLED_SOURCE_MODES,
  ASK_ATLAS_SOURCE_MODE_BADGE,
  askAtlasPendingStatus,
  type AskAtlasSourceMode,
} from "@/lib/ask-atlas-source-mode";
import { assistantWorkspaceHref } from "@/lib/assistant-context-handoff";
import { atlasAssistantWorkspaceHeadingId } from "@/lib/assistant-entry-points";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import { AssistantOutcome } from "./assistant-outcome";
import { AssistantStarterPrompts } from "./assistant-starter-prompts";
import { AskAtlasGovernedAnswer } from "./governed-answer";
import type { EvidenceChatConversationModel } from "./use-evidence-chat";

export function EvidenceChatConversationContent({
  emptyLead,
  headingLevel = 1,
  leading,
  model,
  presentation = "default",
  showCountyNotice = true,
  showStarterPrompts = true,
  showWorkspaceHandoff = true,
  workspaceHandoffHref,
}: {
  emptyLead?: ReactNode;
  headingLevel?: 1 | 2;
  leading?: ReactNode;
  model: EvidenceChatConversationModel;
  presentation?: "ask-atlas" | "default";
  showCountyNotice?: boolean;
  showStarterPrompts?: boolean;
  showWorkspaceHandoff?: boolean;
  /** When set, drawer handoff uses this href instead of the legacy `/assistant` link. */
  workspaceHandoffHref?: (conversationId?: string) => string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    active,
    ask,
    charCountNearLimit,
    clearAllConversations,
    composerHasUnsentText,
    conversations,
    deleteOne,
    editQuestion,
    failure,
    failureRegionRef,
    hasSavedConversations,
    inputRef,
    message,
    missingConversationId,
    mobileHistoryOpen,
    mobileHistoryToggleRef,
    mode,
    pending,
    pendingStatusVisible,
    retryQuestion,
    selectConversation,
    setMessage,
    setMobileHistoryOpen,
    setSourceMode,
    showEmptyState,
    sourceMode,
    sourceModeSelection,
    sourceModes,
    startNewChat,
    submit,
    workspaceHandoffConversationId,
  } = model;

  const assistantHeadingId = atlasAssistantWorkspaceHeadingId(mode);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const turnCount = active?.turns.length ?? 0;
  const activeConversationId = active?.id ?? "";
  const askAtlasPage = presentation === "ask-atlas";
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) {
      return;
    }
    const lastTurn = transcript.querySelector<HTMLElement>(
      ".chat-turn:last-child"
    );
    if (turnCount === 0 && !pending && !failure) {
      return;
    }
    const anchor = pendingStatusVisible
      ? (transcript.querySelector<HTMLElement>(".processing") ?? lastTurn)
      : lastTurn;
    if (askAtlasPage) {
      const scroller = transcript.closest<HTMLElement>(".ux-reset-pro-scroll");
      if (scroller && anchor) {
        scrollAnchorAboveComposer(scroller, anchor);
      } else if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
      }
    } else if (pending || !lastTurn) {
      transcript.scrollTop = transcript.scrollHeight;
    } else {
      const delta =
        lastTurn.getBoundingClientRect().top -
        transcript.getBoundingClientRect().top;
      transcript.scrollTop += delta;
    }
    // Reading the id keeps this effect tied to the visible conversation.
    transcript.dataset.scrolledConversation = activeConversationId;
  }, [
    activeConversationId,
    askAtlasPage,
    failure,
    pending,
    pendingStatusVisible,
    turnCount,
  ]);
  const handoffHref = (conversationId?: string) =>
    workspaceHandoffHref
      ? workspaceHandoffHref(conversationId)
      : assistantWorkspaceHref(
          pathname,
          searchParams,
          conversationId ? { conversation: conversationId } : undefined
        );
  const charCountId = `chat-char-count-${mode}`;
  const ChatPanel = mode === "workspace" ? "section" : "div";
  // Drawer chrome cannot use header/footer. Those elements become nested
  // banner and contentinfo landmarks.
  const PanelHeader = mode === "workspace" ? "header" : "div";
  const PanelFooter = mode === "workspace" ? "footer" : "div";
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const heading = askAtlasPage ? "Ask Atlas" : "Atlas Assistant";
  const composerPlaceholder = askAtlasComposerPlaceholder(
    askAtlasPage,
    sourceMode
  );
  const showCharacterLimit = askAtlasPage && message.length > 0;
  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!askAtlasPage || event.key !== "Enter" || event.shiftKey) {
      return;
    }
    const native = event.nativeEvent;
    if (native.isComposing || native.keyCode === 229) {
      return;
    }
    event.preventDefault();
    const question = message.trim();
    if (!question || pending) {
      return;
    }
    ask(question);
  };
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  const requestNewChat = () => {
    if (composerHasUnsentText()) {
      setConfirmNewChat(true);
      return;
    }
    startNewChat();
  };

  return (
    <ChatPanel
      className="chat-panel"
      {...(mode === "workspace"
        ? { "aria-labelledby": assistantHeadingId }
        : {})}
    >
      <AskAtlasFrame active={askAtlasPage}>
        <PanelHeader className="chat-panel-header">
          {askAtlasPage ? (
            <div className="ux-reset-ask-atlas-title-block">
              <div className="ux-reset-ask-atlas-heading">
                <Heading id={assistantHeadingId}>{heading}</Heading>
                <Badge variant="outline">
                  {ASK_ATLAS_SOURCE_MODE_BADGE[sourceMode]}
                </Badge>
              </div>
            </div>
          ) : (
            <div>
              <span className="kicker">Reviewed literature</span>
              <Heading id={assistantHeadingId}>{heading}</Heading>
            </div>
          )}
          <div className="chat-panel-header-actions">
            {askAtlasPage ? (
              <AskAtlasHistoryControl
                activeConversationId={active?.id}
                composerFocusRef={inputRef}
                conversations={conversations}
                onClearAll={clearAllConversations}
                onDelete={deleteOne}
                onSelect={selectConversation}
              />
            ) : null}
            {mode === "workspace" && !askAtlasPage ? (
              <ChatHistoryMobileToggle
                conversationCount={conversations.length}
                label="Recent chats"
                mobileToggleRef={mobileHistoryToggleRef}
                onOpenChange={setMobileHistoryOpen}
                open={mobileHistoryOpen}
              />
            ) : null}
            <Button
              variant={askAtlasPage ? "ghost" : "secondary"}
              {...analyticsControlAttributes("evidence_chat_new")}
              type="button"
              onClick={requestNewChat}
            >
              {askAtlasPage ? <SquarePen aria-hidden="true" /> : null}
              New chat
            </Button>
          </div>
        </PanelHeader>
        {mode === "workspace" && !hasSavedConversations && !askAtlasPage ? (
          <ChatHistoryEmptyHint />
        ) : null}
        {leading}
        {showCountyNotice ? <AssistantCountyContextNotice /> : null}
        {askAtlasPage ? null : (
          <p
            className="medical-notice"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- height-capped notice can scroll in the public drawer
            tabIndex={0}
          >
            {publicCopy.medical_notice}
          </p>
        )}
        {askAtlasPage && showEmptyState ? null : (
          /* Public drawer tabIndex=0 reaches a scrollable transcript. Ask Atlas
           uses -1 so a restored conversation can be focused without a tab stop
           or a nested scroll trap. */
          <div
            className="chat-transcript"
            aria-label="Conversation transcript"
            aria-live="polite"
            ref={transcriptRef}
            role="region"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- programmatic focus target; the public drawer transcript also scrolls
            tabIndex={askAtlasPage ? -1 : 0}
          >
            <div className="chat-transcript-flow">
              {missingConversationId ? (
                <div
                  className="chat-notice"
                  data-assistant-state="conversation_not_found"
                  role="status"
                >
                  <p>
                    <strong>Conversation not found in this browser.</strong>{" "}
                    This link points to a chat that is not saved here. Start a
                    new chat to continue.
                  </p>
                  <div className="chat-state-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={requestNewChat}
                      {...analyticsControlAttributes("evidence_chat_new")}
                    >
                      New chat
                    </Button>
                  </div>
                </div>
              ) : null}
              {showEmptyState && !askAtlasPage ? (
                <div className="chat-empty">
                  <strong>Start with a research question</strong>
                  <p>
                    Ask about surveillance, vectors and hosts, environmental
                    exposure, diagnostics, interventions, or outcomes.
                  </p>
                </div>
              ) : null}
              {(active?.turns ?? []).map((turn, index, turns) => {
                const priorQuestion =
                  turn.role === "assistant"
                    ? (turns[index - 1]?.text ?? "")
                    : "";
                const decision = turn.response
                  ? classifyKnowledgeChatResponse(turn.response)
                  : null;
                const groundedAnswer =
                  turn.role === "assistant" &&
                  decision?.kind === "grounded" &&
                  turn.response
                    ? turn.response
                    : null;
                const visibleAnswer =
                  turn.role === "assistant" &&
                  decision &&
                  decision.kind !== "closed" &&
                  !groundedAnswer &&
                  turn.response
                    ? turn.response.answer
                    : "";
                const governed = turn.assistantPayload;
                const showLiteratureAnswer = !governed;
                return (
                  <article className={`chat-turn ${turn.role}`} key={turn.id}>
                    <strong>
                      {turn.role === "user" ? "You" : "Evidence assistant"}
                    </strong>
                    {turn.role === "user" && turn.text ? (
                      <p>{turn.text}</p>
                    ) : null}
                    {governed ? (
                      <AskAtlasGovernedAnswer
                        actionable={turn.id === turns.at(-1)?.id}
                        onEditQuestion={editQuestion}
                        onRetry={ask}
                        pending={pending}
                        question={priorQuestion}
                        turn={governed}
                      />
                    ) : null}
                    {showLiteratureAnswer && visibleAnswer ? (
                      <p>{visibleAnswer}</p>
                    ) : null}
                    {showLiteratureAnswer && groundedAnswer ? (
                      <EvidenceChatAnswerSources response={groundedAnswer} />
                    ) : null}
                    {showLiteratureAnswer &&
                    turn.response &&
                    decision &&
                    decision.kind !== "closed" ? (
                      <AssistantOutcome
                        actionable={turn.id === turns.at(-1)?.id}
                        onEditQuestion={editQuestion}
                        onRetry={ask}
                        pending={pending}
                        question={priorQuestion}
                        response={turn.response}
                      />
                    ) : null}
                    {showLiteratureAnswer && decision?.kind === "closed" ? (
                      <div
                        className="chat-error"
                        data-assistant-state="response_unverified"
                        data-close-reason={decision.reason}
                        role="alert"
                      >
                        <p>
                          <strong>Response could not be verified.</strong>{" "}
                          Evidence chat response could not be verified. Please
                          try again later.
                        </p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {pending ? (
                <p
                  aria-atomic="true"
                  aria-live="polite"
                  className={pendingStatusVisible ? "processing" : "sr-only"}
                  role="status"
                >
                  {pendingStatusVisible
                    ? askAtlasPendingStatus(sourceMode)
                    : ""}
                </p>
              ) : null}
              {failure && (
                <div
                  ref={failureRegionRef}
                  role="alert"
                  className="chat-error"
                  data-assistant-state={failure.state}
                  data-close-reason={failure.reason}
                  tabIndex={-1}
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
        )}
        <div className="chat-composer-dock">
          {askAtlasPage ? (
            emptyLead
          ) : (
            <AssistantStarterPrompts
              mode={mode}
              onSelect={editQuestion}
              visible={showEmptyState && showStarterPrompts}
            />
          )}
          <form className="chat-form" onSubmit={submit}>
            <label htmlFor={`chat-message-${mode}`}>
              {askAtlasPage ? "Your research question" : "Your question"}
            </label>
            <textarea
              id={`chat-message-${mode}`}
              ref={inputRef}
              rows={2}
              value={message}
              maxLength={1000}
              aria-describedby={charCountNearLimit ? charCountId : undefined}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={askAtlasPage ? handleComposerKeyDown : undefined}
              disabled={pending}
              placeholder={composerPlaceholder}
            />
            <div className="chat-form-actions">
              {askAtlasPage ? (
                showCharacterLimit ? (
                  <small
                    id={charCountId}
                    className={
                      charCountNearLimit
                        ? "chat-char-count chat-char-count-near-limit"
                        : "chat-char-count"
                    }
                  >
                    {charCountNearLimit
                      ? `${message.length}/1,000`
                      : "Up to 1,000 characters"}
                  </small>
                ) : (
                  <span
                    className="chat-char-count-placeholder"
                    aria-hidden="true"
                  />
                )
              ) : charCountNearLimit ? (
                <small
                  id={charCountId}
                  className="chat-char-count chat-char-count-near-limit"
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
                aria-busy={pending || undefined}
                disabled={!message.trim() || pending}
                type="submit"
              >
                Ask
              </Button>
            </div>
            {askAtlasPage && sourceModeSelection ? (
              <fieldset className="ask-atlas-source-modes">
                <legend>Evidence to ask</legend>
                <p id="ask-atlas-source-mode-note">
                  Choose an endpoint. The answer lists the sources it actually
                  used. Both is not an automatic choice.
                </p>
                {sourceModes.map((modeOption) => {
                  const enabled = (
                    ASK_ATLAS_ENABLED_SOURCE_MODES as readonly string[]
                  ).includes(modeOption);
                  return (
                    <label className="ask-atlas-source-mode" key={modeOption}>
                      <input
                        checked={sourceMode === modeOption}
                        disabled={!enabled || pending}
                        name="ask-atlas-source-mode"
                        type="radio"
                        value={modeOption}
                        onChange={() => {
                          setSourceMode(modeOption);
                        }}
                      />
                      {modeOption}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
            {askAtlasPage ? (
              <p className="medical-notice">{publicCopy.medical_notice}</p>
            ) : null}
          </form>
          <PanelFooter className="chat-attribution">
            Data supplied by the NCBI. NCBI does not endorse this product.{" "}
            {mode === "drawer" &&
              showWorkspaceHandoff &&
              (workspaceHandoffConversationId ? (
                <Link href={handoffHref(workspaceHandoffConversationId)}>
                  Open full workspace
                </Link>
              ) : (
                <span className="chat-attribution-handoff-hint">
                  Open full workspace after your first saved answer, or{" "}
                  <Link href={handoffHref()}>start in the workspace</Link>.
                  Unsent text in this drawer is not carried over.
                </span>
              ))}
          </PanelFooter>
        </div>
      </AskAtlasFrame>
      <Dialog onOpenChange={setConfirmNewChat} open={confirmNewChat}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new chat?</DialogTitle>
            <DialogDescription>
              The question in the composer has not been sent. Starting a new
              chat clears that text.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setConfirmNewChat(false);
                inputRef.current?.focus();
              }}
            >
              Keep question
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmNewChat(false);
                startNewChat();
              }}
            >
              Start new chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ChatPanel>
  );
}

function AskAtlasFrame({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  if (!active) {
    return children;
  }
  return <div className="ux-reset-ask-atlas-column">{children}</div>;
}

/** Keep a new turn readable above the sticky composer. Tall turns open at their start; turns that fit stay bottom-aligned. */
function scrollAnchorAboveComposer(scroller: HTMLElement, anchor: HTMLElement) {
  const scrollerBox = scroller.getBoundingClientRect();
  const anchorBox = anchor.getBoundingClientRect();
  const composer = scroller.querySelector<HTMLElement>(
    ".ux-reset-ask-atlas-workspace .chat-composer-dock"
  );
  const composerBox = composer?.getBoundingClientRect();
  const pinnedToBottom =
    composerBox !== undefined && composerBox.bottom >= scrollerBox.bottom - 1;
  const reserve =
    pinnedToBottom && composerBox
      ? Math.min(
          composerBox.height,
          Math.min(scrollerBox.bottom, composerBox.bottom) -
            Math.max(scrollerBox.top, composerBox.top)
        )
      : 0;
  const visibleBottom = scrollerBox.bottom - reserve;
  const visibleHeight = visibleBottom - scrollerBox.top;
  if (anchorBox.height > visibleHeight) {
    scroller.scrollTop += anchorBox.top - scrollerBox.top;
    return;
  }
  if (anchorBox.bottom > visibleBottom) {
    scroller.scrollTop += anchorBox.bottom - visibleBottom;
    return;
  }
  if (anchorBox.top < scrollerBox.top) {
    scroller.scrollTop += anchorBox.top - scrollerBox.top;
  }
}

function askAtlasComposerPlaceholder(
  askAtlasPage: boolean,
  sourceMode: AskAtlasSourceMode
): string {
  if (!askAtlasPage) {
    return "What does reviewed evidence say about…";
  }
  switch (sourceMode) {
    case "Literature": {
      return "What does reviewed research say about…";
    }
    case "Structured": {
      return "Ask for a governed county measure and period…";
    }
    case "Both": {
      return "Ask across governed Atlas data and reviewed literature…";
    }
    default: {
      const unhandled: never = sourceMode;
      return unhandled;
    }
  }
}
