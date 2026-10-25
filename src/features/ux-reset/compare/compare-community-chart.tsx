"use client";

import { communityPointPercent } from "@/features/ux-reset/compare/compare-public-status";

type ChartPoint = {
  name: string;
  shown: string | null;
  value: number | null;
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 104;
const PLOT_LEFT = 52;
const PLOT_WIDTH = 536;
const AXIS_Y = 58;
const MARKER_RADIUS = 12;
const LABEL_GAP = 8;
const MARKER_STACK_OFFSET = MARKER_RADIUS + 2;

type PlacedPoint = {
  letter: "A" | "B";
  point: ChartPoint;
  tone: "a" | "b";
  position: number;
};

export function compareChartPlotX(position: number): number {
  return PLOT_LEFT + (position / 100) * PLOT_WIDTH;
}

export function compareChartMarkerLayout(placed: readonly PlacedPoint[]) {
  const samePosition =
    placed.length === 2 && placed[0]?.position === placed[1]?.position;
  const crowded =
    placed.length === 2 &&
    Math.abs((placed[0]?.position ?? 0) - (placed[1]?.position ?? 0)) < 16;

  return placed.map((entry) => {
    const x = compareChartPlotX(entry.position);
    const stackVertically = samePosition;
    const markerY =
      stackVertically && entry.letter === "A"
        ? AXIS_Y - MARKER_STACK_OFFSET
        : stackVertically && entry.letter === "B"
          ? AXIS_Y + MARKER_STACK_OFFSET
          : AXIS_Y;
    const defaultLabelY = markerY - MARKER_RADIUS - LABEL_GAP;
    const valueLabelY =
      entry.letter === "B" && crowded && !samePosition
        ? defaultLabelY - 16
        : defaultLabelY;
    return {
      ...entry,
      markerY,
      valueLabelY,
      x,
    };
  });
}

/**
 * Two labeled markers on one fixed axis.
 * County A is teal and County B is navy, with A/B inside each marker.
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
    { letter: "A" as const, point: left, tone: "a" as const },
    { letter: "B" as const, point: right, tone: "b" as const },
  ];
  const placed = points.flatMap((entry) => {
    if (entry.point.value === null) {
      return [];
    }
    const position = communityPointPercent(entry.point.value, min, max);
    return position === null ? [] : [{ ...entry, position }];
  });
  const samePosition =
    placed.length === 2 && placed[0]?.position === placed[1]?.position;
  const layout = compareChartMarkerLayout(placed);
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
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        >
          <line
            className="compare-chart-axis"
            x1={PLOT_LEFT}
            x2={PLOT_LEFT + PLOT_WIDTH}
            y1={AXIS_Y}
            y2={AXIS_Y}
          />
          {placed.length === 2 && placed[0] && placed[1] ? (
            <line
              className="compare-chart-link"
              x1={compareChartPlotX(placed[0].position)}
              x2={compareChartPlotX(placed[1].position)}
              y1={samePosition ? AXIS_Y - MARKER_STACK_OFFSET : AXIS_Y}
              y2={samePosition ? AXIS_Y + MARKER_STACK_OFFSET : AXIS_Y}
            />
          ) : null}
          {layout.map((entry) => (
            <g key={entry.letter}>
              <circle
                className={`compare-chart-marker compare-chart-marker-${entry.tone}`}
                cx={entry.x}
                cy={entry.markerY}
                r={MARKER_RADIUS}
              />
              <text
                className="compare-chart-marker-letter"
                dominantBaseline="central"
                textAnchor="middle"
                x={entry.x}
                y={entry.markerY}
              >
                {entry.letter}
              </text>
              <text
                className="compare-chart-tag"
                textAnchor="middle"
                x={entry.x}
                y={entry.valueLabelY}
              >
                {entry.point.shown ?? ""}
              </text>
            </g>
          ))}
          {ticks.map((tick) => {
            const position = communityPointPercent(tick, min, max);
            if (position === null) {
              return null;
            }
            const x = compareChartPlotX(position);
            return (
              <g key={tick}>
                <line
                  className="compare-chart-tick"
                  x1={x}
                  x2={x}
                  y1={AXIS_Y}
                  y2={AXIS_Y + 4}
                />
                <text
                  className="compare-chart-tick-label"
                  textAnchor="middle"
                  x={x}
                  y={AXIS_Y + 20}
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
