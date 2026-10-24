import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";
import type { KnowledgeClaim } from "@/generated/models/knowledgeClaim";
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

/** Citations a returned claim lists, in that claim's order. Missing ids are omitted. */
export function citationsForClaim(
  claim: KnowledgeClaim,
  citations: readonly KnowledgeCitation[]
): KnowledgeCitation[] {
  const byId = new Map(
    citations.map((citation) => [citation.citation_id, citation])
  );
  const ordered: KnowledgeCitation[] = [];
  for (const citationId of claim.citation_ids) {
    const citation = byId.get(citationId);
    if (citation) {
      ordered.push(citation);
    }
  }
  return ordered;
}
