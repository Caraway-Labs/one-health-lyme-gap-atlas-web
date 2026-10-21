import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const variants = ["default", "line"] as const;
type TabsVariant = (typeof variants)[number];

function TabsStory({ variant }: { variant: TabsVariant }) {
  return (
    <Tabs className="max-w-sm" defaultValue="shortlist">
      <TabsList aria-label="Synthetic explorer rail" variant={variant}>
        <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
        <TabsTrigger value="county">County</TabsTrigger>
      </TabsList>
      <TabsContent value="shortlist">
        Synthetic ranked counties for the selected state.
      </TabsContent>
      <TabsContent value="county">
        Synthetic selected-county summary and evidence.
      </TabsContent>
    </Tabs>
  );
}

const meta = {
  title: "Primitives/Tabs",
  component: TabsStory,
  args: { variant: "default" },
  argTypes: { variant: { control: "select", options: [...variants] } },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: switch between sibling panels in one place (for example Shortlist and County). Source: src/components/ui/tabs.tsx. Limitations: panel text is synthetic. Arrow keys move focus and Enter or Space selects. Use anchors for page navigation.",
      },
    },
  },
} satisfies Meta<typeof TabsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Line: Story = { args: { variant: "line" } };
