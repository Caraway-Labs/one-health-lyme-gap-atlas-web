import { redirect } from "next/navigation";

import { assistantWorkspaceHref } from "@/lib/assistant-context-handoff";

interface LegacyKnowledgeGraphPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function legacySearchParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      search.set(key, value);
    }
  }
  return search;
}

export default async function LegacyKnowledgeGraphPage({
  searchParams,
}: LegacyKnowledgeGraphPageProps) {
  const params = await searchParams;
  const conversation =
    typeof params.conversation === "string" ? params.conversation : undefined;
  const href = assistantWorkspaceHref(
    "/assistant",
    legacySearchParams(params),
    {
      conversation,
    }
  );
  redirect(href);
}
