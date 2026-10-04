export type AppRouteGuardContext = {
  atlasE2E: boolean;
  nodeEnv: string;
  pathname: string;
  supabaseConfigured: boolean;
  userPresent: boolean;
};

export function isProfessionalAppPath(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
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
