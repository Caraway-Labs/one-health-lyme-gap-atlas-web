import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Compass,
  FileText,
  Map,
  Microscope,
  UserCircle,
} from "lucide-react";

import {
  ABOUT_CARAWAY_LABS_PATH,
  ATLAS_EXPLORER_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
} from "@/features/ux-reset/routes";

export type NavigationGroupId = "explore" | "research" | "reference";
export type NavigationStatus = "available" | "inDevelopment" | "hidden";
export type NavigationPlacement = "sidebar" | "utility" | "footer" | "none";
export type RouteShell = "analytical" | "public" | "docs" | "none";
export type NavigationMatch = "exact" | "prefix" | "dynamic" | "none";
export type NavigationCapability = "assistantDemo" | "knowledgeGraph";

export type RouteMetadata = {
  auth?: "optional" | "required";
  description: string;
  external?: boolean;
  group?: NavigationGroupId;
  href: string;
  icon?: LucideIcon;
  id: string;
  label: string;
  match: NavigationMatch;
  pageDescription: string;
  pageTitle: string;
  placement: NavigationPlacement;
  requiresFeature?: NavigationCapability;
  shell: RouteShell;
  status: NavigationStatus;
};

/** Analytical county overview. The public root is the Front Porch, not this workspace. */
export const ATLAS_OVERVIEW_PATH = "/overview" as const;

export const NAVIGATION_STATUS_LABELS: Record<NavigationStatus, string> = {
  available: "Available",
  hidden: "Hidden",
  inDevelopment: "Coming Soon",
};

export const NAVIGATION_GROUPS: readonly {
  id: NavigationGroupId;
  label: string;
}[] = [
  { id: "explore", label: "Explore" },
  { id: "research", label: "Research" },
  { id: "reference", label: "Reference" },
];

/**
 * Atlas route and navigation contract.
 *
 * This is the only source for route labels, status, shell placement, and
 * active matching. It represents epidemiologist workflows rather than source
 * systems. Local filters, tabs, score controls, map controls, and in-page
 * anchors remain contextual navigation.
 */
