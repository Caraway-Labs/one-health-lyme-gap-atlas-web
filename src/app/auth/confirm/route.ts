import { NextResponse } from "next/server";

import { publicOrigin } from "@/lib/auth/public-origin";
import { safeReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const next = safeReturnPath(requestUrl.searchParams.get("next"));
  const origin = publicOrigin(request);
  if (!code && !tokenHash)
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=missing_link", origin)
    );

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "email" });
  if (error)
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=expired_or_invalid", origin)
    );
  return NextResponse.redirect(new URL(next, origin));
}
