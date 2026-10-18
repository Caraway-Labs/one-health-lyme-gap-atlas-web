"use client";

import { Button } from "@/components/ui/button";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

type LiteraturePrompt = {
  id: string;
  label: string;
  question: string;
};

/** Four curated questions the reviewed-literature corpus can answer. */
const TRY_ASKING_PROMPTS: readonly LiteraturePrompt[] = [
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
  {
    id: "vectors_hosts",
    label:
      "What does reviewed evidence describe about Ixodes tick vectors and reservoir hosts for Lyme disease?",
    question:
      "What does reviewed evidence describe about Ixodes tick vectors and reservoir hosts for Lyme disease?",
  },
];

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
    <div className="ux-reset-ask-atlas-empty">
      <div className="ux-reset-ask-atlas-welcome">
        <h2>What would you like to explore?</h2>
        <p>
          Explore questions about Lyme disease and ticks in the reviewed
          literature.
        </p>
      </div>
      <section
        aria-labelledby="ask-atlas-prompts-label"
        className="chat-starter-prompts"
        data-testid="ask-atlas-try-asking"
      >
        <h2 id="ask-atlas-prompts-label">Try asking</h2>
        <ul className="chat-starter-prompts-list">
          {TRY_ASKING_PROMPTS.map((prompt) => (
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
      </section>
    </div>
  );
}
