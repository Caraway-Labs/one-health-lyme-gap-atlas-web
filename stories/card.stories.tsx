import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const meta = {
  title: "Primitives/Card",
  component: Card,
  args: { size: "default" },
  argTypes: { size: { control: "select", options: ["default", "sm"] } },
  parameters: {
    docs: {
      description: {
        component:
          "Information panel using production semantic colors, spacing and display typography. Content is illustrative, not a scientific finding.",
      },
    },
  },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>
          <h2 className="type-card">Evidence overview</h2>
        </CardTitle>
        <CardDescription>Illustrative component fixture</CardDescription>
      </CardHeader>
      <CardContent>
        Review source coverage and limitations before interpreting a result.
      </CardContent>
    </Card>
  ),
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Information: Story = {};
export const Compact: Story = { args: { size: "sm" } };
