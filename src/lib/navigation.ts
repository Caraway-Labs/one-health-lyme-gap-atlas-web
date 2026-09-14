import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Compass,
  FileText,
  FlaskConical,
  Map,
  UserCircle,
} from "lucide-react";

export type NavigationGroupId = "explore" | "research" | "reference";
export type NavigationStatus =
  | "available"
  | "inDevelopment"
  | "experimental"
  | "hidden";
export type NavigationPlacement =
  | "sidebar"
  | "utility"
  | "footer"
  | "direct"
  | "none";
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

export const NAVIGATION_STATUS_LABELS: Record<NavigationStatus, string> = {
  available: "Available",
  experimental: "Experimental",
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
    description: "Start a county surveillance review.",
    group: "explore",
    href: "/",
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
    description: "Review the evidence library as it is brought into Atlas.",
    group: "research",
    href: "/knowledge-graph",
    icon: BookOpenText,
    id: "evidence-library",
    label: "Evidence library",
    match: "prefix",
    pageDescription:
      "Ask questions grounded in reviewed PubMed and PMC Open Access literature.",
    pageTitle: "Evidence Library | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "analytical",
    status: "inDevelopment",
  },
  {
    description:
      "See the approved fixture-only assistant experience in development.",
    group: "research",
    href: "/assistant",
    icon: FlaskConical,
    id: "assistant",
    label: "Talk with the Atlas",
    match: "exact",
    pageDescription:
      "A fixture-only assistant experience in development for the One Health Lyme Gap Atlas.",
    pageTitle: "Talk with the Atlas | One Health Lyme Gap Atlas",
    placement: "sidebar",
    shell: "analytical",
    status: "inDevelopment",
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
  // Experimental routes remain routable by direct URL, but are intentionally
  // isolated from the production shell and normal navigation.
  ...(
    [
      ["variant-1", "/variant_1", "County review"],
      ["variant-2", "/variant_2", "Guided review"],
      ["variant-3", "/variant_3", "Evidence workspace"],
      ["variant-4", "/variant_4", "Score explained"],
      ["variant-5", "/variant_5", "County comparison"],
      ["variant-6", "/variant_6", "Wide workspace"],
      ["variant-7", "/variant_7", "Geographic explorer legacy route"],
    ] as const
  ).map(([id, href, label]) => ({
    description:
      "Experimental Atlas workflow retained for direct-link evaluation.",
    href,
    id,
    label,
    match: "exact" as const,
    pageDescription:
      "An experimental One Health Lyme Gap Atlas workflow retained for direct-link evaluation.",
    pageTitle: `${label} | One Health Lyme Gap Atlas`,
    placement: "direct" as const,
    shell: "none" as const,
    status: "experimental" as const,
  })),
  {
    description:
      "Authentication entry point for the optional account experience.",
    href: "/auth/sign-in",
    id: "auth-sign-in",
    label: "Sign in",
    match: "prefix",
    pageDescription:
      "Sign in to manage your optional One Health Lyme Gap Atlas profile.",
    pageTitle: "Sign in | One Health Lyme Gap Atlas",
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

export function navigationItemsForGroup(
  group: NavigationGroupId,
  knowledgeGraphEnabledOrFeatures:
    | boolean
    | Partial<Record<NavigationCapability, boolean>> = {}
): RouteMetadata[] {
  const features =
    typeof knowledgeGraphEnabledOrFeatures === "boolean"
      ? { knowledgeGraph: knowledgeGraphEnabledOrFeatures }
      : knowledgeGraphEnabledOrFeatures;
  return NAVIGATION_ITEMS.filter(
    (item) =>
      item.group === group &&
      item.status !== "hidden" &&
      item.status !== "experimental" &&
      (!item.requiresFeature || features[item.requiresFeature] === true)
  );
}
