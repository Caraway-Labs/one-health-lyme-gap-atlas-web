"use client";

import {
  EvidenceChatDrawerShell,
  EvidenceChatWorkspaceShell,
} from "@/components/evidence-chat/evidence-chat-layout-shell";
import type { EvidenceChatProps } from "@/components/evidence-chat/types";
import { useEvidenceChat } from "@/components/evidence-chat/use-evidence-chat";

export type { EvidenceChatProps } from "@/components/evidence-chat/types";

export function EvidenceChat({
  mode = "workspace",
  initialConversationId,
}: EvidenceChatProps) {
  const model = useEvidenceChat({ initialConversationId, mode });
  if (mode === "drawer") {
    return <EvidenceChatDrawerShell model={model} />;
  }
  return <EvidenceChatWorkspaceShell model={model} />;
}
