import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";
import { classifyKnowledgeChatResponse } from "@/lib/ask-atlas-answer-contract";

export function safePubMedUrl(url: string, pmid: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "pubmed.ncbi.nlm.nih.gov" &&
      (parsed.pathname === `/${pmid}/` || parsed.pathname === `/${pmid}`) &&
      !parsed.search &&
      !parsed.hash
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

/** Citations for a grounded answer, in claim order. A mismatched response yields none. */
export function orderedAnswerCitations(
  response: KnowledgeChatResponse
): KnowledgeCitation[] {
  const decision = classifyKnowledgeChatResponse(response);
  if (decision.kind !== "grounded") {
    return [];
  }
  return decision.citations;
}
