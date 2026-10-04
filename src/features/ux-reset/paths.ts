import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Compass,
  FileText,
  GitCompare,
  LayoutDashboard,
  Microscope,
  Search,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";

export {
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
  DOCS_PATH,
  RESET_ACTION_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
  RESET_EXPLORE_PATH,
  RESET_FEED_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
  RESET_SETTINGS_PATH,
  UX_RESET_APP_PREFIX,
} from "@/features/ux-reset/routes";

export type ResetRouteMatch = "exact" | "prefix";

export type ResetNavGroup = "workspace" | "access";

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

export const LEGACY_ATLAS_PATH = "/" as const;

export const RETURN_TO_LEGACY_ATLAS_LABEL = "Open legacy Atlas";

export const RESET_ROUTES: readonly ResetRoute[] = [
  {
    description:
      "Start from surveillance review priorities and county follow-up.",
    href: UX_RESET_APP_PREFIX,
    icon: LayoutDashboard,
    id: "overview",
    label: "Workspace overview",
    match: "exact",
    navGroup: "workspace",
    pageDescription:
      "Authenticated professional workspace for the UX Reset program.",
    pageTitle: "Professional workspace | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Review county surveillance evidence and follow-up priorities.",
    href: RESET_REVIEW_PATH,
    icon: Search,
    id: "review",
    label: "Review",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Placeholder for the professional Review destination in the UX Reset workspace.",
    pageTitle: "Review | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Discover geographic patterns across governed measures before a county investigation.",
    href: RESET_EXPLORE_PATH,
    icon: Compass,
    id: "explore",
    label: "Explore",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Map-led spatial discovery for governed measures, with the same values available without the map.",
    pageTitle: "Explore | One Health Lyme Gap Atlas",
  },
  {
    description:
      "Read one county's evidence, uncertainty, context, and what to inspect next.",
    href: RESET_INVESTIGATE_PATH,
    icon: Microscope,
    id: "investigate",
    label: "Investigate",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Single-county workspace for governed evidence, limitations, and the return path to Review.",
    pageTitle: "Investigate | One Health Lyme Gap Atlas",
  },
  {
    description: "Compare counties and scoring assumptions side by side.",
    href: RESET_COMPARE_PATH,
    icon: GitCompare,
    id: "compare",
    label: "Compare",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Placeholder for the professional Compare destination in the UX Reset workspace.",
    pageTitle: "Compare | One Health Lyme Gap Atlas",
  },
  {
    description: "Turn findings into follow-up actions and outreach steps.",
    href: RESET_ACTION_PATH,
    icon: Zap,
    id: "action",
    label: "Action",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Placeholder for the professional Action destination in the UX Reset workspace.",
    pageTitle: "Action | One Health Lyme Gap Atlas",
  },
  {
    description: "Ask questions grounded in reviewed literature.",
    href: RESET_ASSISTANT_PATH,
    icon: Sparkles,
    id: "assistant",
    label: "Assistant",
    match: "prefix",
    navGroup: "workspace",
    pageDescription:
      "Placeholder for the professional Assistant destination in the UX Reset workspace.",
    pageTitle: "Assistant | One Health Lyme Gap Atlas",
  },
  {
    description: "Activity and updates across your professional workspace.",
    href: RESET_FEED_PATH,
    icon: Bell,
    id: "feed",
    label: "Feed",
    match: "prefix",
    navGroup: "access",
    pageDescription:
      "Placeholder for the professional Feed destination in the UX Reset workspace.",
    pageTitle: "Feed | One Health Lyme Gap Atlas",
  },
  {
    description: "Workspace preferences and account connections.",
    href: RESET_SETTINGS_PATH,
    icon: Settings,
    id: "settings",
    label: "Settings",
    match: "prefix",
    navGroup: "access",
    pageDescription:
      "Placeholder for workspace Settings in the UX Reset professional shell.",
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
