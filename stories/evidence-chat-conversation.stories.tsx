import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Suspense } from "react";

import { EvidenceChatConversationContent } from "@/components/evidence-chat/evidence-chat-conversation-content";

import { corpusGapResponse } from "./fixtures/story-chat";
import {
  OUTCOME_MATRIX_STORY_PRESETS,
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
  ...OUTCOME_MATRIX_STORY_PRESETS,
] as const satisfies readonly StoryChatPreset[];

export function ConversationStory({ preset }: { preset: StoryChatPreset }) {
  return <ConversationPreview key={preset} preset={preset} />;
}

function ConversationPreview({ preset }: { preset: StoryChatPreset }) {
  const model = useStoryChatModel(preset, corpusGapResponse());
  return (
    <div className="grid gap-3">
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
  excludeStories: ["ConversationStory"],
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

// Autodocs renders every story in its own preview iframe, and the composer id
// check reads the first of those frames. Mounting one iframe per outcome keeps
// that primary preview on Storybook's preparing spinner until the assertion
// times out. These outcomes stay individual sidebar stories for the catalog.
function matrixStory(
  preset: (typeof OUTCOME_MATRIX_STORY_PRESETS)[number]
): Story {
  return {
    args: { preset },
    tags: ["!autodocs"],
  };
}

export const MatrixAnsweredSingleStudy: Story = matrixStory(
  "matrix-answered-single-study"
);
export const MatrixAnsweredLimited: Story = matrixStory(
  "matrix-answered-limited"
);
export const MatrixCorpusGap: Story = matrixStory("matrix-corpus-gap");
export const MatrixSafetyRefusal: Story = matrixStory("matrix-safety-refusal");
export const MatrixEvidenceUnavailable: Story = matrixStory(
  "matrix-evidence-unavailable"
);
export const MatrixCapacityLimited: Story = matrixStory(
  "matrix-capacity-limited"
);
export const MatrixTimeout: Story = matrixStory("matrix-timeout");
export const MatrixRateLimited: Story = matrixStory("matrix-rate-limited");
export const MatrixUnprocessable: Story = matrixStory("matrix-unprocessable");
export const MatrixNetwork: Story = matrixStory("matrix-network");
