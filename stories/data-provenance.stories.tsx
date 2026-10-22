import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataProvenancePage } from "@/features/public-trust/data-provenance-page";

const meta = {
  title: "Data and Evidence/Data provenance",
  component: DataProvenancePage,
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: Public Data Provenance page. Source: src/lib/data-provenance-content.ts. Limitations: the catalog is the public source list, not a live API response. Use the evidence-type buttons to filter cards.",
      },
    },
  },
} satisfies Meta<typeof DataProvenancePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PublicCatalog: Story = {};
