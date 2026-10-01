import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";

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

export function orderedAnswerCitations(
  response: KnowledgeChatResponse
): KnowledgeCitation[] {
  const citations = response.citations ?? [];
  if (citations.length === 0) {
    return [];
  }
  const byId = new Map(
    citations.map((citation) => [citation.citation_id, citation])
  );
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const claim of response.claims ?? []) {
    for (const citationId of claim.citation_ids) {
      if (seen.has(citationId) || !byId.has(citationId)) {
        continue;
      }
      seen.add(citationId);
      orderedIds.push(citationId);
    }
  }
  for (const citation of citations) {
    if (!seen.has(citation.citation_id)) {
      orderedIds.push(citation.citation_id);
    }
  }
  return orderedIds
    .map((citationId) => byId.get(citationId))
    .filter((citation): citation is KnowledgeCitation => citation !== undefined);
}
