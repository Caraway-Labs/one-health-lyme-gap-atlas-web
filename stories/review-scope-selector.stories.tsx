import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import { ReviewScopeSelector } from "@/features/ux-reset/review/review-scope-selector";

import { storyReleaseStates } from "./fixtures/story-states";

import "@/features/ux-reset/ux-reset.css";

const scopePresets = [
  "national",
  "colorado",
  "long-label",
  "unlisted",
] as const;

type ScopePreset = (typeof scopePresets)[number];

function initialScope(preset: ScopePreset): ReviewScope {
  switch (preset) {
    case "national": {
      return "ALL";
    }
    case "colorado": {
      return "CO";
    }
    case "long-label": {
      return "DC";
    }
    case "unlisted": {
      return "WY";
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function ScopeStory({ preset }: { preset: ScopePreset }) {
  return <ScopePreview key={preset} preset={preset} />;
}

function ScopePreview({ preset }: { preset: ScopePreset }) {
  const [scope, setScope] = useState<ReviewScope>(initialScope(preset));
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Synthetic Review scope. Options are lower-48 states and the District of
        Columbia. Selecting a state does not write a profile or call the API.
      </p>
      <ReviewScopeSelector
        onScopeChange={setScope}
        scope={scope}
        stateOptions={storyReleaseStates}
      />
      <p data-testid="review-scope-selected">{`Selected scope ${scope}`}</p>
    </div>
  );
}

const meta = {
  title: "Review/Scope selector",
  component: ScopeStory,
  excludeStories: ["ScopeStory"],
  args: { preset: "national" },
  argTypes: {
    preset: { control: "select", options: [...scopePresets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: choose United States or one supported state for Review. Source: src/features/ux-reset/review/review-scope-selector.tsx. Limitations: options are synthetic Colorado, New York, North Carolina, and the District of Columbia. The long-label preset starts on District of Columbia. An unlisted lower-48 code such as WY renders as the raw code. Alaska and Hawaii are not options. Changing the preset remounts the controlled scope. The control does not write a profile.",
      },
    },
  },
} satisfies Meta<typeof ScopeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const National: Story = {};
export const Colorado: Story = { args: { preset: "colorado" } };
export const LongLabel: Story = { args: { preset: "long-label" } };
export const Unlisted: Story = { args: { preset: "unlisted" } };
