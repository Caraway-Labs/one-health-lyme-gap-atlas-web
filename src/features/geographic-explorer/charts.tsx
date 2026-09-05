import { Button } from "@/components/ui/button";
import type { CountyScoreSummary } from "@/generated/models";

import { evidenceLabel, metricLabel, metricValue, STATE_GRID } from "./model";
import type { Metric } from "./model";

type Selection = { selectedFips: string; onSelect: (fips: string) => void };
export function GeographicGrid({
  counties,
  state,
  onState,
  multiples,
  maximum,
}: {
  counties: CountyScoreSummary[];
  state: string;
  onState: (state: string) => void;
  multiples: boolean;
  maximum: number;
}) {
  const byState = new Map<string, CountyScoreSummary[]>();
  for (const county of counties) {
    const group = byState.get(county.state) ?? [];
    group.push(county);
    byState.set(county.state, group);
  }
  return (
    <>
      <p>
        Approximate geographic positions; Alaska and Hawaii are insets. Each
        tile has equal space. Counts refer to matching county records, not
        people or disease burden.
      </p>
      {multiples && (
        <p>
          Each dot is one county. All panels use the same horizontal
          evidence-completeness scale: 0–{maximum}%. Vertical offsets separate
          overlapping dots; they do not encode a measure.
        </p>
      )}
      <div
        className="geo-grid-scroll"
        role="region"
        aria-label="Geographic state grid"
        // Keyboard focus enables horizontal scrolling on narrow screens.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <div className="geo-state-grid">
          {STATE_GRID.map(({ code, row, column }) => {
            const group = byState.get(code) ?? [];
            return (
              <div
                key={code}
                className="geo-state-tile"
                style={{ gridRow: row, gridColumn: column }}
              >
                <Button
                  disabled={group.length === 0}
                  variant={state === code ? "secondary" : "ghost"}
                  aria-pressed={state === code}
                  aria-label={`${code}: ${group.length} matching counties`}
                  onClick={() => onState(state === code ? "ALL" : code)}
                >
                  <strong>{code}</strong>
                  <span>
                    {group.length ? `${group.length} counties` : "No results"}
                  </span>
                </Button>
                {multiples && group.length > 0 && (
                  <svg
                    viewBox="0 0 110 55"
                    role="img"
                    aria-label={`${code}, ${group.length} counties; exact completeness values in the county table`}
                  >
                    <title>{code} county completeness</title>
                    <line
                      x1="8"
                      y1="40"
                      x2="102"
                      y2="40"
                      stroke="currentColor"
                    />
                    {group.map((county, index) => (
                      <circle
                        key={county.fips}
                        cx={8 + (county.evidence_completeness / maximum) * 94}
                        cy={8 + (index % 5) * 6}
                        r="2"
                        fill="var(--teal)"
                      >
                        <title>
                          {county.county}: {county.evidence_completeness}%
                        </title>
                      </circle>
                    ))}
                    <text x="8" y="53" fontSize="10" fill="currentColor">
                      0
                    </text>
                    <text
                      x="102"
                      y="53"
                      textAnchor="end"
                      fontSize="10"
                      fill="currentColor"
                    >
                      {maximum}
                    </text>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function EvidenceTable({
  counties,
  selectedFips,
  onSelect,
}: { counties: CountyScoreSummary[] } & Selection) {
  return (
    <div
      className="geo-table-scroll"
      role="region"
      aria-label="County evidence values"
      // Keyboard users must be able to scroll the complete evidence table.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <table className="geo-table">
        <caption>
          Exact county evidence and chart values for this results page
        </caption>
        <thead>
          <tr>
            <th scope="col">County / FIPS</th>
            <th scope="col">Human reporting</th>
            <th scope="col">Tick evidence</th>
            <th scope="col">Pathogen evidence</th>
            <th scope="col">Completeness (%)</th>
            <th scope="col">Review score (0–100)</th>
            <th scope="col">Review priority</th>
          </tr>
        </thead>
        <tbody>
          {counties.map((county) => (
            <tr key={county.fips} aria-selected={selectedFips === county.fips}>
              <th scope="row">
                <Button
                  variant="ghost"
                  onClick={() => onSelect(county.fips)}
                  aria-pressed={selectedFips === county.fips}
                >
                  {county.county}, {county.state}
                  <br />
                  {county.fips}
                </Button>
              </th>
              <td>{evidenceLabel(county.human_status)}</td>
              <td>{evidenceLabel(county.tick_status)}</td>
              <td>{evidenceLabel(county.burgdorferi_status)}</td>
              <td>{county.evidence_completeness}</td>
              <td>{county.score.score.toFixed(1)}</td>
              <td>{county.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankedDots({
  counties,
  metric,
  maximum,
  selectedFips,
  onSelect,
}: {
  counties: CountyScoreSummary[];
  metric: Metric;
  maximum: number;
} & Selection) {
  return (
    <div className="geo-dot-plot">
      <p>
        {metricLabel(metric)} · common scale 0–{maximum}. Highest values first;
        ties use county FIPS.
      </p>
      {counties.map((county) => (
        <div key={county.fips} className="geo-dot-row">
          <Button
            variant="ghost"
            aria-pressed={county.fips === selectedFips}
            onClick={() => onSelect(county.fips)}
          >
            {county.county}, {county.state}
          </Button>
          <svg
            viewBox="0 0 320 28"
            role="img"
            aria-label={`${county.county}: ${metricValue(county, metric)} ${metric === "score" ? "review score" : "percent completeness"}`}
          >
            <title>
              {county.county}: {metricValue(county, metric)}
            </title>
            <line x1="8" y1="14" x2="312" y2="14" stroke="var(--border)" />
            <circle
              cx={8 + (metricValue(county, metric) / maximum) * 304}
              cy="14"
              r="5"
              fill="var(--teal)"
            />
          </svg>
          <strong>
            {metricValue(county, metric).toFixed(metric === "score" ? 1 : 0)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function ScatterPlot({
  counties,
  maximum,
  selectedFips,
  onSelect,
}: { counties: CountyScoreSummary[]; maximum: number } & Selection) {
  return (
    <div>
      <p>
        Each point represents one matching county. Select a point or its table
        row to highlight it on the map. Overlapping points are individually
        accessible in the table.
      </p>
      <svg
        className="geo-scatter"
        viewBox="0 0 600 370"
        role="group"
        aria-label="County evidence completeness versus review score"
      >
        <title>Evidence completeness versus review score</title>
        <line x1="60" y1="310" x2="565" y2="310" stroke="currentColor" />
        <line x1="60" y1="25" x2="60" y2="310" stroke="currentColor" />
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <text
              x="50"
              y={315 - value * 2.8}
              textAnchor="end"
              fill="currentColor"
              fontSize="13"
            >
              {value}
            </text>
            <line
              x1="60"
              x2="565"
              y1={310 - value * 2.8}
              y2={310 - value * 2.8}
              stroke="var(--border)"
            />
          </g>
        ))}
        <text x="60" y="330" fill="currentColor" fontSize="13">
          0
        </text>
        <text
          x="565"
          y="330"
          fill="currentColor"
          textAnchor="end"
          fontSize="13"
        >
          {maximum}
        </text>
        <text
          x="310"
          y="357"
          textAnchor="middle"
          fill="currentColor"
          fontSize="14"
        >
          Evidence completeness (%)
        </text>
        <text
          transform="translate(16 180) rotate(-90)"
          textAnchor="middle"
          fill="currentColor"
          fontSize="14"
        >
          Review score (0–100)
        </text>
        {counties.map((county) => (
          <circle
            key={county.fips}
            cx={60 + (county.evidence_completeness / maximum) * 505}
            cy={310 - county.score.score * 2.8}
            r={county.fips === selectedFips ? 7 : 4}
            fill={
              county.fips === selectedFips ? "var(--foreground)" : "var(--teal)"
            }
            opacity="0.8"
            role="button"
            tabIndex={0}
            aria-label={`Select ${county.county}, ${county.state}: ${county.evidence_completeness}%, score ${county.score.score}`}
            onClick={() => onSelect(county.fips)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(county.fips);
              }
            }}
          >
            <title>
              {county.county}, {county.state}: {county.evidence_completeness} %;
              score {county.score.score}
            </title>
          </circle>
        ))}
      </svg>
      <p>
        Descriptive comparison only. Completeness and review score may reflect
        shared inputs; their relationship is not evidence of causation or
        individual disease risk.
      </p>
    </div>
  );
}

export function CountyComparisons({
  counties,
  onRemove,
}: {
  counties: CountyScoreSummary[];
  onRemove: (fips: string) => void;
}) {
  if (!counties.length)
    return (
      <p>
        Select a county, then choose “Add to comparison”. Compare up to five
        counties from this release.
      </p>
    );
  const components = [
    ["Review score", "score"],
    ["Human reporting weakness", "human_weakness"],
    ["Ecological component", "ecological"],
    ["Community component", "community"],
  ] as const;
  return (
    <>
      <p>
        All bars use 0–100. Components are methodology-defined signals, not case
        counts or probabilities. Comparison counties remain selected when you
        change filters.
      </p>
      <div className="geo-comparisons">
        {counties.map((county) => (
          <article key={county.fips} className="geo-comparison">
            <h3>
              {county.county}, {county.state}
            </h3>
            <p>FIPS {county.fips}</p>
            {components.map(([label, key]) => (
              <div key={key} className="geo-measure">
                <div>
                  <span>{label}</span>
                  <strong>{county.score[key].toFixed(1)}</strong>
                </div>
                <meter
                  min="0"
                  max="100"
                  value={county.score[key]}
                  aria-label={`${county.county} ${label}`}
                />
              </div>
            ))}
            <dl>
              <dt>Human reporting</dt>
              <dd>{evidenceLabel(county.human_status)}</dd>
              <dt>Tick evidence</dt>
              <dd>{evidenceLabel(county.tick_status)}</dd>
              <dt>Pathogen evidence</dt>
              <dd>{evidenceLabel(county.burgdorferi_status)}</dd>
              <dt>Completeness</dt>
              <dd>{county.evidence_completeness}%</dd>
              <dt>Review priority</dt>
              <dd>{county.priority}</dd>
            </dl>
            <Button variant="secondary" onClick={() => onRemove(county.fips)}>
              Remove {county.county}
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
