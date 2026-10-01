import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";
import {
  orderedAnswerCitations,
  safePubMedUrl,
} from "@/lib/evidence-chat-sources";

const evidenceStrengthLabels: Partial<
  Record<KnowledgeChatResponse["evidence_state"], string>
> = {
  single_study: "Single-study evidence",
  consistent: "Consistent evidence",
  limited: "Limited evidence",
  mixed: "Mixed evidence",
  conflicting: "Conflicting evidence",
  insufficient_to_compare: "Insufficient evidence to compare",
};

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

export function EvidenceChatAnswerSources({
  response,
}: {
  response: KnowledgeChatResponse;
}) {
  if (response.status !== "answered") {
    return null;
  }

  const citations = orderedAnswerCitations(response);
  const strength = evidenceStrengthLabels[response.evidence_state];
  const sourceCountLabel =
    citations.length === 1
      ? "1 source for this answer"
      : `${citations.length} sources for this answer`;

  return (
    <section
      className="chat-answer-sources"
      aria-label="Sources for this answer"
      data-assistant-state="answered"
    >
      <div className="chat-answer-sources-heading">
        <p
          className="chat-answer-sources-count"
          id={`sources-${response.request_id}`}
        >
          {citations.length > 0
            ? sourceCountLabel
            : "Reviewed literature source"}
        </p>
      </div>
      <div className="chat-evidence-meta" aria-label="Evidence details">
        <span>Source: Literature evidence</span>
        {strength ? <span>Evidence: {strength}</span> : null}
      </div>
      {citations.length > 0 ? (
        <ol
          className="citation-list"
          aria-labelledby={`sources-${response.request_id}`}
        >
          {citations.map((citation, citationIndex) => (
            <CitationRow
              citation={citation}
              index={citationIndex + 1}
              key={citation.citation_id}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
