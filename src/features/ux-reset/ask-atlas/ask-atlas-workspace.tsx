"use client";

import { useEffect } from "react";

import { EvidenceChatWorkspaceShell } from "@/components/evidence-chat/evidence-chat-layout-shell";
import { useEvidenceChat } from "@/components/evidence-chat/use-evidence-chat";
import { Badge } from "@/components/ui/badge";
import { AskAtlasLiteraturePrompts } from "@/features/ux-reset/ask-atlas/ask-atlas-literature-prompts";
import { AskAtlasUnavailableNotice } from "@/features/ux-reset/ask-atlas/ask-atlas-unavailable";
import { replaceObsoleteAskAtlasPageReference } from "@/features/ux-reset/ask-atlas/workspace-href";
import { isAtlasAssistantLiteratureEnabled } from "@/lib/assistant-entry-points";

const ASK_ATLAS_WORKSPACE_DISABLED_HEADING_ID =
  "ux-reset-ask-atlas-workspace-disabled-heading";

export function AskAtlasWorkspace({
  initialConversationId,
}: {
  initialConversationId?: string;
}) {
  const requestsEnabled = isAtlasAssistantLiteratureEnabled();
  useEffect(() => {
    replaceObsoleteAskAtlasPageReference();
  }, []);

  return (
    <div
      className="ux-reset-ask-atlas-workspace"
      data-testid="ask-atlas-workspace"
    >
      {requestsEnabled ? (
        <AskAtlasWorkspaceChat initialConversationId={initialConversationId} />
      ) : (
        <div className="ux-reset-ask-atlas-column">
          <header className="ux-reset-ask-atlas-heading">
            <h1>Ask Atlas</h1>
            <Badge variant="outline">Reviewed literature</Badge>
          </header>
          <p className="ux-reset-ask-atlas-intro">
            Explore reviewed research on Lyme disease and ticks.
          </p>
          <AskAtlasUnavailableNotice
            headingId={ASK_ATLAS_WORKSPACE_DISABLED_HEADING_ID}
          />
        </div>
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
  const handleSelectPrompt = (question: string) => {
    model.editQuestion(question);
  };
  return (
    <EvidenceChatWorkspaceShell
      emptyLead={
        <AskAtlasLiteraturePrompts
          onSelect={handleSelectPrompt}
          visible={model.showEmptyState}
        />
      }
      model={model}
      presentation="ask-atlas"
    />
  );
}
