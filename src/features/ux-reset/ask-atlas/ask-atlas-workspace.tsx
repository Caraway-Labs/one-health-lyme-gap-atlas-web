"use client";

import { EvidenceChatWorkspaceShell } from "@/components/evidence-chat/evidence-chat-layout-shell";
import { useEvidenceChat } from "@/components/evidence-chat/use-evidence-chat";
import { Badge } from "@/components/ui/badge";
import { AskAtlasLiteraturePrompts } from "@/features/ux-reset/ask-atlas/ask-atlas-literature-prompts";
import { AskAtlasUnavailableNotice } from "@/features/ux-reset/ask-atlas/ask-atlas-unavailable";
import { AskAtlasPageReferenceStrip } from "@/features/ux-reset/ask-atlas/page-reference-strip";
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
      {requestsEnabled ? (
        <AskAtlasWorkspaceChat initialConversationId={initialConversationId} />
      ) : (
        <>
          <header className="ux-reset-ask-atlas-heading">
            <h1>Ask Atlas</h1>
            <Badge variant="outline">Reviewed literature</Badge>
          </header>
          <p className="ux-reset-ask-atlas-intro">
            Explore reviewed research on Lyme disease and ticks.
          </p>
          <AskAtlasPageReferenceStrip />
          <AskAtlasUnavailableNotice
            headingId={ASK_ATLAS_WORKSPACE_DISABLED_HEADING_ID}
          />
        </>
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
      leading={<AskAtlasPageReferenceStrip />}
      model={model}
      presentation="ask-atlas"
    />
  );
}
