import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const next = safeReturnPath(requestUrl.searchParams.get("next"));
  if (!tokenHash) return NextResponse.redirect(new URL("/auth/sign-in?error=missing_link", requestUrl.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) return NextResponse.redirect(new URL("/auth/sign-in?error=expired_or_invalid", requestUrl.origin));
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
