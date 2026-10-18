import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  ASK_ATLAS_INHERITED_FIELD_KEYS,
  type AskAtlasInheritedContext,
  type AskAtlasInheritedField,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import { InheritedContextNotice } from "@/features/ux-reset/ask-atlas/inherited-context-notice";

import "@/features/ux-reset/ux-reset.css";

const contextPresets = ["none", "partial", "complete", "long-label"] as const;

type ContextPreset = (typeof contextPresets)[number];

const LONG_GEOGRAPHY =
  "Adams County, Colorado, inside the synthetic North Carolina comparison label used only to show wrapping";

function validated(id: string, label: string): AskAtlasInheritedField {
  return { id, label, state: "validated" };
}

function absent(): AskAtlasInheritedField {
  return { state: "absent" };
}

function contextFor(preset: ContextPreset): AskAtlasInheritedContext | null {
  switch (preset) {
    case "none": {
      return null;
    }
    case "partial": {
      return {
        fields: {
          geography: validated("08001", "Adams County, Colorado"),
          measure: absent(),
          period: absent(),
          release: absent(),
          source: absent(),
        },
        surface: "investigate",
      };
    }
    case "complete": {
      return {
        fields: {
          geography: validated("08001", "Adams County, Colorado"),
          measure: validated("reported-cases", "Reported Lyme cases"),
          period: validated("2023", "2023"),
          release: validated("alpha-2026", "alpha-2026"),
          source: validated("cdc-cases", "CDC surveillance"),
        },
        surface: "investigate",
      };
    }
    case "long-label": {
      return {
        fields: {
          geography: validated("08001", LONG_GEOGRAPHY),
          measure: validated("reported-cases", "Reported Lyme cases"),
          period: validated("2023", "2023"),
          release: validated("alpha-2026", "alpha-2026"),
          source: validated("cdc-cases", "CDC surveillance"),
        },
        surface: "compare",
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function InheritedStory({ preset }: { preset: ContextPreset }) {
  const context = contextFor(preset);
  const validatedCount = context
    ? ASK_ATLAS_INHERITED_FIELD_KEYS.filter(
        (key) => context.fields[key].state === "validated"
      ).length
    : 0;
  return (
    <div className="grid max-w-sm gap-3">
      <p className="type-small">
        {`Synthetic inherited context. ${validatedCount} validated fields. This notice is not a citation and it is not retrieved by Ask Atlas.`}
      </p>
      <InheritedContextNotice context={context} />
    </div>
  );
}

const meta = {
  title: "Ask Atlas/Inherited context notice",
  component: InheritedStory,
  args: { preset: "partial" },
  argTypes: {
    preset: { control: "select", options: [...contextPresets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: show the validated page context Ask Atlas may inherit. Source: src/features/ux-reset/ask-atlas/inherited-context-notice.tsx. Limitations: fields are synthetic Adams County, Colorado (08001) and release alpha-2026. Absent fields stay Not validated on this page. None shows the empty sentence. The region scrolls from the keyboard.",
      },
    },
  },
} satisfies Meta<typeof InheritedStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const None: Story = { args: { preset: "none" } };
export const Partial: Story = {};
export const Complete: Story = { args: { preset: "complete" } };
export const LongLabel: Story = { args: { preset: "long-label" } };
