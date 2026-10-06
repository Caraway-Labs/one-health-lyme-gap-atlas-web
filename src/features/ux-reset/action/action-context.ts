import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import { visibleCountyObservations } from "@/features/ux-reset/investigate/investigate-visible-summary";

/**
 * Page-local Action plan id for the deferred Surveillance Planning workflow.
 * It is recognized only so a direct link can be told that the workflow is
 * unavailable. It is not a route.
 */
export const ACTION_SURVEILLANCE_PLAN_ID = "surveillance";

export const actionPeriodStates = {
  matched: "matched",
  stale: "stale",
  unspecified: "unspecified",
} as const;

export type ActionPeriodState =
  (typeof actionPeriodStates)[keyof typeof actionPeriodStates];

export const actionPlanPostureKinds = {
  none: "none",
  surveillanceUnavailable: "surveillance_unavailable",
  unsupported: "unsupported",
} as const;

export type ActionPlanPosture =
  | { kind: typeof actionPlanPostureKinds.none }
  | { kind: typeof actionPlanPostureKinds.surveillanceUnavailable }
  | { kind: typeof actionPlanPostureKinds.unsupported; plan: string };

/**
 * The requested period matches when it falls inside an observation interval
 * already accepted for this county. A year-grain measure does not requery
 * from the URL period, so a link period outside those intervals is stale.
 * An unloaded bundle is not stale; that is still a loading or recovery state.
 */
export function actionRequestedPeriodState(input: {
  loaded: boolean;
  observations: readonly { period_end: string; period_start: string }[];
  requestedPeriod: string | null;
}): ActionPeriodState {
  if (!(input.loaded && input.requestedPeriod)) {
    return actionPeriodStates.unspecified;
  }
  const requestedPeriod = input.requestedPeriod;
  const covered = input.observations.some(
    (observation) =>
      observation.period_start <= requestedPeriod &&
      observation.period_end >= requestedPeriod
  );
  return covered ? actionPeriodStates.matched : actionPeriodStates.stale;
}

export function actionBundlePeriodState(input: {
  bundle: CountyEvidenceBundle | null;
  requestedPeriod: string | null;
}): ActionPeriodState {
  return actionRequestedPeriodState({
    loaded: Boolean(input.bundle),
    observations: input.bundle
      ? visibleCountyObservations(input.bundle).map(
          (record) => record.observation
        )
      : [],
    requestedPeriod: input.requestedPeriod,
  });
}

/**
 * One plan value is read from the Action URL. Any other value, including an
 * Evidence Brief id, is unsupported. Surveillance Planning stays unavailable.
 */
export function actionPlanPosture(
  planValues: readonly string[]
): ActionPlanPosture {
  if (planValues.length === 0) {
    return { kind: actionPlanPostureKinds.none };
  }
  if (planValues.length !== 1) {
    return {
      kind: actionPlanPostureKinds.unsupported,
      plan: planValues.join(","),
    };
  }
  const plan = planValues[0]?.trim() ?? "";
  if (plan.length === 0) {
    return { kind: actionPlanPostureKinds.none };
  }
  if (plan === ACTION_SURVEILLANCE_PLAN_ID) {
    return { kind: actionPlanPostureKinds.surveillanceUnavailable };
  }
  return { kind: actionPlanPostureKinds.unsupported, plan };
}
