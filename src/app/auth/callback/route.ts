import { NextResponse } from "next/server";

import { publicOrigin } from "@/lib/auth/public-origin";
import { safeReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeReturnPath(requestUrl.searchParams.get("next"));
  const origin = publicOrigin(request);
  if (!code)
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=missing_code", origin)
    );

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=expired_or_invalid", origin)
    );
  return NextResponse.redirect(new URL(next, origin));
}
