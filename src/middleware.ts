import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  isSupabaseAuthConfigured,
  shouldRedirectUnauthenticatedAppRoute,
} from "@/lib/auth/app-route-guard";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseConfigured = isSupabaseAuthConfigured(url, publishableKey);

  let userPresent = false;

  if (supabaseConfigured) {
    const supabase = createServerClient(url!, publishableKey!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userPresent = Boolean(user);
  }

  const pathname = request.nextUrl.pathname;
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
    return NextResponse.redirect(
      new URL(signInHrefForReturnPath(returnPath), request.url)
    );
  }

  return response;
}

export const config = {
  matcher: ["/app", "/app/:path*"],
};
