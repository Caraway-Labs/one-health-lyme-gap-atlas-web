import type { CompareAlignment } from "@/features/ux-reset/compare/compare-alignment";
import type { CompareProfileAlignment } from "@/features/ux-reset/compare/compare-county-profile";
import {
  compareReturnTargets,
  type CompareReturnTarget,
} from "@/features/ux-reset/compare/compare-entry";

export type CompareStatusError = { id: string; message: string };

/** Short origin line shown when the first county was carried into Compare. */
export function compareOriginLabel(target: CompareReturnTarget): string {
  switch (target) {
    case compareReturnTargets.review: {
      return "From Explorer";
    }
    case compareReturnTargets.investigate: {
      return "From county evidence";
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

/**
 * Every message that explains something did not load, in one list.
 * Loaded county records stay visible. Nothing here changes what a value means.
 */
export function compareStatusErrors(input: {
  alignment: CompareAlignment | null;
  catalogError: string | null;
  directoryError: string | null;
  evidenceError: string | null;
  failedLabels: readonly string[];
  failedMeasures: boolean;
  metadataError: string | null;
  profile: CompareProfileAlignment | null;
  profileError: string | null;
}): CompareStatusError[] {
  const messages: CompareStatusError[] = [];
  const add = (id: string, message: string | null | undefined) => {
    if (message && !messages.some((entry) => entry.message === message)) {
      messages.push({ id, message });
    }
  };
  add("metadata", input.metadataError);
  add("directory", input.directoryError);
  add("catalog", input.catalogError);
  add("profile", input.profileError);
  add("evidence", input.evidenceError);
  if (input.profile?.retryable && !input.profileError) {
    add(
      "profile-partial",
      "A county record could not be loaded. Values that were not returned stay blank."
    );
  }
  if (input.profile?.releaseMismatch) {
    add(
      "release-mismatch",
      "A county record belongs to a different release, so its values were not shown."
    );
  }
  if (input.failedMeasures) {
    const affected =
      input.failedLabels.length > 0
        ? ` Affected measures: ${input.failedLabels.join(", ")}.`
        : "";
    add(
      "measures",
      `Some measures could not be loaded. Evidence that loaded stays in this comparison.${affected}`
    );
  }
  return messages;
}
