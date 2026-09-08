import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  ChartNoAxesCombined,
  Compass,
  Map,
  PanelsTopLeft,
  Route,
  Scale,
  TableProperties,
} from "lucide-react";

export type NavigationGroupId = "explore" | "intelligence" | "research";

export type NavigationItem = {
  description: string;
  group: NavigationGroupId;
  href: string;
  icon: LucideIcon;
  label: string;
  match: "exact" | "prefix";
  requiresFeature?: "knowledgeGraph";
};

export const NAVIGATION_GROUPS: ReadonlyArray<{
  id: NavigationGroupId;
  label: string;
}> = [
  { id: "explore", label: "Explore" },
  { id: "intelligence", label: "Intelligence" },
  { id: "research", label: "Research" },
];

/**
 * Atlas primary-navigation contract.
 *
 * This intentionally represents user workflows, not source systems. Local
 * filters, tabs, score controls, and in-page anchors remain contextual
 * navigation and must not be duplicated here.
 */
export const NAVIGATION_ITEMS: ReadonlyArray<NavigationItem> = [
  {
    description: "Start a county surveillance review.",
    group: "explore",
    href: "/",
    icon: Compass,
    label: "Atlas overview",
    match: "exact",
  },
  {
    description: "Explore linked map, table, chart, and evidence views.",
    group: "explore",
    href: "/geographic_explorer",
    icon: Map,
    label: "Geographic Explorer",
    match: "exact",
  },
  {
    description: "Compare county-review workflow prototypes.",
    group: "intelligence",
    href: "/variant_1",
    icon: PanelsTopLeft,
    label: "County review",
    match: "exact",
  },
  {
    description: "Step through a guided county review.",
    group: "intelligence",
    href: "/variant_2",
    icon: Route,
    label: "Guided review",
    match: "exact",
  },
  {
    description: "Review county evidence in a multi-pane workspace.",
    group: "intelligence",
    href: "/variant_3",
    icon: TableProperties,
    label: "Evidence workspace",
    match: "exact",
  },
  {
    description: "Understand the follow-up-priority score.",
    group: "intelligence",
    href: "/variant_4",
    icon: ChartNoAxesCombined,
    label: "Score explained",
    match: "exact",
  },
  {
    description: "Compare two counties before deciding what to investigate.",
    group: "intelligence",
    href: "/variant_5",
    icon: Scale,
    label: "County comparison",
    match: "exact",
  },
  {
    description: "Use the widest available county evidence workspace.",
    group: "intelligence",
    href: "/variant_6",
    icon: PanelsTopLeft,
    label: "Wide workspace",
    match: "exact",
  },
  {
    description: "Ask questions grounded in reviewed literature.",
    group: "research",
    href: "/knowledge-graph",
    icon: BookOpenText,
    label: "Evidence library",
    match: "prefix",
    requiresFeature: "knowledgeGraph",
  },
];

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  return item.match === "exact"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function navigationItemsForGroup(group: NavigationGroupId, knowledgeGraphEnabled: boolean): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => item.group === group && (!item.requiresFeature || knowledgeGraphEnabled));
}
