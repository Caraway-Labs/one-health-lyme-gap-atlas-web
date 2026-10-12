import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Suspense } from "react";

import { EvidenceChatConversationContent } from "@/components/evidence-chat/evidence-chat-conversation-content";

import { corpusGapResponse } from "./fixtures/story-chat";
import {
  useStoryChatModel,
  type StoryChatPreset,
} from "./support/story-chat-model";

const presets = [
  "empty",
  "grounded",
  "pending",
  "structured-outcome",
  "client-failure",
  "near-limit",
] as const satisfies readonly StoryChatPreset[];

function ConversationStory({ preset }: { preset: StoryChatPreset }) {
  const model = useStoryChatModel(preset, corpusGapResponse());
  return (
    <div className="grid gap-3" key={preset}>
      <p className="type-small" data-testid="chat-story-notice">
        Synthetic literature preview. No evidence service is called. The local
        note is not saved.
      </p>
      <p data-testid="chat-story-action">{model.action}</p>
      <Suspense fallback={null}>
        <EvidenceChatConversationContent
          headingLevel={2}
          model={model}
          showCountyNotice={false}
          showWorkspaceHandoff={false}
        />
      </Suspense>
    </div>
  );
}

const meta = {
  title: "Ask Atlas/Evidence chat conversation",
  component: ConversationStory,
  args: { preset: "empty" },
  argTypes: {
    preset: { control: "select", options: [...presets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: evidence-chat transcript, composer, starter prompts, and local failure. Source: src/components/evidence-chat/evidence-chat-conversation-content.tsx. Limitations: the model is a Storybook substitute. It does not call the knowledge-graph chat hook or /v1/. Answers, citations, and the near-limit draft are synthetic. County context is omitted so no metadata request runs.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof ConversationStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Grounded: Story = { args: { preset: "grounded" } };
export const Pending: Story = { args: { preset: "pending" } };
export const StructuredOutcome: Story = {
  args: { preset: "structured-outcome" },
};
export const ClientFailure: Story = { args: { preset: "client-failure" } };
export const NearLimit: Story = { args: { preset: "near-limit" } };
