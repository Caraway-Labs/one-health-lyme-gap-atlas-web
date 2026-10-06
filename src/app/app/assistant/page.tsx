import type { Metadata } from "next";

import { AskAtlasWorkspace } from "@/features/ux-reset/ask-atlas/ask-atlas-workspace";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";

export const metadata: Metadata = pageMetadataForResetRoute("assistant");

interface ResetAssistantPageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export default async function ResetAssistantPage({
  searchParams,
}: ResetAssistantPageProps) {
  const params = await searchParams;
  const selected =
    typeof params.conversation === "string" ? params.conversation : undefined;
  return <AskAtlasWorkspace initialConversationId={selected} />;
}
