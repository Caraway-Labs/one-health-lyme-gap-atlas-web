import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { buildDataProvenanceCatalog } from "@/features/ux-reset/data-provenance/catalog";
import { DataProvenanceView } from "@/features/ux-reset/data-provenance/data-provenance-page";
import type { Indicator, Measure, Source } from "@/generated/models";

import "@/features/ux-reset/ux-reset.css";

function source(id: string, label: string): Source {
  return {
    dataset_id: `dataset-${id}`,
    label,
    limitations: [`${label} keeps its own coverage limits.`],
    lineage_source_id: `lineage-${id}`,
    publisher: "Illustrative publisher",
    release_version: "release-1",
    semantic_version: "semantic-1",
    source_id: id,
    source_url: "https://example.com/source",
    source_vintage: "2023",
  };
}

function indicator(id: string, domain: string): Indicator {
  return {
    definition: null,
    domain,
    indicator_id: id,
    label: id,
    measure_ids: [id],
    semantic_version: "semantic-1",
  };
}

function measure(id: string, indicatorId: string, sourceId: string): Measure {
  return {
    definition: "Illustrative measure definition for the story fixture.",
    indicator_id: indicatorId,
    label: id,
    measure_id: id,
    methodology: "Illustrative methodology narrative.",
    semantic_version: "semantic-1",
    source_ids: [sourceId],
    temporal_semantics: "Annual, distinct from the Atlas release time.",
  };
}

const releasedCatalog = buildDataProvenanceCatalog({
  indicators: [
    indicator("human_disease_burden", "human"),
    indicator("tick_surveillance", "vector"),
  ],
  measures: [
    measure("lyme_cases", "human_disease_burden", "cdc-lyme"),
    measure("tick_status", "tick_surveillance", "cdc-ticks"),
  ],
  sources: [
    source("cdc-lyme", "CDC Lyme surveillance"),
    source("cdc-ticks", "Tick establishment records"),
  ],
  indicatorsRead: "complete",
  measuresRead: "complete",
  sourcesIncomplete: false,
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function ProvenanceStory({
  catalog,
  loadState,
}: {
  catalog: typeof releasedCatalog | null;
  loadState: "error" | "loading" | "ready";
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataProvenanceView catalog={catalog} loadState={loadState} />
    </QueryClientProvider>
  );
}

const meta = {
  title: "Data and Evidence/Data provenance",
  component: ProvenanceStory,
  args: { catalog: releasedCatalog, loadState: "ready" },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: Data Provenance page for the current release catalog. Source: src/features/ux-reset/data-provenance/data-provenance-page.tsx. Limitations: the catalog is an illustrative fixture, not a live API response. Source type and description stay Not provided because the public source resource does not include those fields. Links use https://example.com. Use Enter or Space on a source summary to expand it.",
      },
    },
  },
} satisfies Meta<typeof ProvenanceStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReleasedSources: Story = {};

export const CatalogUnavailable: Story = {
  args: { catalog: null, loadState: "error" },
};

export const Loading: Story = {
  args: { catalog: null, loadState: "loading" },
};
