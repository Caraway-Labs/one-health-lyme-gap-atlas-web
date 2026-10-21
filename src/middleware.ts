import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { installedWorkspaceRedirect } from "@/features/ux-reset/workspace-route-migration";
import {
  isProfessionalAppPath,
  isSupabaseAuthConfigured,
  shouldRedirectUnauthenticatedAppRoute,
} from "@/lib/auth/app-route-guard";
import { frontPorchSessionHeaders } from "@/lib/auth/front-porch-session-header";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

type PendingCookie = {
  name: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
  value: string;
};

const WORKSPACE_ROBOTS_TAG = "noindex, nofollow";

/** Retired signed-in trust page. The public page is the only copy (issue 811). */
const RETIRED_AI_RESPONSIBLE_USE_PATH = "/app/ai-responsible-use";
const AI_ETHICS_PATH = "/ai-ethics";

function withAccessibleWorkspaceRobots(
  response: NextResponse,
  pathname: string
): NextResponse {
  if (isProfessionalAppPath(pathname)) {
    response.headers.set("X-Robots-Tag", WORKSPACE_ROBOTS_TAG);
  }
  return response;
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Permanent redirect for the retired page, including a trailing slash.
 * Query strings stay on `/ai-ethics`. This runs before session refresh and
 * the sign-in gate so a signed-out request is not sent to `/auth/sign-in`.
 */
function retiredAiResponsibleUseRedirect(
  request: NextRequest
): NextResponse | null {
  if (
    normalizePathname(request.nextUrl.pathname) !==
    RETIRED_AI_RESPONSIBLE_USE_PATH
  ) {
    return null;
  }
  const destination = new URL(AI_ETHICS_PATH, request.url);
  destination.search = request.nextUrl.search;
  return withAccessibleWorkspaceRobots(
    NextResponse.redirect(destination, 308),
    request.nextUrl.pathname
  );
}

export async function middleware(request: NextRequest) {
  const retiredAiPage = retiredAiResponsibleUseRedirect(request);
  if (retiredAiPage) {
    return retiredAiPage;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseConfigured = isSupabaseAuthConfigured(url, publishableKey);
  const pathname = request.nextUrl.pathname;
  const pendingCookies: PendingCookie[] = [];
  let userPresent = false;

  if (supabaseConfigured) {
    const supabase = createServerClient(url!, publishableKey!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          pendingCookies.length = 0;
          for (const { name, options, value } of cookiesToSet) {
            request.cookies.set(name, value);
            pendingCookies.push({ name, options, value });
          }
        },
      },
    });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userPresent = Boolean(user);
    } catch (error) {
      if (pathname !== "/") {
        throw error;
      }
      userPresent = false;
    }
  }

  const response = NextResponse.next({
    request: {
      headers: frontPorchSessionHeaders(request.headers, userPresent),
    },
  });
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  const returnPath = `${pathname}${request.nextUrl.search}`;
  if (
    shouldRedirectUnauthenticatedAppRoute({
      atlasE2E: process.env.ATLAS_E2E === "1",
      nodeEnv: process.env.NODE_ENV ?? "production",
      pathname,
      supabaseConfigured,
      userPresent,
    })
  ) {
    const redirect = NextResponse.redirect(
      new URL(signInHrefForReturnPath(returnPath), request.url)
    );
    for (const cookie of pendingCookies) {
      redirect.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return withAccessibleWorkspaceRobots(redirect, pathname);
  }

  const compatibility = installedWorkspaceRedirect({
    pathname,
    searchParams: request.nextUrl.searchParams,
  });
  if (compatibility) {
    const redirect = NextResponse.redirect(
      new URL(compatibility.href, request.url),
      compatibility.status
    );
    for (const cookie of pendingCookies) {
      redirect.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return withAccessibleWorkspaceRobots(redirect, pathname);
  }

  return withAccessibleWorkspaceRobots(response, pathname);
}

export const config = {
  matcher: [
    "/",
    "/app",
    "/app/:path*",
    "/overview",
    "/geographic_explorer",
    "/investigate",
    "/explore",
    "/explore/:path*",
    "/compare",
    "/compare/:path*",
    "/askatlas",
    "/askatlas/:path*",
    "/data-provenance",
    "/data-provenance/:path*",
  ],
};
