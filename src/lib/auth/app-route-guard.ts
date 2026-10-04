export type AppRouteGuardContext = {
  atlasE2E: boolean;
  pathname: string;
  supabaseConfigured: boolean;
  userPresent: boolean;
};

export function isProfessionalAppPath(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
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
  if (!context.supabaseConfigured && context.atlasE2E) {
    return false;
  }
  return true;
}
