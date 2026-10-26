import { useId, type ReactNode } from "react";

import {
  listGlossaryTerms,
  lookupGlossaryTerm,
  type GlossaryTerm,
} from "@/features/docs/glossary-terms";

type TermProps = {
  children?: ReactNode;
  id: string;
};

/** API sentences use Markdown code spans. Render those spans as code. */
function GlossaryText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /`(?<code>[^`]+)`/gu;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(
        <span key={`text-${index}`}>{text.slice(cursor, index)}</span>
      );
    }
    const code = match.groups?.code ?? "";
    nodes.push(<code key={`code-${index}`}>{code}</code>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    nodes.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
  }
  return nodes;
}

/**
 * Inline glossary term. The label and definition are in the server HTML, so
 * the control still reads as plain text when JavaScript is off. Hover, focus,
 * and tap show the definition through CSS; no client script is required.
 */
export function Term({ children, id }: TermProps) {
  const term = lookupGlossaryTerm(id);
  const descriptionId = useId();
  return (
    <span className="docs-term" data-glossary-term={term.id}>
      <button
        aria-describedby={descriptionId}
        className="docs-term-trigger"
        type="button"
      >
        {children ?? term.label}
      </button>
      <span className="docs-term-panel" id={descriptionId} role="tooltip">
        <span className="docs-term-definition">
          <GlossaryText text={term.definition} />
        </span>{" "}
        <a href={`/docs/glossary#${term.id}`} tabIndex={-1}>
          Glossary
        </a>
      </span>
    </span>
  );
}

function GlossaryHeading({ label }: { label: string }) {
  if (label === label.toLowerCase()) return <code>{label}</code>;
  return label;
}

export function GlossaryList() {
  const terms = listGlossaryTerms();
  return (
    <div className="docs-glossary">
      {terms.map((term) => (
        <GlossaryEntry key={term.id} term={term} />
      ))}
    </div>
  );
}

function GlossaryEntry({ term }: { term: GlossaryTerm }) {
  return (
    <section className="docs-glossary-term" id={term.id}>
      <h2>
        <GlossaryHeading label={term.label} />
      </h2>
      <p>
        <GlossaryText text={term.definition} />
      </p>
      <p>
        <a href={term.learnMoreHref}>{term.learnMoreLabel}</a>
      </p>
    </section>
  );
}
