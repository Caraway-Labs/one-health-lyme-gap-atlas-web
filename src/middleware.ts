import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
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

export async function middleware(request: NextRequest) {
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
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/", "/app", "/app/:path*"],
};
