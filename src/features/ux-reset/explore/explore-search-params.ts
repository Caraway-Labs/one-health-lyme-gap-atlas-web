import {
  serializeCompareFipsList,
  uxResetExploreLocalParsers,
  uxResetSharedContextParsers,
  type UxResetSharedContext,
} from "@/features/ux-reset/context-params";

/** Explore route URL state: shared reset context plus page-local keys. */
export const exploreSearchParams = {
  ...uxResetSharedContextParsers,
  ...uxResetExploreLocalParsers,
};

export type ExploreHandoffState = UxResetSharedContext & {
  map_scope: string | null;
  metric: string | null;
  selected: readonly string[];
};

/** Source params for the shared cross-page handoff. Page-local keys stay on the source URL only. */
export function exploreHandoffSearchParams(
  state: ExploreHandoffState
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("scope", state.scope);
  if (state.county) {
    params.set("county", state.county);
  }
  if (state.compare.length > 0) {
    params.set("compare", serializeCompareFipsList(state.compare));
  }
  if (state.dataset) {
    params.set("dataset", state.dataset);
  }
  if (state.period) {
    params.set("period", state.period);
  }
  if (state.metric) {
    params.set("metric", state.metric);
  }
  if (state.map_scope) {
    params.set("map_scope", state.map_scope);
  }
  if (state.selected.length > 0) {
    params.set("selected", serializeCompareFipsList(state.selected));
  }
  return params;
}
