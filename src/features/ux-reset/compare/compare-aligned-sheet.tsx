"use client";

import type { ReactNode } from "react";

import type { CompareWithholdReason } from "@/features/ux-reset/compare/compare-alignment";
import { CompareCommunityChart } from "@/features/ux-reset/compare/compare-community-chart";
import { compareReaderState } from "@/features/ux-reset/compare/compare-compact-evidence";
import {
  compareProfilePeriodQualification,
  type CompareProfileAlignment,
} from "@/features/ux-reset/compare/compare-county-profile";
import {
  comparePublicStatus,
  uninsuredAxisMax,
} from "@/features/ux-reset/compare/compare-public-status";
import type { ReconciledAlignmentRow } from "@/features/ux-reset/compare/compare-unified-rows";
import {
  buildCompareGlanceSide,
  compareCommunitySide,
  compareProvenanceFacts,
  type CompareSideValue,
  type CompareVisualRow,
} from "@/features/ux-reset/compare/compare-visual-model";
import {
  CompareInfoButton,
  CompareMeasureValue,
  type CompareCountyIdentity,
} from "@/features/ux-reset/compare/compare-visual-parts";
import {
  CompareSourcesTable,
  type CompareSourceEntry,
} from "@/features/ux-reset/compare/compare-visual-sections";
import { PUBLISHED_LYME_CASE_YEAR } from "@/features/ux-reset/review/published-human-case-copy";

import "./compare-aligned.css";

type CountyPair = readonly [CompareCountyIdentity, CompareCountyIdentity];

const HUMAN_NOTE = "Published minimums may undercount the actual total.";
const TICK_NOTE =
  "Unavailable does not mean absent. Tick status does not measure abundance.";
const HUMAN_CALLOUT =
  "County Lyme case counts and rates are unavailable for both counties in this comparison. Missing values are not zero.";
const STATE_SEPARATION = "State records are separate from county totals.";
const SVI_MEANING =
  "A higher percentile means higher social vulnerability on this index. The reference is the national county percentile in the CDC/ATSDR Social Vulnerability Index 2022 product (RPL_THEMES). It is not a percentage of people and it does not explain personal exposure.";
const UNINSURED_MEANING =
  "Percent of the civilian noninstitutionalized population, from EP_UNINSUR in the CDC/ATSDR Social Vulnerability Index 2022 product. The denominator is not total population. This percentage does not establish individual risk.";
const SCORE_METHOD =
  "These numbers are the published score components returned with the county record. Each is on a 0–100 scale. They are not case counts, case rates, or a measure of how complete the county data is. For the published surveillance-gap-score-v1.1 method, the score multiplies the human-data component by a mix of the ecological component (weight 0.65) and the community component (weight 0.35), divides by 100, and rounds to one decimal. The weights are formula weights, not percentages of cases.";

const WITHHOLD_TEXT: Record<CompareWithholdReason, string> = {
  denominator_mismatch:
    "A difference is not shown because the denominators differ.",
  failed: "A difference is not shown because a value could not be loaded.",
  geography_mismatch:
    "A difference is not shown because the geographies differ.",
  methodology_mismatch: "A difference is not shown because the methods differ.",
  missing_side:
    "A difference cannot be calculated because a value is unavailable.",
  multiple_observations:
    "A single difference is not shown because more than one observation was returned.",
  non_numeric:
    "These values are shown side by side. A numeric difference does not apply.",
  period_mismatch: "A difference is not shown because the periods differ.",
  release_mismatch: "A difference is not shown because the releases differ.",
  strata_mismatch: "A difference is not shown because the definitions differ.",
  unit_mismatch: "A difference is not shown because the units differ.",
  unsupported_period:
    "A difference is not shown because this period is not supported.",
};

function countyName(county: CompareCountyIdentity): string {
  return county.countyName ?? county.label;
}

function sideYear(side: CompareSideValue): string | null {
  if (side.kind !== "value") {
    return null;
  }
  const period = compareProvenanceFacts(side.evidence).period ?? "";
  const match = /\b(?<year>(?:19|20)\d{2})\b/.exec(period);
  return match?.groups?.year ?? null;
}

function humanCallout(rows: readonly CompareVisualRow[]): string | null {
  const wanted = ["human_case_floor", "incidence_floor"] as const;
  const selected = wanted.map((id) => rows.find((row) => row.id === id));
  if (selected.some((row) => !row)) {
    return null;
  }
  const sides = selected.flatMap((row) => (row ? [row.left, row.right] : []));
  const blocked = sides.some(
    (side) =>
      side.kind === "value" ||
      side.reason === "failed" ||
      side.reason === "release_mismatch" ||
      side.reason === "suppressed"
  );
  return blocked ? null : HUMAN_CALLOUT;
}

