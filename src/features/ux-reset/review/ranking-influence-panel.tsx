"use client";

import Link from "next/link";

import {
  RANKING_INFLUENCE_EVIDENCE_DISTINCTION,
  RANKING_INFLUENCE_NO_BREAKDOWN,
  RANKING_INFLUENCE_PUBLISHED_SCORE,
  RANKING_INFLUENCE_RANK_SCOPE,
  RANKING_INFLUENCE_SUMMARY,
  RANKING_METHODOLOGY_HREF,
  RANKING_METHODOLOGY_LABEL,
  rankingInfluenceFor,
  type RankingInfluenceCounty,
} from "@/features/ux-reset/review/ranking-influence";

export function RankingInfluencePanel({
  detail,
}: {
  detail: RankingInfluenceCounty;
}) {
  const copy = rankingInfluenceFor(detail);
  return (
    <details
      className="ux-reset-ranking-influence"
      data-testid="ranking-influence"
    >
      <summary>{RANKING_INFLUENCE_SUMMARY}</summary>
      <div className="ux-reset-ranking-influence-body">
        <p>{RANKING_INFLUENCE_EVIDENCE_DISTINCTION}</p>
        <p>{RANKING_INFLUENCE_PUBLISHED_SCORE}</p>
        <p>{RANKING_INFLUENCE_RANK_SCOPE}</p>
        <p data-testid="ranking-influence-breakdown">
          {RANKING_INFLUENCE_NO_BREAKDOWN}
        </p>
        {copy.scopeNote ? <p>{copy.scopeNote}</p> : null}
        <ul>
          <li>{copy.human}</li>
          <li>{copy.tick}</li>
          <li>{copy.pathogen}</li>
          <li>{copy.community}</li>
        </ul>
        <p>
          <Link
            data-testid="ranking-influence-methodology"
            href={RANKING_METHODOLOGY_HREF}
          >
            {RANKING_METHODOLOGY_LABEL}
          </Link>
        </p>
      </div>
    </details>
  );
}
