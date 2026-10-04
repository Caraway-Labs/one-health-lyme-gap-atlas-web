import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import type { CountyScoreSummary } from "@/generated/models";

export type StateOrientationRow = {
  code: string;
  countyCount: number;
  topPriorityLabel: string | null;
};

export type ReviewScopePresentation = {
  scope: ReviewScope;
  orientationRows: StateOrientationRow[];
  stateCounties: CountyScoreSummary[];
  /** Contiguous tick-scope counties for map framing across the release. */
  mapCounties: CountyScoreSummary[];
};

export function countiesInReviewScope(
  counties: readonly CountyScoreSummary[],
  scope: ReviewScope
): CountyScoreSummary[] {
  return counties.filter(
    (county) =>
      county.in_contiguous_tick_scope &&
      (scope === "ALL" || county.state === scope)
  );
}

export function buildReviewScopePresentation(
  scope: ReviewScope,
  counties: readonly CountyScoreSummary[]
): ReviewScopePresentation {
  const inScope = countiesInReviewScope(counties, scope);
  const byState = new Map<string, CountyScoreSummary[]>();
  for (const county of countiesInReviewScope(counties, "ALL")) {
    const group = byState.get(county.state) ?? [];
    group.push(county);
    byState.set(county.state, group);
  }

  const orientationRows: StateOrientationRow[] = [...byState.entries()]
    .map(([code, group]) => {
      const sorted = group.toSorted((a, b) => b.score.score - a.score.score);
      const top = sorted[0];
      return {
        code,
        countyCount: group.length,
        topPriorityLabel: top?.priority ?? null,
      };
    })
    .toSorted((a, b) => a.code.localeCompare(b.code));

  const stateCounties =
    scope === "ALL"
      ? []
      : inScope.toSorted((a, b) => b.score.score - a.score.score);
  const mapCounties =
    scope === "ALL" ? countiesInReviewScope(counties, "ALL") : stateCounties;

  return {
    mapCounties,
    orientationRows,
    scope,
    stateCounties,
  };
}