function trailingYear(id: string): string | null {
  return /_(?<year>\d{4})$/.exec(id)?.groups?.year ?? null;
}

function withYear(label: string, id: string): string {
  const year = trailingYear(id);
  return year ? `${label} — ${year}` : label;
}

function measureCopy(row: CompareVisualRow): {
  note: string | null;
  primary: string;
  scientific: string | null;
} {
  switch (row.id) {
    case "human_case_floor": {
      return {
        note: null,
        primary: `Minimum reported cases — ${PUBLISHED_LYME_CASE_YEAR}`,
        scientific: null,
      };
    }
    case "incidence_floor": {
      return {
        note: null,
        primary: `Minimum reported rate per 100,000 people — ${PUBLISHED_LYME_CASE_YEAR}`,
        scientific: null,
      };
    }
    case "scapularis_status": {
      return {
        note: null,
        primary: "Blacklegged tick",
        scientific: "Ixodes scapularis",
      };
    }
    case "pacificus_status": {
      return {
        note: null,
        primary: "Western blacklegged tick",
        scientific: "Ixodes pacificus",
      };
    }
    case "burgdorferi_status": {
      return {
        note: null,
        primary: "Lyme disease bacterium",
        scientific: "Borrelia burgdorferi",
      };
    }
    case "population_2022": {
      return {
        note: null,
        primary: withYear("Population", row.id),
        scientific: null,
      };
    }
    case "svi_percentile_2022": {
      return {
        note: "National county percentile. This is not a percentage of people.",
        primary: withYear("Social vulnerability percentile", row.id),
        scientific: null,
      };
    }
    case "uninsured_percent_2022": {
      return {
        note: "Percent of the civilian noninstitutionalized population.",
        primary: withYear("Uninsured population (%)", row.id),
        scientific: null,
      };
    }
    case "rucc_2023": {
      return {
        note: null,
        primary: withYear("Rural–urban classification", row.id),
        scientific: null,
      };
    }
    case "state_unallocated_2023": {
      return {
        note: null,
        primary: "State records without a county assignment",
        scientific: null,
      };
    }
    default: {
      return { note: null, primary: row.label, scientific: null };
    }
  }
}

function CellValue({
  categorical,
  county,
  row,
  side,
}: {
  categorical: boolean;
  county: CompareCountyIdentity;
  row: CompareVisualRow;
  side: CompareSideValue;
}) {
  const rural =
    row.id === "rucc_2023" ? compareCommunitySide(row.id, "rucc", side) : null;
  const status = comparePublicStatus(side, categorical);
  const label =
    rural?.classification && rural.code !== null
      ? rural.classification
      : status.label;
  const publishedYear =
    row.id === "human_case_floor" || row.id === "incidence_floor"
      ? PUBLISHED_LYME_CASE_YEAR
      : trailingYear(row.id);
  const observedYear = sideYear(side);
  const year = observedYear === publishedYear ? null : observedYear;
  const caveat =
    side.kind === "value"
      ? side.evidence.provenance.materialCaveat?.trim() || null
      : null;
  return (
    <div
      data-evidence-availability={
        side.kind === "value" ? side.evidence.availability : "unavailable"
      }
      data-fips={county.fips}
      data-observation={side.kind === "missing" ? side.reason : "present"}
      data-testid={`compare-profile-cell-${row.id}-${county.fips}`}
    >
      <span className="sr-only">{`County ${county.letter}, ${county.label}: `}</span>
      <p className="compare-cell-value">{label}</p>
      {rural?.code !== null && rural?.code !== undefined ? (
        <p className="compare-cell-meta">{`RUCC ${rural.code}`}</p>
      ) : null}
      {year ? <p className="compare-cell-meta">{year}</p> : null}
      {status.detail ? (
        <p className="compare-cell-meta">{status.detail}</p>
      ) : null}
      {rural?.detail ? (
        <p className="compare-cell-meta">{rural.detail}</p>
      ) : null}
      {caveat ? <p className="compare-cell-meta">{caveat}</p> : null}
      {side.kind === "missing" ? <p className="sr-only">{side.text}</p> : null}
      {side.kind === "value" ? (
        <CompareInfoButton
          county={county.label}
          evidence={side.evidence}
          label={measureCopy(row).primary}
        />
      ) : null}
    </div>
  );
}

