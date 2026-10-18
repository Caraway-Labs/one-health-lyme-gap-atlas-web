import type { Metadata } from "next";

import { AskAtlasWorkspace } from "@/features/ux-reset/ask-atlas/ask-atlas-workspace";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { RESET_ASSISTANT_PATH } from "@/features/ux-reset/routes";

export const metadata: Metadata = {
  ...pageMetadataForResetRoute("assistant"),
  alternates: { canonical: RESET_ASSISTANT_PATH },
  robots: { follow: false, index: false },
};

interface AskAtlasPageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export default async function AskAtlasPage({
  searchParams,
}: AskAtlasPageProps) {
  const params = await searchParams;
  const selected =
    typeof params.conversation === "string" ? params.conversation : undefined;
  return <AskAtlasWorkspace initialConversationId={selected} />;
}
