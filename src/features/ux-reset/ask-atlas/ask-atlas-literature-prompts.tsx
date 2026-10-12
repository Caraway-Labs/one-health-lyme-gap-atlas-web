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
    label: "How should surveillance reporting be interpreted?",
    question:
      "What do peer-reviewed studies say about how Lyme disease surveillance reporting should be interpreted?",
  },
  {
    id: "tick_surveillance_limits",
    label: "What limits tick surveillance?",
    question:
      "What limitations do reviewed studies describe for tick surveillance?",
  },
  {
    id: "prevention_education",
    label: "What does prevention education research report?",
    question:
      "What does reviewed literature report about Lyme disease prevention education?",
  },
];

const MORE_PROMPTS: readonly LiteraturePrompt[] = [
  {
    id: "vectors_hosts",
    label: "Tick vectors and reservoir hosts",
    question:
      "What does reviewed evidence describe about Ixodes tick vectors and reservoir hosts for Lyme disease?",
  },
  {
    id: "diagnostics_literature",
    label: "Diagnostics in surveillance studies",
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
      <p className="chat-starter-prompts-label" id="ask-atlas-prompts-label">
        Ask a research question about reviewed literature. A prompt fills the
        question and is not sent until you choose Ask.
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
