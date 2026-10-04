import type { AtlasMetadataStatesItem } from "@/generated/models";

const STATE_CODE_PATTERN = /^[A-Z]{2}$/;

export type AtlasStateOption = {
  code: string;
  name: string;
};

export function atlasStateOptionsFromMetadata(
  states: readonly AtlasMetadataStatesItem[]
): AtlasStateOption[] {
  const options: AtlasStateOption[] = [];
  const seen = new Set<string>();
  for (const entry of states) {
    const code = entry.code?.trim().toUpperCase();
    const name = entry.name?.trim();
    if (!code || !name || !STATE_CODE_PATTERN.test(code) || seen.has(code)) {
      continue;
    }
    seen.add(code);
    options.push({ code, name });
  }
  return options.toSorted((a, b) => a.name.localeCompare(b.name));
}

export function isAtlasStateCode(
  code: string,
  options: readonly AtlasStateOption[]
): boolean {
  return options.some((option) => option.code === code);
}

export function reviewScopeLabel(
  scope: "ALL" | string,
  options: readonly AtlasStateOption[]
): string {
  if (scope === "ALL") {
    return "United States";
  }
  const match = options.find((option) => option.code === scope);
  return match ? `${match.name} (${scope})` : scope;
}