export const ATLAS_ROUTES: readonly RouteMetadata[] = [
  {
    description:
      "Public introduction to One Health Atlas for public health professionals.",
    href: "/",
    id: "front-porch",
    label: "One Health Atlas",
    match: "exact",
    pageDescription:
      "Human health, vectors, and environmental conditions each reveal part of the picture. One Health Atlas helps public health professionals connect those perspectives and decide what deserves a closer look.",
    pageTitle: "One Health Atlas",
    placement: "none",
    shell: "none",
    status: "available",
  },
  {
    description: "Start a county surveillance review.",
    group: "explore",
    href: ATLAS_OVERVIEW_PATH,
    icon: Compass,
    id: "overview",
    label: "Atlas overview",
    match: "exact",
    pageDescription:
      "Explore public Lyme surveillance evidence and county follow-up priorities.",
    pageTitle: "Overview | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "analytical",
    status: "available",
  },
  {
    description: "Explore linked map, table, chart, and evidence views.",
    group: "explore",
    href: "/geographic_explorer",
    icon: Map,
    id: "geographic-explorer",
    label: "Geographic Explorer",
    match: "exact",
    pageDescription:
      "Explore county-level Lyme surveillance evidence through linked geographic and non-map views.",
    pageTitle: "Geographic Explorer | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "analytical",
    status: "available",
  },
  {
    description:
      "Investigate a county with the map, evidence, and scoring assumptions together.",
    group: "explore",
    href: "/investigate",
    icon: Microscope,
    id: "investigation-workspace",
    label: "Investigation Workspace",
    match: "exact",
    pageDescription:
      "Use the expanded workspace to keep county selection, the map, and evidence in view while you investigate.",
    pageTitle: "Investigation Workspace | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "analytical",
    status: "available",
  },
  {
    description: "Ask questions grounded in reviewed literature.",
    group: "research",
    href: "/assistant",
    icon: BookOpenText,
    id: "assistant",
    label: "Atlas Assistant",
    match: "exact",
    pageDescription:
      "Ask literature questions grounded in reviewed PubMed and PMC Open Access evidence.",
    pageTitle: "Atlas Assistant | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "analytical",
    status: "inDevelopment",
  },
  {
    description: "Legacy Assistant deep link.",
    href: "/knowledge-graph",
    id: "evidence-library-legacy",
    label: "Atlas Assistant redirect",
    match: "prefix",
    pageDescription: "Redirects to the Atlas Assistant.",
    pageTitle: "Atlas Assistant | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "analytical",
    status: "hidden",
  },
  {
    description: "Open the canonical Atlas documentation center.",
    external: true,
    group: "reference",
    href: "/docs",
    icon: FileText,
    id: "docs",
    label: "Docs",
    match: "prefix",
    pageDescription:
      "Guidance for understanding and using the One Health Lyme Gap Atlas.",
    pageTitle: "Documentation | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "docs",
    status: "available",
  },
  {
    auth: "optional",
    description: "Manage an optional Atlas profile.",
    href: "/account",
    icon: UserCircle,
    id: "account",
    label: "Account",
    match: "prefix",
    pageDescription: "Manage your optional One Health Lyme Gap Atlas profile.",
    pageTitle: "Account | One Health Lyme Gap Atlas",
    placement: "utility",
    shell: "analytical",
    status: "available",
  },
  {
    description: "Read the Atlas privacy commitments and choices.",
    href: "/privacy",
    id: "privacy",
    label: "Privacy",
    match: "exact",
    pageDescription:
      "How One Health Lyme Gap Atlas handles user data and privacy choices.",
    pageTitle: "Privacy | One Health Lyme Gap Atlas",
    placement: "footer",
    shell: "public",
    status: "available",
  },
  {
    description: "Read how Atlas approaches AI, evidence, and accountability.",
    external: true,
    href: "/ai-ethics",
    id: "ai-ethics",
    label: "AI Ethics",
    match: "exact",
    pageDescription:
      "How One Health Lyme Gap Atlas uses AI today, the evidence boundaries it follows, and the commitments still being decided.",
    pageTitle: "AI Ethics | One Health Lyme Gap Atlas",
    placement: "footer",
    shell: "public",
    status: "available",
  },
  {
    description: "Read who builds One Health Atlas and why the project exists.",
    href: ABOUT_CARAWAY_LABS_PATH,
    id: "about-caraway-labs",
    label: "About Caraway Labs",
    match: "exact",
    pageDescription:
      "Caraway Labs develops software for informed decisions. One Health Atlas helps public-health professionals investigate vector-borne disease evidence, starting with Lyme disease.",
    pageTitle: "About Caraway Labs | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "public",
    status: "available",
  },
  {
    description:
      "Authentication entry point for the optional account experience.",
    href: "/auth/sign-in",
    id: "auth-sign-in",
    label: "Sign in",
    match: "prefix",
    pageDescription:
      "Sign in to use the Atlas workspace and keep your starting view.",
    pageTitle: "Sign in or create an account | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "analytical",
    status: "hidden",
  },
  {
    description: "Internal design-system reference gallery.",
    href: "/design-system",
    id: "design-system",
    label: "Design system",
    match: "prefix",
    pageDescription: "Internal Atlas design-system reference gallery.",
    pageTitle: "Design system | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    auth: "required",
    description:
      "Authenticated professional workspace for the One Health Lyme Gap Atlas.",
    href: "/app",
    id: "ux-reset-app",
    label: "Professional workspace",
    match: "prefix",
    pageDescription:
      "Authenticated professional workspace for the One Health Lyme Gap Atlas.",
    pageTitle: "Professional workspace | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    auth: "required",
    description:
      "Map, county evidence, and suggested follow-up for one governed release.",
    href: ATLAS_EXPLORER_PATH,
    id: "atlas-explorer",
    label: "Atlas Explorer",
    match: "prefix",
    pageDescription:
      "Map-led review, expandable county evidence, and suggested follow-up.",
    pageTitle: "Atlas Explorer | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    auth: "required",
    description: "Compare two counties on aligned governed measures.",
    href: RESET_COMPARE_PATH,
    id: "workspace-compare",
    label: "Compare",
    match: "prefix",
    pageDescription:
      "Two-county evidence comparison with each measure's unit, period, and availability.",
    pageTitle: "Compare | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    auth: "required",
    description: "Ask questions grounded in reviewed literature.",
    href: RESET_ASSISTANT_PATH,
    id: "ask-atlas",
    label: "Ask Atlas",
    match: "prefix",
    pageDescription:
      "Dedicated answer-only workspace for reviewed-literature questions.",
    pageTitle: "Ask Atlas | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    description: "Authentication callback utility route.",
    href: "/auth/callback",
    id: "auth-callback",
    label: "Authentication callback",
    match: "prefix",
    pageDescription: "Authentication callback utility route.",
    pageTitle: "Authentication | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    description: "Authentication confirmation utility route.",
    href: "/auth/confirm",
    id: "auth-confirm",
    label: "Authentication confirmation",
    match: "prefix",
    pageDescription: "Authentication confirmation utility route.",
    pageTitle: "Authentication | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
  {
    description: "Documentation search API route.",
    href: "/api/search",
    id: "docs-search-api",
    label: "Documentation search API",
    match: "prefix",
    pageDescription: "Documentation search API route.",
    pageTitle: "Documentation search | One Health Lyme Gap Atlas",
    placement: "none",
    shell: "none",
    status: "hidden",
  },
];

export const NAVIGATION_ITEMS = ATLAS_ROUTES.filter(
  (item) => item.placement === "sidebar"
);

export const UTILITY_NAVIGATION_ITEMS = ATLAS_ROUTES.filter(
  (item) => item.placement === "utility"
);

export const FOOTER_NAVIGATION_ITEMS = ATLAS_ROUTES.filter(
  (item) => item.placement === "footer"
);

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function pathnameOnly(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0] || "/";
}

