import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type DisclosureKind = "collapsible" | "accordion";

function DisclosureStory({ kind }: { kind: DisclosureKind }) {
  if (kind === "accordion") {
    return (
      <Accordion className="max-w-sm">
        <AccordionItem value="method">
          <AccordionTrigger>Methodology</AccordionTrigger>
          <AccordionContent>Synthetic methodology text.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="limits">
          <AccordionTrigger>Limitations</AccordionTrigger>
          <AccordionContent>Synthetic limitation text.</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }
  return (
    <Collapsible className="max-w-sm">
      <CollapsibleTrigger render={<Button size="sm" variant="outline" />}>
        Scoring notes
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="type-small">
          Synthetic note. One collapsible replaces one native details element.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

const meta = {
  title: "Primitives/Collapsible and Accordion",
  component: DisclosureStory,
  args: { kind: "collapsible" },
  argTypes: {
    kind: { control: "select", options: ["collapsible", "accordion"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: progressive disclosure that replaces native details elements in the Explorer. Source: src/components/ui/collapsible.tsx and accordion.tsx. Limitations: text is synthetic. Triggers expose aria-expanded.",
      },
    },
  },
} satisfies Meta<typeof DisclosureStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleDisclosure: Story = {};
export const GroupedDisclosures: Story = { args: { kind: "accordion" } };
