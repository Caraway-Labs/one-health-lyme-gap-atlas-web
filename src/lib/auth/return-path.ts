import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import { isProfessionalAppPath } from "@/lib/auth/app-route-guard";

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
 * Signed-in return paths may point at the professional workspace. An
 * account-free exit from a professional path lands on Atlas Explorer, which
 * still requires a session. Public aliases such as `/overview` stay intact
 * so the compatibility redirect can preserve their query.
 */
export function accountFreeContinueHref(returnPath: string): string {
  const pathname = returnPath.split(/[?#]/, 1)[0] || "/";
  if (isProfessionalAppPath(pathname)) {
    return ATLAS_EXPLORER_PATH;
  }
  return returnPath;
}
