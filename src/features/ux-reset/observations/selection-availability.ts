import type { CollectionMeta } from "@/generated/models";

/**
 * CDC admission measures. A successful empty selection is not interpreted for
 * these ids. Admission failures stay non-2xx errors in the caller.
 */
const CDC_ADMISSION_MEASURE_IDS: ReadonlySet<string> = new Set([
  "burgdorferi_status",
  "scapularis_status",
]);

export const NO_PUBLISHED_RESULTS_REASON = "NO_PUBLISHED_RESULTS";

export type KnownEmptyObservationSelection = {
  availability: "UNAVAILABLE";
  limitations: readonly string[];
  measureId: string;
  reason: typeof NO_PUBLISHED_RESULTS_REASON;
  releaseId: string | null;
};

export type ObservationSelectionRead =
  | { kind: "available" }
  | { kind: "continuation" }
  | { kind: "known_unavailable"; selection: KnownEmptyObservationSelection }
  | { kind: "release_mismatch" }
  | { kind: "unclassified_empty" };

export type FoldedObservationSelection =
  | { kind: "known_unavailable"; selection: KnownEmptyObservationSelection }
  | { kind: "not_known_empty" }
  | { kind: "release_mismatch" };

export type ObservationSelectionPage = {
  dataCount: number;
  meta: CollectionMeta;
  pageToken: string | null;
};

function limitationLines(
  value: readonly string[] | null | undefined
): string[] {
  if (!value) {
    return [];
  }
  const lines: string[] = [];
  for (const item of value) {
    const line = item.trim();
    if (line) {
      lines.push(line);
    }
  }
  return lines;
}

function releaseIdFromMeta(meta: CollectionMeta): string | null {
  const releaseId = meta.release_id?.trim() ?? "";
  return releaseId || null;
}

/**
 * One observations page. Populated rows and continuation pages are not
 * "no published results". CDC measure ids are not classified as known-empty.
 */
export function readObservationSelectionAvailability(input: {
  dataCount: number;
  measureId: string;
  meta: CollectionMeta;
  pageToken: string | null;
  requestedReleaseId: string;
}): ObservationSelectionRead {
  if (input.pageToken) {
    return { kind: "continuation" };
  }
  if (input.dataCount > 0) {
    return { kind: "available" };
  }
  if (CDC_ADMISSION_MEASURE_IDS.has(input.measureId)) {
    return { kind: "unclassified_empty" };
  }
  if (
    input.meta.availability !== "UNAVAILABLE" ||
    input.meta.reason !== NO_PUBLISHED_RESULTS_REASON
  ) {
    return { kind: "unclassified_empty" };
  }
  const releaseId = releaseIdFromMeta(input.meta);
  const requested = input.requestedReleaseId.trim();
  if (releaseId && requested && releaseId !== requested) {
    return { kind: "release_mismatch" };
  }
  return {
    kind: "known_unavailable",
    selection: {
      availability: "UNAVAILABLE",
      limitations: limitationLines(input.meta.limitations),
      measureId: input.measureId,
      reason: NO_PUBLISHED_RESULTS_REASON,
      releaseId,
    },
  };
}

export function createObservationSelectionAccumulator(input: {
  measureId: string;
  requestedReleaseId: string;
}) {
  let sawRows = false;
  let sawContinuation = false;
  let initial: ObservationSelectionRead | null = null;

  return {
    note(page: ObservationSelectionPage) {
      const read = readObservationSelectionAvailability({
        dataCount: page.dataCount,
        measureId: input.measureId,
        meta: page.meta,
        pageToken: page.pageToken,
        requestedReleaseId: input.requestedReleaseId,
      });
      if (page.dataCount > 0) {
        sawRows = true;
      }
      if (page.pageToken) {
        sawContinuation = true;
      } else {
        initial = read;
      }
    },
    finish(): FoldedObservationSelection {
      if (sawRows) {
        return { kind: "not_known_empty" };
      }
      if (initial?.kind === "release_mismatch") {
        return { kind: "release_mismatch" };
      }
      if (sawContinuation) {
        return { kind: "not_known_empty" };
      }
      if (initial?.kind === "known_unavailable") {
        return { kind: "known_unavailable", selection: initial.selection };
      }
      return { kind: "not_known_empty" };
    },
  };
}

/** A multi-batch selection is known-empty only when every batch is. */
export function mergeKnownEmptySelections(
  folds: readonly FoldedObservationSelection[]
): FoldedObservationSelection {
  if (folds.some((fold) => fold.kind === "release_mismatch")) {
    return { kind: "release_mismatch" };
  }
  if (
    folds.length === 0 ||
    folds.some((fold) => fold.kind !== "known_unavailable")
  ) {
    return { kind: "not_known_empty" };
  }
  const releases = new Set(
    folds.map((fold) =>
      fold.kind === "known_unavailable" ? fold.selection.releaseId : null
    )
  );
  if (releases.size !== 1) {
    return { kind: "not_known_empty" };
  }
  const first = folds[0];
  if (first?.kind !== "known_unavailable") {
    return { kind: "not_known_empty" };
  }
  const limitations: string[] = [];
  const seen = new Set<string>();
  for (const fold of folds) {
    if (fold.kind !== "known_unavailable") {
      continue;
    }
    for (const line of fold.selection.limitations) {
      if (!seen.has(line)) {
        seen.add(line);
        limitations.push(line);
      }
    }
  }
  return {
    kind: "known_unavailable",
    selection: { ...first.selection, limitations },
  };
}

export function knownEmptySelectionFromFold(
  fold: FoldedObservationSelection
): KnownEmptyObservationSelection | null {
  if (fold.kind !== "known_unavailable") {
    return null;
  }
  return fold.selection;
}

export function knownEmptySelectionMessage(
  selection: KnownEmptyObservationSelection
): string {
  const boundary =
    "No published results for this selection. This does not establish biological absence, source coverage, or geography membership.";
  const limitations = selection.limitations.join(" ");
  if (!limitations) {
    return boundary;
  }
  return `${boundary} ${limitations}`;
}
