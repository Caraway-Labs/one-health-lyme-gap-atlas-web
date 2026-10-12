import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useLayoutEffect } from "react";

import { investigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import type { InvestigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";

import { actionBriefPreset } from "./fixtures/action-brief-presets";
import {
  setSyntheticPdfExportMode,
  syntheticPdfExportModes,
  type SyntheticPdfExportMode,
} from "./support/download-investigate-pdf-substitute";

import "@/features/ux-reset/ux-reset.css";

const pdfPresets = ["eligible", "omitted", "unavailable"] as const;

type PdfPreset = (typeof pdfPresets)[number];

function eligibleContext(): InvestigatePdfContext {
  const bundle = actionBriefPreset("ready").realBundle;
  if (!bundle) {
    throw new Error("Eligible PDF story requires the synthetic case bundle.");
  }
  return investigatePdfContext(bundle, "2023");
}

function pdfContext(preset: PdfPreset): InvestigatePdfContext {
  switch (preset) {
    case "eligible": {
      return eligibleContext();
    }
    case "omitted": {
      return {
        caveats: [],
        countyFips: "08001",
        included: [],
        observations: [],
        omitted: [
          {
            label: "Tree canopy cover",
            measureId: "tree-canopy",
            reason: "Unsupported evidence state.",
          },
        ],
        periods: [],
        releaseId: "alpha-2026",
        requestedPeriod: "2023",
        sources: [],
      };
    }
    case "unavailable": {
      return {
        caveats: [],
        countyFips: "08001",
        periods: [],
        releaseId: "alpha-2026",
        requestedPeriod: null,
        sources: [],
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function PdfExportStory({
  exportMode,
  preset,
}: {
  exportMode: SyntheticPdfExportMode;
  preset: PdfPreset;
}) {
  useLayoutEffect(() => {
    setSyntheticPdfExportMode(exportMode);
  }, [exportMode]);
  return (
    <div className="grid gap-3" key={`${preset}:${exportMode}`}>
      <p className="type-small">
        Synthetic county PDF for Adams County, Colorado (08001), release
        alpha-2026. Export does not download a file.
      </p>
      <InvestigatePdfExport context={pdfContext(preset)} />
    </div>
  );
}

const meta = {
  title: "County Investigation/Investigate PDF export",
  component: PdfExportStory,
  args: { exportMode: "succeed", preset: "eligible" },
  argTypes: {
    exportMode: {
      control: "select",
      options: [...syntheticPdfExportModes],
    },
    preset: { control: "select", options: [...pdfPresets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: county report offer for published measures. Source: src/features/ux-reset/investigate/investigate-pdf-export.tsx. Limitations: the eligible offer uses the synthetic Adams County case observation on release alpha-2026. Omitted and unavailable offers explain why no file is offered. Pending stays on Generating PDF until the story remounts. Failure shows the download error. The Storybook download substitute never saves a file.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof PdfExportStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Eligible: Story = {};
export const Omitted: Story = { args: { preset: "omitted" } };
export const Unavailable: Story = { args: { preset: "unavailable" } };
export const ExportPending: Story = { args: { exportMode: "pending" } };
export const ExportFailed: Story = { args: { exportMode: "fail" } };