function SectionBand({ id, title }: { id: string; title: string }) {
  return (
    <tr className="compare-band" data-testid={`compare-group-${id}`}>
      <th colSpan={3} id={`compare-section-${id}-title`} scope="colgroup">
        {title}
      </th>
    </tr>
  );
}

function NoteBand({ children }: { children: string }) {
  return (
    <tr className="compare-note">
      <td colSpan={3}>{children}</td>
    </tr>
  );
}

function DataRow({
  categorical,
  counties,
  row,
}: {
  categorical: boolean;
  counties: CountyPair;
  row: CompareVisualRow;
}) {
  const copy = measureCopy(row);
  return (
    <tr
      data-gap={row.gap ? "true" : "false"}
      data-relation={row.relation}
      data-row-id={row.id}
      data-testid={`compare-profile-row-${row.id}`}
    >
      <th scope="row">
        <span className="compare-measure-name">{copy.primary}</span>
        {copy.scientific ? (
          <em className="compare-scientific">{copy.scientific}</em>
        ) : null}
        {copy.note ? (
          <span className="compare-rucc-note">{copy.note}</span>
        ) : null}
      </th>
      <td data-slot="a">
        <CellValue
          categorical={categorical}
          county={counties[0]}
          row={row}
          side={row.left}
        />
      </td>
      <td data-slot="b">
        <CellValue
          categorical={categorical}
          county={counties[1]}
          row={row}
          side={row.right}
        />
      </td>
    </tr>
  );
}

function pointsLabel(
  amount: number,
  unit: "percentile point" | "percentage point"
): string {
  const rendered = amount.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `${rendered} ${unit}${amount === 1 ? "" : "s"}`;
}

function chartSummary(
  kind: "percent" | "percentile",
  left: { name: string; number: number | null; year: string | null },
  right: { name: string; number: number | null; year: string | null }
): string {
  if (left.number === null || right.number === null) {
    return "A difference cannot be calculated because a value is unavailable.";
  }
  if (left.year && right.year && left.year !== right.year) {
    return `A difference is not shown because the years differ (${left.year} and ${right.year}).`;
  }
  const unit = kind === "percentile" ? "percentile point" : "percentage point";
  const places = kind === "percentile" ? 0 : 1;
  const factor = 10 ** places;
  const amount =
    Math.round(Math.abs(right.number - left.number) * factor) / factor;
  if (amount === 0) {
    return `${left.name} and ${right.name} have the same published value.`;
  }
  const higher = right.number > left.number ? right.name : left.name;
  return `${higher}: ${pointsLabel(amount, unit)} higher.`;
}

