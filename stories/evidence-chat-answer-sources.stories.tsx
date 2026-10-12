import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import type { KnowledgeChatResponse } from "@/generated/models";

import {
  corpusGapResponse,
  limitedCitationResponse,
  longCitationResponse,
  manyCitationsResponse,
  oneCitationResponse,
  unsafeCitationResponse,
} from "./fixtures/story-chat";

const sourcePresets = [
  "one",
  "many",
  "limited",
  "long",
  "unsafe",
  "nongrounded",
] as const;

type SourcePreset = (typeof sourcePresets)[number];

function responseFor(preset: SourcePreset): KnowledgeChatResponse {
  switch (preset) {
    case "one": {
      return oneCitationResponse();
    }
    case "many": {
      return manyCitationsResponse();
    }
    case "limited": {
      return limitedCitationResponse();
    }
    case "long": {
      return longCitationResponse();
    }
    case "unsafe": {
      return unsafeCitationResponse();
    }
    case "nongrounded": {
      return corpusGapResponse();
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function SourcesStory({ preset }: { preset: SourcePreset }) {
  const response = responseFor(preset);
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Synthetic citations. Unsafe URLs stay text. A nongrounded outcome has no
        source list.
      </p>
      <EvidenceChatAnswerSources response={response} />
      {preset === "nongrounded" ? (
        <p data-testid="sources-absent">No source list for this outcome.</p>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Ask Atlas/Answer sources",
  component: SourcesStory,
  args: { preset: "one" },
  argTypes: {
    preset: { control: "select", options: [...sourcePresets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: citations under a grounded literature answer. Source: src/components/evidence-chat-answer-sources.tsx. Limitations: titles, PMIDs, and URLs are synthetic. A non-PubMed URL renders as static text. Corpus-gap and other nongrounded outcomes render nothing.",
      },
    },
  },
} satisfies Meta<typeof SourcesStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneCitation: Story = {};
export const ManyCitations: Story = { args: { preset: "many" } };
export const Limited: Story = { args: { preset: "limited" } };
export const LongCitation: Story = { args: { preset: "long" } };
export const UnsafeUrl: Story = { args: { preset: "unsafe" } };
export const Nongrounded: Story = { args: { preset: "nongrounded" } };
