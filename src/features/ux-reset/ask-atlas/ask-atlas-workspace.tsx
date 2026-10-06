"use client";

import { EvidenceChatWorkspaceShell } from "@/components/evidence-chat/evidence-chat-layout-shell";
import { useEvidenceChat } from "@/components/evidence-chat/use-evidence-chat";
import { AskAtlasUnavailableNotice } from "@/features/ux-reset/ask-atlas/ask-atlas-unavailable";
import { isAtlasAssistantLiteratureEnabled } from "@/lib/assistant-entry-points";

const ASK_ATLAS_WORKSPACE_DISABLED_HEADING_ID =
  "ux-reset-ask-atlas-workspace-disabled-heading";

export function AskAtlasWorkspace({
  initialConversationId,
}: {
  initialConversationId?: string;
}) {
  const requestsEnabled = isAtlasAssistantLiteratureEnabled();

  return (
    <div
      className="ux-reset-ask-atlas-workspace"
      data-testid="ask-atlas-workspace"
    >
      <header className="ux-reset-page-header">
        <p className="eyebrow">Ask Atlas</p>
        <h1>Assistant</h1>
        <p className="type-body">
          Ask a research question grounded in reviewed literature. Saved chats
          stay in this browser. Structured and Both modes are not available.
        </p>
      </header>
      {requestsEnabled ? (
        <AskAtlasWorkspaceChat initialConversationId={initialConversationId} />
      ) : (
        <AskAtlasUnavailableNotice
          headingId={ASK_ATLAS_WORKSPACE_DISABLED_HEADING_ID}
        />
      )}
    </div>
  );
}

function AskAtlasWorkspaceChat({
  initialConversationId,
}: {
  initialConversationId?: string;
}) {
  const model = useEvidenceChat({
    initialConversationId,
    mode: "workspace",
    requestsEnabled: true,
  });
  return <EvidenceChatWorkspaceShell headingLevel={2} model={model} />;
}
