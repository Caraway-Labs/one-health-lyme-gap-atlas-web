import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const selectPresets = [
  "placeholder",
  "selected",
  "disabled",
  "disabled-item",
  "long",
] as const;

type SelectPreset = (typeof selectPresets)[number];

type StoryOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

const shortOptions: readonly StoryOption[] = [
  { label: "Adams County, Colorado", value: "08001" },
  { label: "Boulder County, Colorado", value: "08013" },
  { label: "District of Columbia", value: "11001" },
];

const longOptions: readonly StoryOption[] = [
  ...shortOptions,
  { label: "Albany County, New York", value: "36001" },
  { label: "Wake County, North Carolina", value: "37183" },
  { label: "King County, Washington", value: "53033" },
  { label: "Cook County, Illinois", value: "17031" },
  { label: "Fulton County, Georgia", value: "13121" },
  { label: "Maricopa County, Arizona", value: "04013" },
  { label: "Hennepin County, Minnesota", value: "27053" },
];

function optionsFor(preset: SelectPreset): readonly StoryOption[] {
  if (preset === "long") {
    return longOptions;
  }
  if (preset === "disabled-item") {
    return shortOptions.map((option, index) =>
      index === 0 ? { ...option, disabled: true } : option
    );
  }
  return shortOptions;
}

export function SelectStory({
  preset,
  size,
}: {
  preset: SelectPreset;
  size: "default" | "sm";
}) {
  return <SelectPreview key={preset} preset={preset} size={size} />;
}

function SelectPreview({
  preset,
  size,
}: {
  preset: SelectPreset;
  size: "default" | "sm";
}) {
  const options = optionsFor(preset);
  const [value, setValue] = useState<string | null>(
    preset === "placeholder" || preset === "disabled" ? null : "08013"
  );
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <div className="grid max-w-sm gap-3">
      <p className="type-small">
        Synthetic Select. Options are lower-48 counties and the District of
        Columbia. Changing the value stays in this preview.
      </p>
      <Select
        disabled={preset === "disabled"}
        onValueChange={(next) => {
          setValue(next);
        }}
        value={value}
      >
        <SelectTrigger aria-label="County" className="w-full" size={size}>
          <SelectValue placeholder="Choose a county">
            {selectedLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              disabled={option.disabled}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p data-testid="select-current">{`Selected ${value ?? "none"}`}</p>
    </div>
  );
}

const meta = {
  title: "Primitives/Select",
  component: SelectStory,
  excludeStories: ["SelectStory"],
  args: { preset: "placeholder", size: "default" },
  argTypes: {
    preset: { control: "select", options: [...selectPresets] },
    size: { control: "select", options: ["default", "sm"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: Base UI select used by workspace controls. Source: src/components/ui/select.tsx. Limitations: options are synthetic lower-48 counties and the District of Columbia. Disabled trigger and disabled item follow the primitive. Escape closes the popup. No profile or API write.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof SelectStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};
export const Selected: Story = { args: { preset: "selected" } };
export const Disabled: Story = { args: { preset: "disabled" } };
export const DisabledItem: Story = { args: { preset: "disabled-item" } };
export const LongList: Story = { args: { preset: "long", size: "sm" } };
