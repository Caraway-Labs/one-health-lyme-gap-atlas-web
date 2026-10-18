import { countyReferenceMatchesQuery } from "@/features/ux-reset/review/explorer-county-reference";

/**
 * One row in the Explorer counties column.
 * Rank is assigned from the geographic scope before search or availability filters.
 * A missing score stays unranked. It is never treated as zero.
 */
export type ExplorerRankedCounty = {
  color: string | null;
  county: string;
  fips: string;
  rank: number | null;
  score: number | null;
  state: string;
};

export type ExplorerRankSource = {
  color?: string | null;
  county: string;
  fips: string;
  score: number | null;
  state: string;
};

/**
 * Badge color is the published `county.color` from the scores collection,
 * the same value painted on the Atlas gap-score map. It is not a rank color
 * and it is not a disease-risk scale.
 */
export function publishedGapScore(
  score: number | null | undefined
): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  return score;
}

export function formatGapScore(score: number): string {
  return score.toFixed(1);
}

function byNameThenFips(
  left: ExplorerRankSource,
  right: ExplorerRankSource
): number {
  return (
    left.county.localeCompare(right.county, "en") ||
    left.fips.localeCompare(right.fips)
  );
}

export function rankExplorerCounties(
  counties: readonly ExplorerRankSource[],
  options?: {
    query?: string;
    visibleFips?: ReadonlySet<string> | null;
  }
): ExplorerRankedCounty[] {
  const scored: ExplorerRankSource[] = [];
  const unscored: ExplorerRankSource[] = [];
  for (const county of counties) {
    const score = publishedGapScore(county.score);
    const source = { ...county, score };
    if (score === null) {
      unscored.push(source);
    } else {
      scored.push(source);
    }
  }
  scored.sort(
    (left, right) =>
      (right.score ?? 0) - (left.score ?? 0) || byNameThenFips(left, right)
  );
  unscored.sort(byNameThenFips);
  const ranked: ExplorerRankedCounty[] = [
    ...scored.map((county, index) => ({
      color: county.color?.trim() || null,
      county: county.county,
      fips: county.fips,
      rank: index + 1,
      score: county.score,
      state: county.state,
    })),
    ...unscored.map((county) => ({
      color: null,
      county: county.county,
      fips: county.fips,
      rank: null,
      score: null,
      state: county.state,
    })),
  ];
  const query = options?.query ?? "";
  const visibleFips = options?.visibleFips;
  return ranked.filter((county) => {
    if (visibleFips && !visibleFips.has(county.fips)) {
      return false;
    }
    return countyReferenceMatchesQuery(county, query);
  });
}