function matchesDynamicRoute(pattern: string, pathname: string): boolean {
  const patternSegments = pathSegments(pattern);
  const pathnameSegments = pathSegments(pathname);
  if (patternSegments.length !== pathnameSegments.length) return false;
  return patternSegments.every(
    (segment, index) =>
      /^\[.+\]$/.test(segment) || segment === pathnameSegments[index]
  );
}

export function isNavigationItemActive(
  item: Pick<RouteMetadata, "href" | "match">,
  pathname: string
): boolean {
  const normalizedPathname = pathnameOnly(pathname);
  switch (item.match) {
    case "exact": {
      return normalizedPathname === item.href;
    }
    case "prefix": {
      return (
        normalizedPathname === item.href ||
        normalizedPathname.startsWith(`${item.href}/`)
      );
    }
    case "dynamic": {
      return matchesDynamicRoute(item.href, normalizedPathname);
    }
    case "none": {
      return false;
    }
    default: {
      return false;
    }
  }
}

function routeMatches(route: RouteMetadata, pathname: string): boolean {
  return route.match === "dynamic"
    ? matchesDynamicRoute(route.href, pathnameOnly(pathname))
    : isNavigationItemActive(route, pathname);
}

export function findRouteMetadata(pathname: string): RouteMetadata | undefined {
  return [...ATLAS_ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => routeMatches(route, pathname));
}

export function getRouteShell(pathname: string): RouteShell {
  return findRouteMetadata(pathname)?.shell ?? "analytical";
}

export function pageMetadataForRoute(href: string): {
  description: string;
  title: string;
} {
  const route = ATLAS_ROUTES.find((candidate) => candidate.href === href);
  if (!route) throw new Error(`No Atlas route metadata exists for ${href}.`);
  return { description: route.pageDescription, title: route.pageTitle };
}

export type NavigationItemsForGroupOptions = {
  knowledgeGraphEnabledOrFeatures?:
    | boolean
    | Partial<Record<NavigationCapability, boolean>>;
  showAssistantInPrimaryNavigation?: boolean;
};

export function navigationItemsForGroup(
  group: NavigationGroupId,
  options: NavigationItemsForGroupOptions = {}
): RouteMetadata[] {
  const {
    knowledgeGraphEnabledOrFeatures = {},
    showAssistantInPrimaryNavigation = true,
  } = options;
  const features =
    typeof knowledgeGraphEnabledOrFeatures === "boolean"
      ? { knowledgeGraph: knowledgeGraphEnabledOrFeatures }
      : knowledgeGraphEnabledOrFeatures;
  return NAVIGATION_ITEMS.filter(
    (item) =>
      item.group === group &&
      item.status !== "hidden" &&
      (!item.requiresFeature || features[item.requiresFeature] === true) &&
      (showAssistantInPrimaryNavigation || item.id !== "assistant")
  );
}
