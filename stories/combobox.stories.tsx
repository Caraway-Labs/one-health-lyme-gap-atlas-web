import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

const counties = [
  "Autauga County, AL",
  "Barbour County, AL",
  "Bullock County, AL",
  "Butler County, AL",
  "Calhoun County, AL",
] as const;

function ComboboxStory({ showClear }: { showClear: boolean }) {
  return (
    <div className="max-w-xs">
      <Combobox items={counties}>
        <ComboboxInput
          aria-label="Synthetic county search"
          placeholder="Search counties"
          showClear={showClear}
        />
        <ComboboxContent>
          <ComboboxEmpty>No counties found.</ComboboxEmpty>
          <ComboboxList>
            {(county: string) => (
              <ComboboxItem key={county} value={county}>
                {county}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

const meta = {
  title: "Primitives/Combobox",
  component: ComboboxStory,
  args: { showClear: true },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: searchable single-choice picker (for example county search). Source: src/components/ui/combobox.tsx. Limitations: the county list is synthetic and local. Typing filters, arrow keys highlight, and Enter selects.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof ComboboxStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Searchable: Story = {};
export const WithoutClear: Story = { args: { showClear: false } };
