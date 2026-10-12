import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const SIDEBAR_KEY_PREFIX = "atlas-sidebar-open";
const SidebarKeyContext = createContext(SIDEBAR_KEY_PREFIX);

function WithStorySidebarKey(
  Story: Parameters<Decorator>[0],
  context: Parameters<Decorator>[1]
) {
  const storageKey = useMemo(
    () => `${SIDEBAR_KEY_PREFIX}:${context.id}`,
    [context.id]
  );
  return (
    <SidebarKeyContext.Provider value={storageKey}>
      <Story />
    </SidebarKeyContext.Provider>
  );
}

const items = [
  ["Atlas Explorer", "/app/review"],
  ["Compare", "/app/compare"],
] as const;

export function SidebarStory({ startCollapsed }: { startCollapsed: boolean }) {
  return (
    <SidebarPreview
      key={String(startCollapsed)}
      startCollapsed={startCollapsed}
    />
  );
}

function SidebarPreview({ startCollapsed }: { startCollapsed: boolean }) {
  const storageKey = useContext(SidebarKeyContext);
  const [active, setActive] = useState("Atlas Explorer");
  useLayoutEffect(() => {
    window.localStorage.setItem(storageKey, startCollapsed ? "false" : "true");
  }, [startCollapsed, storageKey]);
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={!startCollapsed} storageKey={storageKey}>
        <div className="flex min-h-64">
          <Sidebar>
            <SidebarHeader>
              <b>Atlas</b>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {items.map(([label, href]) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      active={active === label}
                      href={href}
                      tooltip={label}
                      onClick={(event) => {
                        event.preventDefault();
                        setActive(label);
                      }}
                    >
                      <span className="sidebar-item-label">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="grid content-start gap-3 p-4">
            <SidebarTrigger tooltip="Hide navigation" type="button">
              Hide navigation
            </SidebarTrigger>
            <SidebarTrigger mobile mobileAction="open" type="button">
              Open navigation
            </SidebarTrigger>
            <p data-testid="sidebar-active">{`Active item ${active}`}</p>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

const meta = {
  title: "Navigation and layout/Sidebar",
  component: SidebarStory,
  excludeStories: ["SidebarStory"],
  args: { startCollapsed: false },
  decorators: [WithStorySidebarKey],
  parameters: {
    atlasLayout: "full",
    docs: {
      description: {
        component:
          "Purpose: the shared sidebar family, separate from the professional shell composition. Source: src/components/ui/sidebar.tsx. Limitations: links stay in this preview. Each story uses its own storage key. Tooltips name the same items as the buttons. Geography is not rendered here.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof SidebarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};
export const Collapsed: Story = { args: { startCollapsed: true } };
