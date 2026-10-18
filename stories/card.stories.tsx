import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ComposedCard() {
  const [noted, setNoted] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="type-card">Evidence overview</h2>
        </CardTitle>
        <CardDescription>Illustrative component fixture</CardDescription>
        <CardAction>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              setNoted(true);
            }}
          >
            Note limitation
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        Review source coverage and limitations before interpreting a result.
      </CardContent>
      <CardFooter>
        {noted
          ? "Limitation noted in this preview."
          : "Footer stays with the panel."}
      </CardFooter>
    </Card>
  );
}

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
export const Composed: Story = { render: () => <ComposedCard /> };
