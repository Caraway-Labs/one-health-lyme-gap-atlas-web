import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { AssistantOutcome } from "@/components/evidence-chat/assistant-outcome";
import type { KnowledgeChatResponse } from "@/generated/models";

import {
  answeredQuietResponse,
  capacityResponse,
  corpusGapResponse,
  refusalResponse,
  serviceUnavailableResponse,
  STORY_CHAT_QUESTION,
} from "./fixtures/story-chat";

const outcomePresets = [
  "corpus",
  "unavailable",
  "capacity",
  "refusal",
  "pending",
  "answered",
] as const;

type OutcomePreset = (typeof outcomePresets)[number];

function responseFor(preset: OutcomePreset): KnowledgeChatResponse {
  switch (preset) {
    case "corpus": {
      return corpusGapResponse();
    }
    case "unavailable":
    case "pending": {
      return serviceUnavailableResponse();
    }
    case "capacity": {
      return capacityResponse();
    }
    case "refusal": {
      return refusalResponse();
    }
    case "answered": {
      return answeredQuietResponse();
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function OutcomeStory({ preset }: { preset: OutcomePreset }) {
  const [action, setAction] = useState("No local action yet.");
  const pending = preset === "pending";
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Synthetic assistant outcome. Edit and retry stay in this preview.
      </p>
      <p data-testid="outcome-action">{action}</p>
      <AssistantOutcome
        actionable
        onEditQuestion={(question) => {
          setAction(`Editing: ${question}`);
        }}
        onRetry={(question) => {
          setAction(`Retried: ${question}`);
        }}
        pending={pending}
        question={STORY_CHAT_QUESTION}
        response={responseFor(preset)}
      />
      {preset === "answered" ? (
        <p>Answered outcomes render no extra panel.</p>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Ask Atlas/Assistant outcome",
  component: OutcomeStory,
  excludeStories: ["OutcomeStory"],
  args: { preset: "corpus" },
  argTypes: {
    preset: { control: "select", options: [...outcomePresets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: corpus absence, service failure, capacity, and refusal. Source: src/components/evidence-chat/assistant-outcome.tsx. Limitations: copy is driven by a synthetic response. An answered response renders nothing. Pending disables retry. No chat service is called.",
      },
    },
  },
} satisfies Meta<typeof OutcomeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CorpusAbsence: Story = {};
export const ServiceUnavailable: Story = { args: { preset: "unavailable" } };
export const Capacity: Story = { args: { preset: "capacity" } };
export const Refusal: Story = { args: { preset: "refusal" } };
export const PendingRetry: Story = { args: { preset: "pending" } };
export const Answered: Story = { args: { preset: "answered" } };
