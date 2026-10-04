import { safeReturnPath } from "@/lib/auth/return-path";

export function signInHrefForReturnPath(
  returnPath: string,
  fallback = "/account"
): string {
  const next = safeReturnPath(returnPath, fallback);
  return `/auth/sign-in?next=${encodeURIComponent(next)}`;
}
