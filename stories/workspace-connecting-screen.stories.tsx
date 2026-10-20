import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  WorkspaceConnectingScreen,
  WorkspaceReadinessRecovery,
} from "@/features/ux-reset/workspace-connecting-screen";

const meta = {
  title: "Atlas/Workspace connecting",
  component: WorkspaceConnectingScreen,
  parameters: {
    atlasLandmark: "story",
    atlasLayout: "full",
    docs: {
      description: {
        component:
          "Initial session and workspace transition. Map loading stays in the map viewport. Failure stories are the actionable recovery states, with no live auth.",
      },
    },
  },
} satisfies Meta<typeof WorkspaceConnectingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: { delayMs: 0 },
};

export const Delayed: Story = {
  args: { delayMs: 450 },
};

export const ReducedMotion: Story = {
  args: { delayMs: 0, motion: "reduced" },
};

export const ProfileFailure: Story = {
  render: () => <WorkspaceReadinessRecovery kind="error" />,
};

export const SessionRejected: Story = {
  render: () => (
    <WorkspaceReadinessRecovery
      kind="session-rejected"
      signInHref="/auth/sign-in"
    />
  ),
};
