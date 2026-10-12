import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Compass,
  FileText,
  GitCompare,
  LayoutDashboard,
  Map,
  Microscope,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";

export {
  ATLAS_EXPLORER_PATH,
  DOCS_PATH,
  RESET_ACTION_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
  RESET_EXPLORE_PATH,
  RESET_FEED_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
  RESET_SETTINGS_PATH,
  UX_RESET_APP_PREFIX as RESET_APP_PATH,
} from "@/features/ux-reset/routes";

import {
  ATLAS_EXPLORER_PATH,
  DOCS_PATH,
  RESET_ACTION_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
  RESET_EXPLORE_PATH,
  RESET_FEED_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_SETTINGS_PATH,
  UX_RESET_APP_PREFIX,
} from "@/features/ux-reset/routes";

export type ResetRouteMatch = "exact" | "prefix";

/** `alias` routes stay addressable for redirects and are not sidebar destinations. */
export type ResetNavGroup = "workspace" | "access" | "alias";

export type ResetRoute = {
  description: string;
  href: string;
  icon: LucideIcon;
  id: string;
  label: string;
  match: ResetRouteMatch;
  navGroup: ResetNavGroup;
  pageDescription: string;
  pageTitle: string;
  /** When set, navigation opens this href instead of an in-shell page. */
  externalHref?: string;
};

export const RESET_ROUTES: readonly ResetRoute[] = [
  {
    description:
      "Map, county evidence, and suggested follow-up for one governed release.",
    href: ATLAS_EXPLORER_PATH,
    icon: Map,
    id: "explorer",
    label: "Atlas Explorer",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Map-led review, expandable county evidence, and suggested follow-up. Not a separate Investigate or Action destination.",
    pageTitle: "Atlas Explorer | One Health Lyme Gap Atlas",
  },
  {
    description: "Compare two counties on aligned governed measures.",
    href: RESET_COMPARE_PATH,
    icon: GitCompare,
    id: "compare",
    label: "Compare",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Two-county evidence comparison with each measure's unit, period, and availability. Not a score ranking.",
    pageTitle: "Compare | One Health Lyme Gap Atlas",
  },
  {
    description: "Ask questions grounded in reviewed literature.",
    href: RESET_ASSISTANT_PATH,
    icon: Sparkles,
    id: "assistant",
    label: "Ask Atlas",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Dedicated answer-only workspace for reviewed-literature questions. Explorer and Compare can hand a validated page reference here and return to that page.",
    pageTitle: "Ask Atlas | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Authenticated professional workspace entry. Redirects to Atlas Explorer.",
    href: UX_RESET_APP_PREFIX,
    icon: LayoutDashboard,
    id: "overview",
    label: "Workspace overview",
    match: "exact",
    navGroup: "alias",
    pageDescription:
      "Authenticated professional workspace for the One Health Lyme Gap Atlas.",
    pageTitle: "Professional workspace | One Health Lyme Gap Atlas",
  },
  {
    description: "Alias for Atlas Explorer browse. Not a sidebar destination.",
    href: RESET_EXPLORE_PATH,
    icon: Compass,
    id: "explore",
    label: "Explore",
    match: "prefix",
    navGroup: "alias",
    pageDescription:
      "Map-led spatial discovery for governed measures, with the same values available without the map.",
    pageTitle: "Explore | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Alias for Atlas Explorer county evidence. Not a sidebar destination.",
    href: RESET_INVESTIGATE_PATH,
    icon: Microscope,
    id: "investigate",
    label: "Investigate",
    match: "prefix",
    navGroup: "alias",
    pageDescription:
      "Single-county workspace for governed evidence, limitations, and the return path to Atlas Explorer.",
    pageTitle: "Investigate | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Alias for Atlas Explorer suggested follow-up. Not a sidebar destination.",
    href: RESET_ACTION_PATH,
    icon: Zap,
    id: "action",
    label: "Action",
    match: "prefix",
    navGroup: "alias",
    pageDescription:
      "Bounded follow-up for one county's validated evidence. No intervention is started from this page.",
    pageTitle: "Action | One Health Lyme Gap Atlas",
  },
  {
    description: "Activity and updates across your professional workspace.",
    href: RESET_FEED_PATH,
    icon: Bell,
    id: "feed",
    label: "Feed",
    match: "prefix",
    navGroup: "access",
    pageDescription: "Placeholder for the professional Feed destination.",
    pageTitle: "Feed | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Default jurisdiction, optional profile details, and account controls.",
    href: RESET_SETTINGS_PATH,
    icon: Settings,
    id: "settings",
    label: "Settings",
    match: "prefix",
    navGroup: "access",
    pageDescription:
      "Save a national or state default for future Atlas Explorer sessions, plus optional profile details and account controls.",
    pageTitle: "Settings | One Health Lyme Gap Atlas",
  },
  {
    description: "Open the canonical Atlas documentation center.",
    externalHref: DOCS_PATH,
    href: DOCS_PATH,
    icon: FileText,
    id: "docs",
    label: "Docs",
    match: "prefix",
    navGroup: "access",
    pageDescription: "Documentation for the One Health Lyme Gap Atlas.",
    pageTitle: "Documentation | One Health Lyme Gap Atlas",
  },
] as const;

export const RESET_WORKSPACE_NAV = RESET_ROUTES.filter(
  (route) => route.navGroup === "workspace"
);

export const RESET_ACCESS_NAV = RESET_ROUTES.filter(
  (route) => route.navGroup === "access"
);

export function resetNavigationHref(route: ResetRoute): string {
  return route.externalHref ?? route.href;
}

export function isResetRouteActive(
  route: Pick<ResetRoute, "href" | "match">,
  pathname: string
): boolean {
  const normalized = pathname.split(/[?#]/, 1)[0] || "/";
  switch (route.match) {
    case "exact": {
      return normalized === route.href;
    }
    case "prefix": {
      return (
        normalized === route.href || normalized.startsWith(`${route.href}/`)
      );
    }
    default: {
      const exhaustive: never = route.match;
      return exhaustive;
    }
  }
}

export function findResetRoute(pathname: string): ResetRoute | undefined {
  return [...RESET_ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => isResetRouteActive(route, pathname));
}

export function resetRouteById(id: ResetRoute["id"]): ResetRoute {
  const route = RESET_ROUTES.find((candidate) => candidate.id === id);
  if (!route) {
    throw new Error(`No UX Reset route exists for id ${id}.`);
  }
  return route;
}

export function pageMetadataForResetRoute(id: ResetRoute["id"]): {
  description: string;
  title: string;
} {
  const route = resetRouteById(id);
  return {
    description: route.pageDescription,
    title: route.pageTitle,
  };
}
