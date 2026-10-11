import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import type { InvestigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import type { InvestigateQueryOutcome } from "@/features/ux-reset/investigate/investigate-request-state";
import type { InvestigateRecovery } from "@/features/ux-reset/investigate/use-investigate-workspace";

/** Page-local plan id. `brief` stays an unsupported direct link. */
export const ACTION_EVIDENCE_BRIEF_PLAN_ID = "evidence-brief";

export const EVIDENCE_BRIEF_LOCAL_CONTEXT_LIMIT = 1000;

export const EVIDENCE_BRIEF_NOT_LOADED =
  "County evidence has not loaded, so no evidence brief was built.";

export const EVIDENCE_BRIEF_OBSERVATIONS_FAILED =
  "County evidence did not load, so no evidence brief was built. That is a request failure, not a statement that no finding was returned.";

export const EVIDENCE_BRIEF_OBSERVATIONS_ABSENT =
  "The county evidence request settled without a bundle, so no evidence brief was built.";

export const EVIDENCE_BRIEF_CATALOG_WITHHELD =
  "The measure catalog could not be loaded, so no evidence brief was built. That is a request failure, not a statement that no finding was returned.";

export const EVIDENCE_BRIEF_UNRESOLVED =
  "This page does not have a loaded county evidence bundle, so no evidence brief was built.";

export const EVIDENCE_BRIEF_LOCAL_CONTEXT_NOTE =
  "This note is yours. It is not governed evidence, it is not included in the county PDF, and Atlas does not save it.";

export const EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID =
  "Local context is limited to 1,000 characters. Shorten this note. It is not governed evidence, and it is not saved.";

export const EVIDENCE_BRIEF_OFFER =
  "Evidence brief is available for the governed evidence already read for this county. Atlas does not choose or start an intervention.";

export const EVIDENCE_BRIEF_UNAVAILABLE_WORKFLOW =
  "No follow-up workflow is available for this evidence. Atlas does not choose or start an intervention.";

export const evidenceBriefBlockers = {
  catalogWithheld: "catalog_withheld",
  observationsAbsent: "observations_absent",
  observationsFailed: "observations_failed",
  observationsLoading: "observations_loading",
  unresolvedCounty: "unresolved_county",
} as const;

export type EvidenceBriefBlocker =
  (typeof evidenceBriefBlockers)[keyof typeof evidenceBriefBlockers];

export type EvidenceBriefGate =
  | {
      bundle: CountyEvidenceBundle;
      kind: "ready";
    }
  | {
      blocker: EvidenceBriefBlocker;
      kind: "blocked";
      sentence: string;
    };

/**
 * A cached bundle stays usable when a later refresh fails. `isSuccess` is not
 * the gate: a held bundle is loaded or refresh-failed, and a missing bundle
 * is never-loaded or failed-first-load. This helper cannot return
 * settled-absent, because the evidence loader resolves a bundle or throws.
 */
export function evidenceBriefObservationOutcome(input: {
  bundle: CountyEvidenceBundle | null;
  evidenceError: string | null;
  evidenceLoading: boolean;
}): InvestigateQueryOutcome {
  if (input.bundle) {
    return input.evidenceError ? "refresh-failed" : "loaded";
  }
  if (input.evidenceError && !input.evidenceLoading) {
    return "failed-first-load";
  }
  return "never-loaded";
}

function blocked(
  blocker: EvidenceBriefBlocker,
  sentence: string
): EvidenceBriefGate {
  return { blocker, kind: "blocked", sentence };
}

/**
 * The brief exists only for a real loaded bundle. A catalog failure blocks it
 * even when a synthetic stand-in bundle is passed in. Settled absence and
 * request failure do not use the successful empty-result sentence.
 */
export function decideEvidenceBrief(input: {
  catalogFailed: boolean;
  observationOutcome: InvestigateQueryOutcome;
  realBundle: CountyEvidenceBundle | null;
  recovery: InvestigateRecovery | null;
}): EvidenceBriefGate {
  if (input.recovery) {
    return blocked(
      evidenceBriefBlockers.unresolvedCounty,
      EVIDENCE_BRIEF_UNRESOLVED
    );
  }
  if (input.catalogFailed) {
    return blocked(
      evidenceBriefBlockers.catalogWithheld,
      EVIDENCE_BRIEF_CATALOG_WITHHELD
    );
  }
  switch (input.observationOutcome) {
    case "settled-absent": {
      return blocked(
        evidenceBriefBlockers.observationsAbsent,
        EVIDENCE_BRIEF_OBSERVATIONS_ABSENT
      );
    }
    case "failed-first-load": {
      return blocked(
        evidenceBriefBlockers.observationsFailed,
        EVIDENCE_BRIEF_OBSERVATIONS_FAILED
      );
    }
    case "never-loaded": {
      return blocked(
        evidenceBriefBlockers.observationsLoading,
        EVIDENCE_BRIEF_NOT_LOADED
      );
    }
    case "loaded":
    case "refresh-failed": {
      if (input.realBundle) {
        return { bundle: input.realBundle, kind: "ready" };
      }
      return blocked(
        evidenceBriefBlockers.observationsLoading,
        EVIDENCE_BRIEF_NOT_LOADED
      );
    }
    default: {
      const exhaustive: never = input.observationOutcome;
      return exhaustive;
    }
  }
}

/** County, release, periods, and sources already copied onto the export context. */
export function evidenceBriefStamp(context: InvestigatePdfContext): string {
  const periods =
    context.periods.length > 0 ? ` Periods ${context.periods.join("; ")}.` : "";
  const sources =
    context.sources.length > 0 ? ` Sources ${context.sources.join("; ")}.` : "";
  return `County ${context.countyFips}. Release ${context.releaseId}.${periods}${sources}`;
}

export function evidenceBriefLocalContextInvalid(value: string): boolean {
  return value.length > EVIDENCE_BRIEF_LOCAL_CONTEXT_LIMIT;
}