function CommunityCharts({
  counties,
  rows,
}: {
  counties: CountyPair;
  rows: readonly CompareVisualRow[];
}) {
  const social = rows.find((row) => row.id === "svi_percentile_2022");
  const uninsured = rows.find((row) => row.id === "uninsured_percent_2022");
  if (!(social || uninsured)) {
    return null;
  }
  return (
    <tr className="compare-charts">
      <td colSpan={3}>
        <div className="compare-chart-grid">
          {social ? (
            <CommunityChartBlock
              counties={counties}
              kind="percentile"
              meaning={SVI_MEANING}
              row={social}
              title="Social vulnerability (percentile)"
              unit="Percentile"
            />
          ) : null}
          {uninsured ? (
            <CommunityChartBlock
              counties={counties}
              kind="percent"
              meaning={UNINSURED_MEANING}
              row={uninsured}
              title="Uninsured population (%)"
              unit="Percent"
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function CommunityChartBlock({
  counties,
  kind,
  meaning,
  row,
  title,
  unit,
}: {
  counties: CountyPair;
  kind: "percent" | "percentile";
  meaning: string;
  row: CompareVisualRow;
  title: string;
  unit: string;
}) {
  const infos = [row.left, row.right].map((side, index) => {
    const info = compareCommunitySide(row.id, kind, side);
    return {
      name: countyName(counties[index] ?? counties[0]),
      number: info.number,
      shown: info.shown,
      year: info.year,
    };
  });
  const left = infos[0];
  const right = infos[1];
  if (!(left && right)) {
    return null;
  }
  const max =
    kind === "percentile" ? 100 : uninsuredAxisMax([left.number, right.number]);
  const ticks =
    kind === "percentile"
      ? [0, 20, 40, 60, 80, 100]
      : [0, max / 2, max].filter(
          (tick, index, all) => all.indexOf(tick) === index
        );
  return (
    <CompareCommunityChart
      left={{ name: left.name, shown: left.shown, value: left.number }}
      max={max}
      meaning={meaning}
      min={0}
      right={{ name: right.name, shown: right.shown, value: right.number }}
      summary={chartSummary(kind, left, right)}
      ticks={ticks}
      title={title}
      unit={unit}
    />
  );
}

function observationBucket(
  id: string,
  label: string
): "community" | "human" | "other" | "technical" | "tick" {
  const text = `${id} ${label}`.toLowerCase();
  if (/fips|geometry|geoid|shape/.test(text)) {
    return "technical";
  }
  if (
    /tick|ixodes|scapularis|pacificus|burgdorferi|borrelia|pathogen/.test(text)
  ) {
    return "tick";
  }
  if (/case|incidence|lyme|human/.test(text)) {
    return "human";
  }
  if (/population|svi|uninsured|rucc|rural|vulnerab/.test(text)) {
    return "community";
  }
  return "other";
}

function withholdCopy(row: ReconciledAlignmentRow): string | null {
  if (row.row.relation.kind !== "withheld") {
    return row.note;
  }
  const reasons = row.row.relation.reasons.map(
    (reason) => WITHHOLD_TEXT[reason]
  );
  return [row.note, ...reasons].filter(Boolean).join(" ");
}

function ExtraRows({
  counties,
  rows,
}: {
  counties: CountyPair;
  rows: readonly ReconciledAlignmentRow[];
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <>
      {rows.map((entry) => (
        <tr
          data-measure-id={entry.row.measureId}
          data-testid={`compare-row-${entry.row.measureId}`}
          key={entry.row.measureId}
        >
          <th scope="row">
            {entry.row.measureLabel}
            {withholdCopy(entry) ? (
              <span className="compare-rucc-note">{withholdCopy(entry)}</span>
            ) : null}
          </th>
          {([entry.row.left, entry.row.right] as const).map((cell, index) => {
            const county = counties[index];
            if (!county) {
              return null;
            }
            return (
              <td
                data-slot={county.letter === "A" ? "a" : "b"}
                key={county.letter}
              >
                {cell.kind === "empty" ? (
                  <div
                    data-fips={county.fips}
                    data-measure-id={entry.row.measureId}
                    data-observation={cell.reason}
                    data-testid={`compare-cell-${entry.row.measureId}-${county.fips}`}
                  >
                    <p>{compareReaderState(cell.reason, cell.message)}</p>
                  </div>
                ) : (
                  <div
                    data-fips={county.fips}
                    data-measure-id={entry.row.measureId}
                    data-observation="present"
                    data-testid={`compare-cell-${entry.row.measureId}-${county.fips}`}
                  >
                    {cell.records.map((record) => (
                      <CompareMeasureValue
                        county={county.label}
                        evidence={record.evidence}
                        key={record.observation.observation_id}
                        label={record.evidence.claimLabel}
                      />
                    ))}
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function rowsById(rows: readonly CompareVisualRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function StateContext({
  counties,
  row,
}: {
  counties: CountyPair;
  row: CompareVisualRow | undefined;
}) {
  if (!row) {
    return null;
  }
  const sameState =
    Boolean(counties[0].stateLabel) &&
    counties[0].stateLabel === counties[1].stateLabel;
  const sameValue =
    row.left.kind === "value" &&
    row.right.kind === "value" &&
    row.left.text === row.right.text;
  return (
    <details className="compare-disclosure" data-testid="compare-state-context">
      <summary>State reporting context</summary>
      <p>{STATE_SEPARATION}</p>
      <p>
        <strong>State records without a county assignment</strong>
      </p>
      <p className="compare-cell-meta">
        These records cannot be assigned to either selected county. Do not add
        them to a county total or read them as a county difference.
      </p>
      {sameState && sameValue ? (
        <p>
          <strong>{counties[0].stateLabel}</strong>
          {": "}
          {comparePublicStatus(row.left, false).label}
        </p>
      ) : (
        <ul>
          {counties.map((county, index) => {
            const side = index === 0 ? row.left : row.right;
            const place = county.stateLabel ?? county.label;
            return (
              <li key={county.letter}>
                <strong>{place}</strong>
                {": "}
                {comparePublicStatus(side, false).label}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

function ScoreCalculation({
  counties,
  profile,
  rows,
}: {
  counties: CountyPair;
  profile: CompareProfileAlignment;
  rows: readonly CompareVisualRow[];
}) {
  const sides = [
    buildCompareGlanceSide(profile, rows, "left"),
    buildCompareGlanceSide(profile, rows, "right"),
  ] as const;
  return (
    <details
      className="compare-disclosure"
      data-testid="compare-score-calculation"
    >
      <summary>How the score is calculated</summary>
      <p>{SCORE_METHOD}</p>
      <table>
        <caption className="sr-only">Published score components</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">{`County A, ${countyName(counties[0])}`}</th>
            <th scope="col">{`County B, ${countyName(counties[1])}`}</th>
          </tr>
        </thead>
        <tbody>
          {sides[0].components.map((component, index) => (
            <tr key={component.id}>
              <th scope="row">{component.label}</th>
              {[component.value, sides[1].components[index]?.value].map(
                (value, sideIndex) => (
                  <td key={counties[sideIndex]?.letter ?? sideIndex}>
                    {value === null
                      ? "Not returned"
                      : value.toLocaleString("en-US", {
                          maximumFractionDigits: 1,
                        })}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {sides.map((side, index) =>
        side.reasons.length > 0 ? (
          <div key={counties[index]?.letter ?? index}>
            <p>
              <strong>{`Why this label, ${countyName(counties[index] ?? counties[0])}`}</strong>
            </p>
            <ul>
              {side.reasons.map((reason) => (
                <li key={reason.label}>
                  <strong>{reason.label}</strong> {reason.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}
    </details>
  );
}

function TechnicalDetails({
  counties,
  rows,
}: {
  counties: CountyPair;
  rows: readonly ReconciledAlignmentRow[];
}) {
  return (
    <details
      className="compare-disclosure"
      data-testid="compare-technical-details"
    >
      <summary>Technical details</summary>
      <ul>
        {counties.map((county) => (
          <li key={county.letter}>
            {`County ${county.letter} FIPS ${county.fips}`}
            {county.stateLabel ? `, ${county.stateLabel}` : ""}
          </li>
        ))}
      </ul>
      {rows.length > 0 ? (
        <table>
          <caption className="sr-only">
            Technical fields excluded from the comparison rows
          </caption>
          <tbody>
            <ExtraRows counties={counties} rows={rows} />
          </tbody>
        </table>
      ) : null}
    </details>
  );
}

/**
 * One Measure / County A / County B sheet.
 * Values stay on the published rows. This view does not calculate a score.
 */
export function CompareAlignedSheet({
  counties,
  countyLimitations,
  model,
  period,
  profile,
  rows,
  sharedLimitation,
  sourceEntries,
  supplemental,
}: {
  counties: CountyPair;
  countyLimitations: readonly [string, string] | null;
  model: ReactNode;
  period: string | null;
  profile: CompareProfileAlignment;
  rows: readonly CompareVisualRow[];
  sharedLimitation: string | null;
  sourceEntries: readonly CompareSourceEntry[];
  supplemental: readonly ReconciledAlignmentRow[];
}) {
  const byId = rowsById(rows);
  const human = (["human_case_floor", "incidence_floor"] as const).flatMap(
    (id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    }
  );
  const ticks = (
    ["scapularis_status", "pacificus_status", "burgdorferi_status"] as const
  ).flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  const community = (
    [
      "population_2022",
      "svi_percentile_2022",
      "uninsured_percent_2022",
      "rucc_2023",
    ] as const
  ).flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  const tickAggregate = byId.get("tick_status");
  const grouped = {
    community: supplemental.filter(
      (entry) =>
        observationBucket(entry.row.measureId, entry.row.measureLabel) ===
        "community"
    ),
    human: supplemental.filter(
      (entry) =>
        observationBucket(entry.row.measureId, entry.row.measureLabel) ===
        "human"
    ),
    other: supplemental.filter(
      (entry) =>
        observationBucket(entry.row.measureId, entry.row.measureLabel) ===
        "other"
    ),
    technical: supplemental.filter(
      (entry) =>
        observationBucket(entry.row.measureId, entry.row.measureLabel) ===
        "technical"
    ),
    tick: supplemental.filter(
      (entry) =>
        observationBucket(entry.row.measureId, entry.row.measureLabel) ===
        "tick"
    ),
  };
  const callout = humanCallout(rows);
  return (
    <div className="compare-sheet" data-testid="compare-evidence">
      {callout ? (
        <p className="compare-callout" data-testid="compare-human-callout">
          {callout}
        </p>
      ) : null}
      <div className="compare-sheet-scroll">
        <table>
          <caption className="sr-only">
            {`County data for ${countyName(counties[0])} and ${countyName(counties[1])}`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th data-slot="a" scope="col">
                <span className="compare-col-kicker">County A</span>
                <strong>{countyName(counties[0])}</strong>
                {counties[0].stateLabel ? (
                  <span>{counties[0].stateLabel}</span>
                ) : null}
              </th>
              <th data-slot="b" scope="col">
                <span className="compare-col-kicker">County B</span>
                <strong>{countyName(counties[1])}</strong>
                {counties[1].stateLabel ? (
                  <span>{counties[1].stateLabel}</span>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody>
            {human.length > 0 ? (
              <SectionBand id="human" title="Human Lyme disease data" />
            ) : null}
            {human.map((row) => (
              <DataRow
                categorical={false}
                counties={counties}
                key={row.id}
                row={row}
              />
            ))}
            {human.length > 0 ? <NoteBand>{HUMAN_NOTE}</NoteBand> : null}
            {grouped.human.length > 0 ? (
              <tr>
                <td colSpan={3}>
                  <details
                    aria-label="Additional human-source details"
                    className="compare-disclosure"
                  >
                    <summary>Additional human-source details</summary>
                    <table>
                      <tbody>
                        <ExtraRows counties={counties} rows={grouped.human} />
                      </tbody>
                    </table>
                  </details>
                </td>
              </tr>
            ) : null}
            {ticks.length > 0 ? (
              <SectionBand id="vector" title="Tick and pathogen records" />
            ) : null}
            {ticks.map((row) => (
              <DataRow categorical counties={counties} key={row.id} row={row} />
            ))}
            {ticks.length > 0 ? <NoteBand>{TICK_NOTE}</NoteBand> : null}
            {tickAggregate || grouped.tick.length > 0 ? (
              <tr>
                <td colSpan={3}>
                  <details
                    aria-label="Additional tick-source details"
                    className="compare-disclosure"
                    data-testid="compare-tick-details"
                  >
                    <summary>Additional tick-source details</summary>
                    <p className="compare-cell-meta">
                      These rows stay separate when the source, period, or
                      definition is not the same as the status above.
                    </p>
                    <table>
                      <tbody>
                        {tickAggregate ? (
                          <DataRow
                            categorical
                            counties={counties}
                            row={tickAggregate}
                          />
                        ) : null}
                        <ExtraRows counties={counties} rows={grouped.tick} />
                      </tbody>
                    </table>
                  </details>
                </td>
              </tr>
            ) : null}
            {community.length > 0 ? (
              <SectionBand id="community" title="Community context" />
            ) : null}
            {community.map((row) => (
              <DataRow
                categorical={row.id === "rucc_2023"}
                counties={counties}
                key={row.id}
                row={row}
              />
            ))}
            <CommunityCharts counties={counties} rows={community} />
            {grouped.community.length > 0 ? (
              <tr>
                <td colSpan={3}>
                  <details
                    aria-label="Additional community-source details"
                    className="compare-disclosure"
                  >
                    <summary>Additional community-source details</summary>
                    <table>
                      <tbody>
                        <ExtraRows
                          counties={counties}
                          rows={grouped.community}
                        />
                      </tbody>
                    </table>
                  </details>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="compare-model" data-testid="compare-model-results">
        {model}
        <ScoreCalculation counties={counties} profile={profile} rows={rows} />
      </div>
      <StateContext
        counties={counties}
        row={byId.get("state_unallocated_2023")}
      />
      <CompareSourcesTable
        counties={counties}
        entries={sourceEntries}
        notes={
          <>
            <p data-testid="compare-profile-comparability">
              {compareProfilePeriodQualification(period)}
            </p>
            {sharedLimitation ? (
              <p data-testid="compare-shared-limitation">{sharedLimitation}</p>
            ) : null}
            {countyLimitations
              ? counties.map((county, index) => (
                  <p
                    data-testid={`compare-limitation-${county.fips}`}
                    key={county.letter}
                  >
                    {`${countyName(county)}: ${countyLimitations[index]}`}
                  </p>
                ))
              : null}
            {grouped.other.length > 0 ? (
              <div data-testid="compare-group-additional">
                <p>Additional published observations</p>
                <table>
                  <tbody>
                    <ExtraRows counties={counties} rows={grouped.other} />
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        }
      />
      <TechnicalDetails counties={counties} rows={grouped.technical} />
    </div>
  );
}
