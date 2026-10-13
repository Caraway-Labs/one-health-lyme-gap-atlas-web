"use client";

import { Button } from "@/components/ui/button";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

type LiteraturePrompt = {
  id: string;
  label: string;
  question: string;
};

const PRIMARY_PROMPTS: readonly LiteraturePrompt[] = [
  {
    id: "reporting_interpretation",
    label: "How should Lyme surveillance reporting be interpreted?",
    question: "How should Lyme surveillance reporting be interpreted?",
  },
  {
    id: "tick_surveillance_limits",
    label: "What can tick surveillance tell us?",
    question: "What can tick surveillance tell us?",
  },
  {
    id: "prevention_education",
    label: "What evidence supports prevention education?",
    question: "What evidence supports prevention education?",
  },
];

const MORE_PROMPTS: readonly LiteraturePrompt[] = [
  {
    id: "vectors_hosts",
    label:
      "What does reviewed evidence describe about Ixodes tick vectors and reservoir hosts for Lyme disease?",
    question:
      "What does reviewed evidence describe about Ixodes tick vectors and reservoir hosts for Lyme disease?",
  },
  {
    id: "diagnostics_literature",
    label:
      "What diagnostic or laboratory approaches appear in tick-borne disease surveillance literature?",
    question:
      "What diagnostic or laboratory approaches appear in tick-borne disease surveillance literature?",
  },
];

function PromptList({
  onSelect,
  prompts,
}: {
  onSelect: (question: string) => void;
  prompts: readonly LiteraturePrompt[];
}) {
  return (
    <ul className="chat-starter-prompts-list">
      {prompts.map((prompt) => (
        <li key={prompt.id}>
          <Button
            className="chat-starter-prompt-button"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onSelect(prompt.question)}
            {...analyticsControlAttributes("evidence_chat_starter_prompt")}
          >
            {prompt.label}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function AskAtlasLiteraturePrompts({
  onSelect,
  visible,
}: {
  onSelect: (question: string) => void;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <section
      aria-labelledby="ask-atlas-prompts-label"
      className="chat-starter-prompts"
    >
      <h2 id="ask-atlas-prompts-label">What would you like to understand?</h2>
      <p className="chat-starter-prompts-label">
        Start with your own question or adapt one below.
      </p>
      <PromptList onSelect={onSelect} prompts={PRIMARY_PROMPTS} />
      {/* Native disclosure: there is no shared Disclosure primitive. */}
      <details className="ux-reset-ask-atlas-more-topics">
        <summary>More research topics</summary>
        <PromptList onSelect={onSelect} prompts={MORE_PROMPTS} />
      </details>
    </section>
  );
}
