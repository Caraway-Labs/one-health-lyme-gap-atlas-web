import type { ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
 * Inline glossary term. The label is in the server HTML. Activating the
 * trigger opens the shared Popover so a keyboard user can Tab to the Glossary
 * link while the definition stays open.
 */
export function Term({ children, id }: TermProps) {
  const term = lookupGlossaryTerm(id);
  return (
    <span className="docs-term" data-glossary-term={term.id}>
      <Popover>
        <PopoverTrigger className="docs-term-trigger" type="button">
          {children ?? term.label}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={`${term.label} definition`}
          className="docs-term-panel w-auto"
          side="bottom"
        >
          <p className="m-0">
            <span className="docs-term-definition">
              <GlossaryText text={term.definition} />
            </span>{" "}
            <a href={`/docs/glossary#${term.id}`}>Glossary</a>
          </p>
        </PopoverContent>
      </Popover>
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
