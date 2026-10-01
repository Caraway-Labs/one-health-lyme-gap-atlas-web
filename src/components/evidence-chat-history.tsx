"use client";

import { useRef, useState, type RefObject } from "react";

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
  mobileToggleRef,
  onOpenChange,
  open,
}: {
  conversationCount: number;
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
      Recent chats ({conversationCount})
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
        <p className="retention-copy">
          Up to five conversations are stored in this browser for 30 days.
          Deleting here removes the local copy.
        </p>
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
            <p className="retention-copy">
              Up to five conversations are stored in this browser for 30 days.
              Deleting here removes the local copy.
            </p>
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
