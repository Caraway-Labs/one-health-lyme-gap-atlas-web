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
  caption,
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
  caption: string;
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
  const crowded =
    placed.length === 2 &&
    Math.abs((placed[0]?.position ?? 0) - (placed[1]?.position ?? 0)) < 16;
  const plotX = (position: number) => 36 + (position / 100) * 568;
  return (
    <figure className="compare-chart" data-testid={`compare-chart-${title}`}>
      <figcaption>
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
      <div className="compare-chart-plot">
        <svg
          aria-hidden="true"
          className="compare-chart-svg"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 640 76"
        >
          <line
            className="compare-chart-axis"
            x1="36"
            x2="604"
            y1="46"
            y2="46"
          />
          {placed.length === 2 && placed[0] && placed[1] ? (
            <line
              className="compare-chart-link"
              x1={plotX(placed[0].position)}
              x2={plotX(placed[1].position)}
              y1="46"
              y2="46"
            />
          ) : null}
          {placed.map((entry) => {
            const x = plotX(entry.position);
            const labelY =
              entry.letter === "B" && (samePosition || crowded) ? 16 : 32;
            return (
              <g key={entry.letter}>
                <circle
                  className={`compare-chart-dot compare-chart-dot-${entry.tone}`}
                  cx={x}
                  cy="46"
                  r="4.5"
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
            const x = plotX(position);
            return (
              <g key={tick}>
                <line
                  className="compare-chart-tick"
                  x1={x}
                  x2={x}
                  y1="46"
                  y2="50"
                />
                <text
                  className="compare-chart-tick-label"
                  textAnchor="middle"
                  x={x}
                  y="66"
                >
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="compare-chart-summary">{summary}</p>
      <p className="sr-only">
        {placed.length === 0
          ? `${title} chart is omitted because neither county has a plotted value.`
          : `${title}. ${placed
              .map(
                (entry) =>
                  `County ${entry.letter}, ${entry.point.name}: ${entry.point.shown ?? "value not plotted"} at ${entry.point.value} on a ${min} to ${max} ${unit} axis.`
              )
              .join(" ")} ${summary} ${meaning}`}
      </p>
    </figure>
  );
}
