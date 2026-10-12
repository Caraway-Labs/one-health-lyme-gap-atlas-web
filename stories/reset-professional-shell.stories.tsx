import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { useLayoutEffect, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  RESET_ACCESS_NAV,
  RESET_WORKSPACE_NAV,
} from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

import { useDomClick } from "./support/use-dom-click";

import "@/features/ux-reset/ux-reset.css";

const shellRouteHrefs = [
  ...RESET_WORKSPACE_NAV.map((route) => route.href),
  ...RESET_ACCESS_NAV.filter((route) => !route.externalHref).map(
    (route) => route.href
  ),
];

type ShellStoryProps = {
  route: string;
  startCollapsed: boolean;
};

function pathnameFromHref(href: string): string {
  const [path] = href.split(/[?#]/, 1);
  return path || "/app";
}

function ShellStory({ route, startCollapsed }: ShellStoryProps) {
  return (
    <ShellFrame
      key={`${route}:${String(startCollapsed)}`}
      route={route}
      startCollapsed={startCollapsed}
    />
  );
}

function ShellFrame({ route, startCollapsed }: ShellStoryProps) {
  const [pathname, setPathname] = useState(route);
  useLayoutEffect(() => {
    window.localStorage.setItem(
      "ux-reset-pro-sidebar",
      startCollapsed ? "false" : "true"
    );
  }, [startCollapsed]);
  const frameRef = useDomClick((event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest("a");
    if (!anchor || anchor.target === "_blank") {
      return;
    }
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("http")) {
      return;
    }
    setPathname(pathnameFromHref(href));
  });
  return (
    <PathnameContext.Provider value={pathname}>
      <TooltipProvider>
        <div ref={frameRef}>
          <ResetProfessionalShell>
            <h1 className="sr-only">Reset professional shell</h1>
            <p>
              Synthetic workspace content for Adams County, Colorado (08001).
              Active catalog route: {pathname}. Navigation stays in this
              preview.
            </p>
          </ResetProfessionalShell>
        </div>
      </TooltipProvider>
    </PathnameContext.Provider>
  );
}

const meta = {
  title: "Navigation and Layout/Reset professional shell",
  component: ShellStory,
  args: { route: "/app/review", startCollapsed: false },
  argTypes: {
    route: { control: "select", options: shellRouteHrefs },
    startCollapsed: { control: "boolean" },
  },
  parameters: {
    atlasLandmark: "story",
    atlasLayout: "full",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/app/review", query: {} },
    },
    docs: {
      description: {
        component:
          "Purpose: authenticated professional workspace chrome. Source: src/features/ux-reset/professional-shell.tsx. Limitations: the route control and sidebar clicks update a local pathname substitute. They do not open the app. Ask Atlas is a catalog substitute with no chat request, sign-out, or feedback transport. Sidebar preference uses an isolated storage key cleared between stories. The brand mark is the approved raster, bundled for the project subpath. Use Hide navigation or Show navigation on desktop. On a narrow viewport, use Open navigation, then Escape, Close navigation, or Dismiss navigation. Autodocs keeps each shell in its own frame.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof ShellStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Review: Story = {};
export const WorkspaceOverview: Story = { args: { route: "/app" } };
export const Investigate: Story = { args: { route: "/app/investigate" } };
export const Collapsed: Story = { args: { startCollapsed: true } };
