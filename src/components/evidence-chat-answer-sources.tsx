import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";
import type { KnowledgeClaim } from "@/generated/models/knowledgeClaim";
import { classifyKnowledgeChatResponse } from "@/lib/ask-atlas-answer-contract";
import { citationsForClaim, safePubMedUrl } from "@/lib/evidence-chat-sources";

function CitationRow({
  citation,
  index,
}: {
  citation: KnowledgeCitation;
  index: number;
}) {
  const href = safePubMedUrl(citation.pubmed_url, citation.pmid);
  const identifierParts = [`PMID ${citation.pmid}`];
  if (citation.source_label) {
    identifierParts.push(citation.source_label);
  }

  return (
    <li className="citation-item">
      <div className="citation-item-index" aria-hidden="true">
        {index}
      </div>
      <div className="citation-item-body">
        {href ? (
          <a
            className="citation-source-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="citation-source-title">{citation.title}</span>
            <span className="citation-source-identifier">
              {identifierParts.join(" · ")}
            </span>
            <span className="citation-source-action">Open on PubMed</span>
          </a>
        ) : (
          <div className="citation-source-static">
            <span className="citation-source-title">{citation.title}</span>
            <span className="citation-source-identifier">
              {identifierParts.join(" · ")}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function ClaimBlock({
  citations,
  claim,
}: {
  citations: readonly KnowledgeCitation[];
  claim: KnowledgeClaim;
}) {
  const claimCitations = citationsForClaim(claim, citations);
  return (
    <li className="chat-claim" data-claim-id={claim.claim_id}>
      <p>{claim.text}</p>
      {claimCitations.length > 0 ? (
        <ol className="citation-list" aria-label="Sources for this claim">
          {claimCitations.map((citation, citationIndex) => (
            <CitationRow
              citation={citation}
              index={citationIndex + 1}
              key={citation.citation_id}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function EvidenceChatAnswerSources({
  response,
}: {
  response: KnowledgeChatResponse;
}) {
  const decision = classifyKnowledgeChatResponse(response);
  if (decision.kind !== "grounded") {
    return null;
  }

  const { citations } = decision;
  const claims = response.claims ?? [];
  const sourceCountLabel =
    citations.length === 1
      ? "1 source for this answer"
      : `${citations.length} sources for this answer`;

  return (
    <section
      className="chat-answer-sources"
      aria-label="Answer and sources"
      data-assistant-state="answered"
      data-evidence-state={decision.evidenceState}
      data-source-used={decision.sourceUsed}
    >
      <div className="chat-answer-sources-heading">
        <p
          className="chat-answer-sources-count"
          id={`sources-${response.request_id}`}
        >
          {sourceCountLabel}
        </p>
      </div>
      <div className="chat-evidence-meta" aria-label="Evidence details">
        <span>Source: {decision.sourceLabel}</span>
        <span>Evidence: {decision.evidenceLabel}</span>
      </div>
      {decision.evidenceDetail ? (
        <p className="chat-evidence-scope">{decision.evidenceDetail}</p>
      ) : null}
      {claims.length > 0 ? (
        <ol className="chat-claim-list">
          {claims.map((claim) => (
            <ClaimBlock
              citations={citations}
              claim={claim}
              key={claim.claim_id}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
