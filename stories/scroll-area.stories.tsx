import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const counties = [
  "Autauga County",
  "Barbour County",
  "Bullock County",
  "Butler County",
  "Calhoun County",
  "Chambers County",
  "Cherokee County",
  "Choctaw County",
] as const;

function ScrollAreaStory({ rows }: { rows: number }) {
  const visible = counties.slice(0, rows);
  return (
    <div className="grid max-w-xs gap-3">
      <ScrollArea className="h-28 rounded-md border">
        <ul className="grid gap-1 p-2 text-sm">
          {visible.map((county, index) => (
            <li key={county}>
              {index > 0 ? <Separator className="mb-1" /> : null}
              {county}
            </li>
          ))}
        </ul>
      </ScrollArea>
      <div className="flex h-5 items-center gap-3 text-sm">
        <span>Period</span>
        <Separator orientation="vertical" />
        <span>Source</span>
      </div>
    </div>
  );
}

const meta = {
  title: "Primitives/Scroll area and Separator",
  component: ScrollAreaStory,
  args: { rows: counties.length },
  argTypes: {
    rows: { control: { max: counties.length, min: 1, type: "number" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: bounded scrolling regions and thin dividers. Source: src/components/ui/scroll-area.tsx and separator.tsx. Limitations: county names are synthetic. The viewport is keyboard focusable and Separator exposes its orientation.",
      },
    },
  },
} satisfies Meta<typeof ScrollAreaStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overflowing: Story = {};
export const Short: Story = { args: { rows: 2 } };
