/**
 * Visible title for the authenticated workspace header (issue 640).
 *
 * The six approved strings are the header contract. Sidebar labels, document
 * titles, and the "Professional workspace" navigation landmark stay as they are.
 * Destination identity comes from navigation metadata, the reset route table,
 * and recorded workspace aliases.
 */

import { findResetRoute, type ResetRoute } from "@/features/ux-reset/paths";
import {
  normalizeMigrationPathname,
  recordedWorkspaceMigration,
  WORKSPACE_DESTINATIONS,
  type WorkspaceDestinationId,
} from "@/features/ux-reset/workspace-route-migration";
import { findRouteMetadata } from "@/lib/navigation";

/** Approved header text. Distinct from sidebar labels where those differ. */
export const WORKSPACE_HEADER_TITLES = {
  "ask-atlas": "Ask Atlas",
  compare: "Compare Counties",
  docs: "Documentation",
  explorer: "Atlas Explorer",
  feed: "Intelligence Feed",
  settings: "Settings",
} as const satisfies Record<WorkspaceDestinationId, string>;

/** Used when the path is not one of the six destinations or a recorded alias. */
export const WORKSPACE_HEADER_FALLBACK = "One Health Atlas";

const NAVIGATION_DESTINATIONS: Record<string, WorkspaceDestinationId> = {
  "ask-atlas": "ask-atlas",
  "atlas-explorer": "explorer",
  docs: "docs",
  "workspace-compare": "compare",
};

function destinationIdForCanonicalPath(
  pathname: string
): WorkspaceDestinationId | null {
  const normalized = normalizeMigrationPathname(pathname);
  const match = [...WORKSPACE_DESTINATIONS]
    .sort((left, right) => right.path.length - left.path.length)
    .find(
      (destination) =>
        normalized === destination.path ||
        normalized.startsWith(`${destination.path}/`)
    );
  return match?.id ?? null;
}

function destinationFromNavigation(
  pathname: string
): WorkspaceDestinationId | null {
  const metadata = findRouteMetadata(pathname);
  if (!metadata) {
    return null;
  }
  return NAVIGATION_DESTINATIONS[metadata.id] ?? null;
}

function destinationFromMigration(
  pathname: string
): WorkspaceDestinationId | null {
  const migrated = recordedWorkspaceMigration({
    pathname,
    searchParams: new URLSearchParams(),
  });
  if (migrated.kind !== "redirect") {
    return null;
  }
  return destinationIdForCanonicalPath(migrated.pathname);
}

function destinationFromResetRoute(
  route: ResetRoute | undefined
): WorkspaceDestinationId | null {
  if (!route) {
    return null;
  }
  return (
    destinationIdForCanonicalPath(route.href) ??
    destinationFromMigration(route.href)
  );
}

/**
 * Nested legacy aliases such as `/app/compare/extra` are not canonical routes.
 * Walk parents, and stop before the bare `/app` entry so an unknown child does
 * not inherit the explorer redirect.
 */
function destinationFromAncestorAlias(
  pathname: string
): WorkspaceDestinationId | null {
  let parent = pathname.slice(0, pathname.lastIndexOf("/"));
  while (parent.includes("/", 1)) {
    const destination = destinationFromMigration(parent);
    if (destination) {
      return destination;
    }
    parent = parent.slice(0, parent.lastIndexOf("/"));
  }
  return null;
}

export function workspaceHeaderDestination(
  pathname: string
): WorkspaceDestinationId | null {
  const normalized = normalizeMigrationPathname(pathname);
  const fromNavigation = destinationFromNavigation(normalized);
  if (fromNavigation) {
    return fromNavigation;
  }
  const fromReset = destinationFromResetRoute(findResetRoute(normalized));
  if (fromReset) {
    return fromReset;
  }
  return (
    destinationFromMigration(normalized) ??
    destinationFromAncestorAlias(normalized)
  );
}

export function workspaceHeaderTitle(pathname: string): string {
  const destination = workspaceHeaderDestination(pathname);
  if (!destination) {
    return WORKSPACE_HEADER_FALLBACK;
  }
  return WORKSPACE_HEADER_TITLES[destination];
}
