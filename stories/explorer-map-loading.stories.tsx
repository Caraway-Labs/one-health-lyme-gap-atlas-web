import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";

import { ExplorerMapLoadingOverlay } from "@/features/ux-reset/review/explorer-map-loading-overlay";

import "@/features/ux-reset/ux-reset.css";

const meta = {
  title: "Atlas/Explorer map loading",
  component: ExplorerMapLoadingOverlay,
  args: {
    onRetry: () => {},
    view: "loading",
  },
  parameters: {
    docs: {
      description: {
        component:
          "Map-viewport unfolding loader. The rectangle stands in for a map that stays visible underneath. No live geography or score service is connected.",
      },
    },
  },
} satisfies Meta<typeof ExplorerMapLoadingOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

function Stage({
  children,
  motion,
  theme,
}: {
  children?: ReactNode;
  motion?: "full" | "reduced";
  theme?: "dark" | "light";
}) {
  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div
        className="ux-reset-explorer-map"
        style={{ maxWidth: 720, position: "relative" }}
      >
        <div className="map-wrap" style={{ height: 360 }}>
          <div
            aria-label="Placeholder map"
            className="explorer-map-surface"
            style={{
              background:
                "linear-gradient(160deg, #d7ebe3 0%, #f4f7f2 45%, #e7d3bf 100%)",
              height: "100%",
            }}
          />
          <ExplorerMapLoadingOverlay
            motion={motion}
            view="loading"
            onRetry={() => {}}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

export const OverExistingMap: Story = {
  render: () => <Stage />,
};

export const InitialViewport: Story = {
  render: () => (
    <div className="ux-reset-explorer-map" style={{ maxWidth: 720 }}>
      <div className="map-wrap" style={{ height: 360 }}>
        <ExplorerMapLoadingOverlay view="loading" onRetry={() => {}} />
      </div>
    </div>
  ),
};

export const ReducedMotion: Story = {
  render: () => <Stage motion="reduced" />,
};

export const Failure: Story = {
  args: { view: "error" },
  render: () => (
    <div className="ux-reset-explorer-map" style={{ maxWidth: 720 }}>
      <div className="map-wrap" style={{ height: 360 }}>
        <ExplorerMapLoadingOverlay view="error" onRetry={() => {}} />
      </div>
    </div>
  ),
};

export const DarkSurface: Story = {
  render: () => <Stage theme="dark" />,
};
