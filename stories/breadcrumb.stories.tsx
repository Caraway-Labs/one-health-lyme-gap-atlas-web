import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function BreadcrumbStory({ collapsed }: { collapsed: boolean }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#united-states">United States</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {collapsed ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink href="#alabama">Alabama</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>Bullock County</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

const meta = {
  title: "Primitives/Breadcrumb",
  component: BreadcrumbStory,
  args: { collapsed: false },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: geography readout (United States, state, county). Source: src/components/ui/breadcrumb.tsx. Limitations: links are in-page anchors in this preview. The last item is the current page and carries aria-current.",
      },
    },
  },
} satisfies Meta<typeof BreadcrumbStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const County: Story = {};
export const Collapsed: Story = { args: { collapsed: true } };
