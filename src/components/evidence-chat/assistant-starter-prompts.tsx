"use client";

import { Button } from "@/components/ui/button";
import { ASSISTANT_STARTER_PROMPTS } from "@/lib/assistant-starter-prompts";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import type { AssistantChatLayoutMode } from "./types";

export function AssistantStarterPrompts({
  mode,
  onSelect,
  visible,
}: {
  mode: AssistantChatLayoutMode;
  onSelect: (question: string) => void;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const labelId = `chat-starter-prompts-label-${mode}`;

  return (
    <section aria-labelledby={labelId} className="chat-starter-prompts">
      <p className="chat-starter-prompts-label" id={labelId}>
        Starter questions
      </p>
      <ul className="chat-starter-prompts-list">
        {ASSISTANT_STARTER_PROMPTS.map((prompt) => (
          <li key={prompt.id}>
            <Button
              className="chat-starter-prompt-button"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelect(prompt.question)}
              {...analyticsControlAttributes("evidence_chat_starter_prompt")}
            >
              {prompt.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
