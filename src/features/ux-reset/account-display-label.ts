const EXPLICIT_NAME_KEYS = ["full_name", "name"] as const;

type AccountUser = {
  user_metadata?: Record<string, unknown> | null;
};

/**
 * A compact label from an identity the provider already stored.
 * Email addresses and blank values are omitted so the sidebar never
 * invents a name or leaves an address on a shared screen.
 */
export function explicitAccountLabel(
  user: AccountUser | null | undefined
): string | null {
  const metadata = user?.user_metadata;
  if (!metadata) {
    return null;
  }
  for (const key of EXPLICIT_NAME_KEYS) {
    const value = metadata[key];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("@")) {
      continue;
    }
    return trimmed;
  }
  return null;
}
