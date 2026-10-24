"use client";

import { communityPointPercent } from "@/features/ux-reset/compare/compare-public-status";

type ChartPoint = {
  name: string;
  shown: string | null;
  value: number | null;
};

/**
 * Two labeled dots on one fixed axis.
 * County A is teal and County B is navy. The letters are also in the text.
 */
export function CompareCommunityChart({
  left,
  max,
  meaning,
  min,
  right,
  summary,
  ticks,
  title,
  unit,
}: {
  left: ChartPoint;
  max: number;
  meaning: string;
  min: number;
  right: ChartPoint;
  summary: string;
  ticks: readonly number[];
  title: string;
  unit: string;
}) {
  const points = [
    { letter: "A", point: left, tone: "a" },
    { letter: "B", point: right, tone: "b" },
  ] as const;
  const placed = points.flatMap((entry) => {
    if (entry.point.value === null) {
      return [];
    }
    const position = communityPointPercent(entry.point.value, min, max);
    return position === null ? [] : [{ ...entry, position }];
  });
  const samePosition =
    placed.length === 2 && placed[0]?.position === placed[1]?.position;
  return (
    <figure className="compare-chart" data-testid={`compare-chart-${title}`}>
      <figcaption>
        <strong>{title}</strong>
        <span>{unit}</span>
      </figcaption>
      <div className="compare-chart-plot">
        <svg
          aria-hidden="true"
          className="compare-chart-svg"
          viewBox="0 0 320 92"
        >
          <line
            className="compare-chart-axis"
            x1="16"
            x2="304"
            y1="58"
            y2="58"
          />
          {placed.length === 2 && placed[0] && placed[1] ? (
            <line
              className="compare-chart-link"
              x1={16 + (placed[0].position / 100) * 288}
              x2={16 + (placed[1].position / 100) * 288}
              y1="58"
              y2="58"
            />
          ) : null}
          {placed.map((entry) => {
            const x = 16 + (entry.position / 100) * 288;
            const labelY = entry.letter === "A" || !samePosition ? 28 : 18;
            return (
              <g key={entry.letter}>
                <circle
                  className={`compare-chart-dot compare-chart-dot-${entry.tone}`}
                  cx={x}
                  cy="58"
                  r="6"
                />
                <text
                  className="compare-chart-tag"
                  textAnchor="middle"
                  x={x}
                  y={labelY}
                >
                  {`${entry.letter} ${entry.point.shown ?? ""}`}
                </text>
              </g>
            );
          })}
          {ticks.map((tick) => {
            const position = communityPointPercent(tick, min, max);
            if (position === null) {
              return null;
            }
            const x = 16 + (position / 100) * 288;
            return (
              <g key={tick}>
                <line
                  className="compare-chart-tick"
                  x1={x}
                  x2={x}
                  y1="58"
                  y2="64"
                />
                <text
                  className="compare-chart-tick-label"
                  textAnchor="middle"
                  x={x}
                  y="80"
                >
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="compare-chart-summary">{summary}</p>
      <p className="compare-chart-meaning">{meaning}</p>
      <p className="sr-only">
        {placed.length === 0
          ? `${title} chart is omitted because neither county has a plotted value.`
          : `${title}. ${placed
              .map(
                (entry) =>
                  `County ${entry.letter}, ${entry.point.name}: ${entry.point.shown ?? "value not plotted"} at ${entry.point.value} on a ${min} to ${max} ${unit} axis.`
              )
              .join(" ")} ${summary}`}
      </p>
    </figure>
  );
}
