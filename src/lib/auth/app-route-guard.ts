import {
  ATLAS_EXPLORER_PATH,
  RESET_ASSISTANT_PATH,
  RESET_COMPARE_PATH,
} from "@/features/ux-reset/routes";

export type AppRouteGuardContext = {
  atlasE2E: boolean;
  nodeEnv: string;
  pathname: string;
  supabaseConfigured: boolean;
  userPresent: boolean;
};

const CANONICAL_WORKSPACE_PATHS = [
  ATLAS_EXPLORER_PATH,
  RESET_COMPARE_PATH,
  RESET_ASSISTANT_PATH,
] as const;

function matchesWorkspacePath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Professional workspace routes require a session.
 * `/app` still covers Feed, Settings, trust, and historical aliases.
 * Issue 608 canonical Explorer, Compare, and Ask Atlas live outside that prefix.
 */
export function isProfessionalAppPath(pathname: string): boolean {
  const normalized = pathname.split(/[?#]/, 1)[0] || "/";
  if (normalized === "/app" || normalized.startsWith("/app/")) {
    return true;
  }
  return CANONICAL_WORKSPACE_PATHS.some((path) =>
    matchesWorkspacePath(normalized, path)
  );
}

export function isSupabaseAuthConfigured(
  url: string | undefined,
  publishableKey: string | undefined
): boolean {
  return Boolean(url && publishableKey);
}

/**
 * Playwright and local dev may run without Supabase env vars. That bypass must
 * never apply in production builds, even when ATLAS_E2E is set.
 */
export function allowsUnauthenticatedProfessionalAppShell(
  context: Pick<
    AppRouteGuardContext,
    "atlasE2E" | "nodeEnv" | "supabaseConfigured"
  >
): boolean {
  if (context.supabaseConfigured) {
    return false;
  }
  if (context.nodeEnv === "production") {
    return false;
  }
  return context.atlasE2E;
}

export function shouldRedirectUnauthenticatedAppRoute(
  context: AppRouteGuardContext
): boolean {
  if (!isProfessionalAppPath(context.pathname)) {
    return false;
  }
  if (context.userPresent) {
    return false;
  }
  if (allowsUnauthenticatedProfessionalAppShell(context)) {
    return false;
  }
  return true;
}
