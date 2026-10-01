import { isAnalyticalNavigationPath } from "@/lib/analytical-navigation-handoff";
import { isCountyFips } from "@/lib/atlas-analytics";

const ASSISTANT_WORKSPACE_PATH = "/assistant";
const DATASET_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** County and governed release only — no analytical filter equivalence. */
export const ASSISTANT_CONTEXT_HANDOFF_PARAMS = ["county", "dataset"] as const;

type SearchParamSource = Pick<URLSearchParams, "get" | "getAll" | "has">;

function shouldCopyHandoffParam(key: string, value: string): boolean {
  if (key === "county") {
    return isCountyFips(value);
  }
  if (key === "dataset") {
    return DATASET_PATTERN.test(value);
  }
  return false;
}

export function assistantContextHandoffSearchParams(
  sourcePathname: string,
  sourceSearchParams: SearchParamSource
): URLSearchParams {
  const normalizedPath = sourcePathname.split(/[?#]/, 1)[0] || "/";
  const mayHandOff =
    isAnalyticalNavigationPath(normalizedPath) ||
    normalizedPath === ASSISTANT_WORKSPACE_PATH;
  if (!mayHandOff) {
    return new URLSearchParams();
  }

  const handoff = new URLSearchParams();
  for (const key of ASSISTANT_CONTEXT_HANDOFF_PARAMS) {
    if (!sourceSearchParams.has(key)) {
      continue;
    }
    for (const value of sourceSearchParams.getAll(key)) {
      if (!shouldCopyHandoffParam(key, value)) {
        continue;
      }
      handoff.append(key, value);
    }
  }
  return handoff;
}

export type AssistantWorkspaceLinkOptions = {
  conversation?: string;
};

export function assistantWorkspaceHref(
  sourcePathname: string,
  sourceSearchParams: SearchParamSource,
  options?: AssistantWorkspaceLinkOptions
): string {
  const params = assistantContextHandoffSearchParams(
    sourcePathname,
    sourceSearchParams
  );
  if (options?.conversation) {
    params.set("conversation", options.conversation);
  }
  const serialized = params.toString();
  return serialized
    ? `${ASSISTANT_WORKSPACE_PATH}?${serialized}`
    : ASSISTANT_WORKSPACE_PATH;
}

export type AssistantCountyUrlContext =
  | { kind: "absent" }
  | { kind: "invalid"; raw: string }
  | { kind: "valid"; countyFips: string; dataset: string | null };

/**
 * Parses county and release context from an Assistant workspace URL.
 * Invalid FIPS shapes are surfaced explicitly; valid FIPS are never replaced.
 */
export function parseAssistantCountyUrlContext(
  searchParams: SearchParamSource
): AssistantCountyUrlContext {
  if (!searchParams.has("county")) {
    return { kind: "absent" };
  }
  const raw = searchParams.get("county") ?? "";
  if (!isCountyFips(raw)) {
    return { kind: "invalid", raw };
  }
  const datasetValue = searchParams.get("dataset");
  const dataset =
    datasetValue && DATASET_PATTERN.test(datasetValue) ? datasetValue : null;
  return { kind: "valid", countyFips: raw, dataset };
}
