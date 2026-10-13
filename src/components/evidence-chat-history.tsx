"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import {
  conversationEvidenceStrengthLabel,
  conversationTurnPreview,
  relativeConversationTime,
} from "@/lib/knowledge-chat-history-display";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";

interface ChatHistoryActionsProps {
  activeConversationId?: string;
  composerFocusRef: RefObject<HTMLTextAreaElement | null>;
  conversations: LocalConversation[];
  mobileHistoryOpen: boolean;
  mobileToggleRef: RefObject<HTMLButtonElement | null>;
  onClearAll: () => void;
  onDelete: (id: string) => void;
  onMobileHistoryOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  showRetentionCopy?: boolean;
}

function ChatHistoryList({
  activeConversationId,
  conversations,
  now,
  onDelete,
  onSelect,
}: {
  activeConversationId?: string;
  conversations: LocalConversation[];
  now: number;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="chat-history-list">
      {conversations.map((item) => {
        const isActive = activeConversationId === item.id;
        const preview = isActive ? null : conversationTurnPreview(item);
        const evidenceLabel = conversationEvidenceStrengthLabel(item);
        const showMeta = preview || evidenceLabel;
        return (
          <li className="history-row" key={item.id}>
            <button
              type="button"
              className="history-row-select"
              aria-current={isActive}
              onClick={() => onSelect(item.id)}
              {...analyticsControlAttributes("evidence_chat_history_select")}
            >
              <span className="history-row-title">{item.title}</span>
              {showMeta ? (
                <span className="history-row-meta">
                  <time dateTime={item.updatedAt}>
                    {relativeConversationTime(item.updatedAt, now)}
                  </time>
                  {preview && (
                    <span className="history-row-preview">{preview}</span>
                  )}
                  {evidenceLabel && (
                    <span className="history-row-evidence">
                      {evidenceLabel}
                    </span>
                  )}
                </span>
              ) : (
                <time
                  className="history-row-meta history-row-meta--time-only"
                  dateTime={item.updatedAt}
                >
                  {relativeConversationTime(item.updatedAt, now)}
                </time>
              )}
            </button>
            <button
              type="button"
              className="history-row-delete"
              aria-label={`Delete ${item.title}`}
              onClick={() => onDelete(item.id)}
              {...analyticsControlAttributes("evidence_chat_history_delete")}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChatHistoryClearDialog({
  focusReturnRef,
  onConfirm,
  onOpenChange,
  open,
}: {
  focusReturnRef: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          focusReturnRef.current?.focus();
        }
      }}
      open={open}
    >
      <DialogContent
        aria-describedby="chat-history-clear-description"
        aria-labelledby="chat-history-clear-title"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle id="chat-history-clear-title">
            Clear all saved chats?
          </DialogTitle>
          <DialogDescription id="chat-history-clear-description">
            This removes up to five locally saved conversations from this
            browser. It does not delete anything from Atlas servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            {...analyticsControlAttributes("evidence_chat_history_clear")}
          >
            Clear all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SAVED_IN_BROWSER =
  "Up to five conversations stay in this browser for 30 days. Nothing is stored until a response is saved. Deleting a chat removes that local copy only.";

export function AskAtlasHistoryControl({
  activeConversationId,
  composerFocusRef,
  conversations,
  onClearAll,
  onDelete,
  onSelect,
}: {
  activeConversationId?: string;
  composerFocusRef: RefObject<HTMLTextAreaElement | null>;
  conversations: LocalConversation[];
  onClearAll: () => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [relativeTimeNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closePanel(focusButton = true) {
    setOpen(false);
    if (focusButton) {
      buttonRef.current?.focus();
    }
  }

  return (
    <div className="ux-reset-ask-atlas-history">
      <Button
        aria-controls="ask-atlas-history-panel"
        aria-expanded={open}
        ref={buttonRef}
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen((current) => !current);
        }}
        {...analyticsControlAttributes("evidence_chat_history_open")}
      >
        Chat history
      </Button>
      {open ? (
        <>
          <button
            aria-label="Close chat history"
            className="ux-reset-ask-atlas-history-backdrop"
            type="button"
            onClick={() => {
              closePanel();
            }}
          />
          <div
            aria-label="Chat history"
            className="ux-reset-ask-atlas-history-panel"
            id="ask-atlas-history-panel"
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="chat-history-header">
              <strong>Chat history</strong>
              {conversations.length > 0 ? (
                <button
                  aria-haspopup="dialog"
                  className="chat-history-clear"
                  type="button"
                  onClick={() => {
                    closePanel(false);
                    setClearDialogOpen(true);
                  }}
                >
                  Clear all
                </button>
              ) : null}
            </div>
            {conversations.length === 0 ? (
              <p className="chat-history-empty-hint">
                No chats are saved in this browser yet. A chat is saved here
                only after a response arrives.
              </p>
            ) : (
              <ChatHistoryList
                activeConversationId={activeConversationId}
                conversations={conversations}
                now={relativeTimeNow}
                onDelete={onDelete}
                onSelect={(id) => {
                  onSelect(id);
                  closePanel(false);
                  composerFocusRef.current?.focus();
                }}
              />
            )}
            <details
              className="ux-reset-ask-atlas-storage"
              data-testid="ask-atlas-browser-storage"
              id="ask-atlas-browser-storage"
            >
              <summary>Saved in this browser</summary>
              <p>{SAVED_IN_BROWSER}</p>
            </details>
          </div>
        </>
      ) : null}
      <ChatHistoryClearDialog
        focusReturnRef={buttonRef}
        onConfirm={() => {
          onClearAll();
          setClearDialogOpen(false);
          composerFocusRef.current?.focus();
        }}
        onOpenChange={setClearDialogOpen}
        open={clearDialogOpen}
      />
    </div>
  );
}

export function ChatHistoryEmptyHint() {
  return (
    <p className="chat-history-empty-hint">
      Questions you ask can be saved in this browser for up to 30 days. Nothing
      is stored until you get a response.
    </p>
  );
}

export function ChatHistoryMobileToggle({
  conversationCount,
  label = "Recent chats",
  mobileToggleRef,
  onOpenChange,
  open,
}: {
  conversationCount: number;
  label?: string;
  mobileToggleRef: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  if (conversationCount === 0) {
    return null;
  }
  return (
    <Button
      ref={mobileToggleRef}
      type="button"
      variant="secondary"
      className="chat-history-mobile-toggle"
      aria-expanded={open}
      aria-controls="chat-history-mobile-sheet"
      onClick={() => onOpenChange(!open)}
      {...analyticsControlAttributes("evidence_chat_history_open")}
    >
      {label} ({conversationCount})
    </Button>
  );
}

export function ChatHistoryWorkspace({
  activeConversationId,
  composerFocusRef,
  conversations,
  mobileHistoryOpen,
  mobileToggleRef,
  onClearAll,
  onDelete,
  onMobileHistoryOpenChange,
  onSelect,
  showRetentionCopy = true,
}: ChatHistoryActionsProps) {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearDialogFocusTarget, setClearDialogFocusTarget] = useState<
    "desktop" | "mobile"
  >("desktop");
  const desktopClearRef = useRef<HTMLButtonElement>(null);
  const [relativeTimeNow] = useState(() => Date.now());

  if (conversations.length === 0) {
    return null;
  }

  function handleSelect(id: string) {
    onSelect(id);
    onMobileHistoryOpenChange(false);
    composerFocusRef.current?.focus();
  }

  function handleClearConfirmed() {
    onClearAll();
    setClearDialogOpen(false);
    composerFocusRef.current?.focus();
  }

  function requestClearAll(target: "desktop" | "mobile") {
    setClearDialogFocusTarget(target);
    if (target === "mobile") {
      onMobileHistoryOpenChange(false);
    }
    setClearDialogOpen(true);
  }

  const list = (
    <ChatHistoryList
      activeConversationId={activeConversationId}
      conversations={conversations}
      now={relativeTimeNow}
      onDelete={onDelete}
      onSelect={handleSelect}
    />
  );

  return (
    <>
      <aside
        className="chat-history chat-history-desktop"
        aria-label="Local conversation history"
      >
        <div className="chat-history-header">
          <strong>Recent chats</strong>
          <button
            ref={desktopClearRef}
            type="button"
            className="chat-history-clear"
            aria-haspopup="dialog"
            onClick={() => requestClearAll("desktop")}
          >
            Clear all
          </button>
        </div>
        {list}
        {showRetentionCopy ? (
          <p className="retention-copy">
            Up to five conversations are stored in this browser for 30 days.
            Deleting here removes the local copy.
          </p>
        ) : null}
      </aside>
      {mobileHistoryOpen && (
        <div
          className="chat-history-mobile-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onMobileHistoryOpenChange(false);
              mobileToggleRef.current?.focus();
            }
          }}
        >
          <section
            className="chat-history-mobile-sheet"
            id="chat-history-mobile-sheet"
            aria-label="Recent chats"
          >
            <header className="chat-history-mobile-sheet-header">
              <strong>Recent chats</strong>
              <div className="chat-history-mobile-sheet-actions">
                <button
                  type="button"
                  className="chat-history-clear"
                  aria-haspopup="dialog"
                  onClick={() => requestClearAll("mobile")}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="chat-history-mobile-close"
                  aria-label="Close recent chats"
                  onClick={() => {
                    onMobileHistoryOpenChange(false);
                    mobileToggleRef.current?.focus();
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </header>
            {list}
            {showRetentionCopy ? (
              <p className="retention-copy">
                Up to five conversations are stored in this browser for 30 days.
                Deleting here removes the local copy.
              </p>
            ) : null}
          </section>
        </div>
      )}
      <ChatHistoryClearDialog
        focusReturnRef={
          clearDialogFocusTarget === "mobile"
            ? mobileToggleRef
            : desktopClearRef
        }
        onConfirm={handleClearConfirmed}
        onOpenChange={setClearDialogOpen}
        open={clearDialogOpen}
      />
    </>
  );
}
