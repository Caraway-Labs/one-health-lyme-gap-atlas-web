"use client";

import { ChatHistoryWorkspace } from "@/components/evidence-chat-history";

import { EvidenceChatConversationContent } from "./evidence-chat-conversation-content";
import type { EvidenceChatConversationModel } from "./use-evidence-chat";

export function EvidenceChatDrawerShell({
  model,
}: {
  model: EvidenceChatConversationModel;
}) {
  return (
    <div className="evidence-chat evidence-chat-drawer">
      <EvidenceChatConversationContent model={model} />
    </div>
  );
}

export function EvidenceChatWorkspaceShell({
  headingLevel = 1,
  model,
}: {
  headingLevel?: 1 | 2;
  model: EvidenceChatConversationModel;
}) {
  const { conversations, hasSavedConversations, active } = model;
  const workspaceClassName = [
    "evidence-chat",
    "evidence-chat-workspace",
    hasSavedConversations ? "" : "evidence-chat-workspace--no-history",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={workspaceClassName}>
      {hasSavedConversations && (
        <ChatHistoryWorkspace
          activeConversationId={active?.id}
          composerFocusRef={model.inputRef}
          conversations={conversations}
          mobileHistoryOpen={model.mobileHistoryOpen}
          mobileToggleRef={model.mobileHistoryToggleRef}
          onClearAll={() => {
            model.clearAllConversations();
          }}
          onDelete={(id) => {
            model.deleteOne(id);
          }}
          onMobileHistoryOpenChange={(open) => {
            model.setMobileHistoryOpen(open);
          }}
          onSelect={(id) => {
            model.selectConversation(id);
          }}
        />
      )}
      <EvidenceChatConversationContent
        headingLevel={headingLevel}
        model={model}
      />
    </div>
  );
}
