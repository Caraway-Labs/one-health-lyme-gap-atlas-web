import { isProfessionalAppPath } from "@/lib/auth/app-route-guard";
import { ATLAS_OVERVIEW_PATH } from "@/lib/navigation";

export function safeReturnPath(
  value: string | null,
  fallback = "/account"
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }
  return value;
}

/**
 * Signed-in return paths may point at the professional workspace. The
 * account-free exit cannot, because middleware sends unauthenticated /app
 * requests back to sign-in.
 */
export function accountFreeContinueHref(returnPath: string): string {
  const pathname = returnPath.split(/[?#]/, 1)[0] || "/";
  if (isProfessionalAppPath(pathname)) {
    return ATLAS_OVERVIEW_PATH;
  }
  return returnPath;
}
