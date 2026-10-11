import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { type ComponentProps, useId } from "react";

import { Input } from "@/components/ui/input";

function InputExample(args: ComponentProps<typeof Input>) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  return (
    <div className="grid gap-2">
      <label htmlFor={inputId}>Geography</label>
      <Input {...args} id={inputId} aria-describedby={helpId} />
      <p id={helpId} className="text-muted-foreground text-sm">
        {args["aria-invalid"]
          ? "Enter a geography to continue (example validation)."
          : "Local demonstration only; no data is submitted."}
      </p>
    </div>
  );
}

const meta = {
  title: "Primitives/Input",
  component: Input,
  args: {
    placeholder: "Enter a geography",
    disabled: false,
    "aria-invalid": false,
  },
  argTypes: { "aria-invalid": { control: "boolean" } },
  parameters: {
    docs: {
      description: {
        component:
          "Labeled, editable local input. No searches or requests are sent. Controls expose disabled and validation states.",
      },
    },
  },
  render: (args) => <InputExample {...args} />,
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = {};
export const Invalid: Story = { args: { "aria-invalid": true } };
export const Disabled: Story = { args: { disabled: true } };
