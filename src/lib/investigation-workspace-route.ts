const INVESTIGATION_WORKSPACE_PATH = "/investigate";

type SearchParamValue = string | string[] | undefined;

/**
 * Build the canonical Investigation Workspace URL from a legacy request's
 * search params. Supported analytical parameters are copied through unchanged.
 */
export function investigationWorkspaceHref(
  searchParams: Record<string, SearchParamValue>
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      query.append(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }
  const serialized = query.toString();
  return serialized
    ? `${INVESTIGATION_WORKSPACE_PATH}?${serialized}`
    : INVESTIGATION_WORKSPACE_PATH;
}
