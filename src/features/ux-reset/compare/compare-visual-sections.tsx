"use client";

import {
  Check,
  Copy,
  Equal,
  MessageSquare,
  Printer,
  SquareDashed,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type {
  CompareCell,
  CompareRelation,
} from "@/features/ux-reset/compare/compare-alignment";
import { compareReaderState } from "@/features/ux-reset/compare/compare-compact-evidence";
import {
  CompareSlotMarker,
  ReviewCategoryMark,
  type ReviewCategoryBadge,
} from "@/features/ux-reset/compare/compare-county-picker";
import {
  compareProfilePeriodQualification,
  type CompareProfileAlignment,
} from "@/features/ux-reset/compare/compare-county-profile";
import type { ReconciledAlignmentRow } from "@/features/ux-reset/compare/compare-unified-rows";
import {
  buildCompareGlanceSide,
  compareAbsenceEmptyCopy,
  compareAbsencePhrase,
  compareCouldNotLoadPhrase,
  compareGapSummary,
  compareNotUsablePhrase,
  compareProvenanceFacts,
  compareProvenanceUnknown,
  compareRowsForSection,
  compareSectionCaption,
  compareUnknownIntroduction,
  compareVisualSectionIds,
  compareVisualSectionTitles,
  type CompareCoverage,
  type CompareGapItem,
  type CompareGapSides,
  type CompareGlanceSide,
  type CompareRowFilters,
  type CompareSummaryCounts,
  type CompareVisualRow,
  type CompareVisualSectionId,
} from "@/features/ux-reset/compare/compare-visual-model";
import {
  CompareMeasureValue,
  CompareMiniTrack,
  CompareScoreRing,
  CompareVisualRowView,
  type CompareCountyIdentity,
} from "@/features/ux-reset/compare/compare-visual-parts";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { cn } from "@/lib/utils";

type CountyPair = readonly [CompareCountyIdentity, CompareCountyIdentity];

function coverageWord(coverage: CompareCoverage): string {
  switch (coverage) {
    case "available": {
      return "Available";
    }
    case "limited": {
      return "Limited";
    }
    case "unavailable": {
      return "Unavailable";
    }
    default: {
      const exhaustive: never = coverage;
      return exhaustive;
    }
  }
}

function CoverageRow({
  coverage,
  section,
}: {
  coverage: CompareCoverage;
  section: CompareVisualSectionId;
}) {
  return (
    <li
      className="ux-reset-compare-coverage"
      data-coverage={coverage}
      data-testid={`compare-coverage-${section}`}
    >
      <span aria-hidden="true" className="ux-reset-compare-coverage-dot" />
      <span>{compareVisualSectionTitles[section].title}</span>
      <strong>{coverageWord(coverage)}</strong>
    </li>
  );
}

function GlanceCard({
  county,
  glance,
  reviewBadge,
}: {
  county: CompareCountyIdentity;
  glance: CompareGlanceSide;
  reviewBadge: ReviewCategoryBadge | null;
}) {
  return (
    <Card
      className="ux-reset-compare-glance-card"
      data-testid={`compare-glance-${county.fips}`}
      size="sm"
    >
      <CardHeader>
        <CardTitle className="ux-reset-compare-glance-title">
          <CompareSlotMarker letter={county.letter} />
          <span>{county.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="ux-reset-compare-glance-body">
        <div className="ux-reset-compare-glance-review">
          {reviewBadge ? (
            <ReviewCategoryMark
              badge={reviewBadge}
              fips={county.fips}
              testIdPrefix="compare-glance-review"
            />
          ) : (
            <span
              className="ux-reset-compare-missing"
              data-observation="unavailable"
            >
              <SquareDashed aria-hidden="true" className="size-3.5" />
              Review category unavailable
            </span>
          )}
        </div>
        <div className="ux-reset-compare-glance-score">
          <CompareScoreRing
            label={`Published review score, ${county.label}`}
            value={glance.score}
          />
          <div className="ux-reset-compare-glance-components">
            <p className="type-small">Published review score</p>
            {glance.components.map((component) => (
              <CompareMiniTrack
                key={component.id}
                label={component.label}
                value={component.value}
              />
            ))}
          </div>
        </div>
        <ul
          aria-label={`Evidence coverage, ${county.label}`}
          className="ux-reset-compare-coverage-list"
        >
          {compareVisualSectionIds.map((section) => (
            <CoverageRow
              coverage={glance.coverage[section]}
              key={section}
              section={section}
            />
          ))}
        </ul>
        {glance.reasons.length > 0 ? (
          <details
            className="ux-reset-compare-reasons-details"
            data-testid={`compare-profile-cell-review_reasons-${county.fips}`}
          >
            <summary>Why this label ({glance.reasons.length})</summary>
            <ul className="ux-reset-compare-reasons">
              {glance.reasons.map((reason) => (
                <li key={reason.label}>
                  <p className="ux-reset-compare-reason-label">
                    {reason.label}
                  </p>
                  <p className="type-small">{reason.text}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Section 1: one card per county. Both cards are equal. No winner. */
export function CompareAtAGlance({
  counties,
  profile,
  reviewBadges,
  rows,
}: {
  counties: CountyPair;
  profile: CompareProfileAlignment;
  reviewBadges: readonly [
    ReviewCategoryBadge | null,
    ReviewCategoryBadge | null,
  ];
  rows: readonly CompareVisualRow[];
}) {
  const titleId = useId();
  const left = buildCompareGlanceSide(profile, rows, "left");
  const right = buildCompareGlanceSide(profile, rows, "right");
  return (
    <section
      aria-labelledby={titleId}
      className="ux-reset-compare-glance"
      data-testid="compare-at-a-glance"
    >
      <h3 className="ux-reset-compare-section-title" id={titleId}>
        At a glance
      </h3>
      <p className="type-small">
        A review priority label, not a disease risk. The two counties are shown
        in the order you chose, with no rank.
      </p>
      <div className="ux-reset-compare-glance-grid">
        <GlanceCard
          county={counties[0]}
          glance={left}
          reviewBadge={reviewBadges[0]}
        />
        <GlanceCard
          county={counties[1]}
          glance={right}
          reviewBadge={reviewBadges[1]}
        />
      </div>
    </section>
  );
}

function SummaryItem({
  count,
  icon,
  label,
  testId,
}: {
  count: number;
  icon: ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <li data-testid={testId}>
      <span aria-hidden="true" className="ux-reset-compare-summary-icon">
        {icon}
      </span>
      <strong>{count}</strong>
      <span>{label}</span>
    </li>
  );
}

function FilterSwitch({
  checked,
  label,
  onChange,
  testId,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="ux-reset-compare-filter">
      <Switch
        checked={checked}
        data-testid={testId}
        id={id}
        onCheckedChange={onChange}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/**
 * Summary counts for the whole comparison, then the two filters.
 * Counts compare published text only. They never calculate a difference.
 */
export function CompareEvidenceToolbar({
  counts,
  filters,
  onFiltersChange,
  partial,
  shown,
  total,
}: {
  counts: CompareSummaryCounts | null;
  filters: CompareRowFilters;
  onFiltersChange: (next: CompareRowFilters) => void;
  partial: boolean;
  shown: number;
  total: number;
}) {
  return (
    <div
      aria-label="Comparison summary and filters"
      className="ux-reset-compare-toolbar"
      data-testid="compare-summary"
      role="group"
    >
      {counts ? (
        <ul className="ux-reset-compare-summary-counts">
          <SummaryItem
            count={counts.same}
            icon={<Equal className="size-4" />}
            label="Same value"
            testId="compare-count-similar"
          />
          <SummaryItem
            count={counts.different}
            icon={<Waypoints className="size-4" />}
            label="Different values"
            testId="compare-count-different"
          />
          <SummaryItem
            count={counts.incomparable}
            icon={<SquareDashed className="size-4" />}
            label="Not comparable"
            testId="compare-count-withheld"
          />
        </ul>
      ) : null}
      <div className="ux-reset-compare-filters">
        <FilterSwitch
          checked={filters.onlyDifferences}
          label="Show only differences"
          testId="compare-filter-differences"
          onChange={(next) => {
            onFiltersChange({ ...filters, onlyDifferences: next });
          }}
        />
        <FilterSwitch
          checked={filters.onlyGaps}
          label="Show only evidence gaps"
          testId="compare-filter-gaps"
          onChange={(next) => {
            onFiltersChange({ ...filters, onlyGaps: next });
          }}
        />
        <p
          aria-live="polite"
          className="type-small ux-reset-compare-filter-count"
          data-testid="compare-filter-count"
        >
          {shown} of {total} rows
        </p>
      </div>
      {partial ? (
        <p className="type-small" data-testid="compare-overview-partial">
          Some additional observations did not load. They are counted as not
          comparable, never as the same or different. Loaded county records stay
          visible.
        </p>
      ) : null}
      <details className="ux-reset-compare-overview-note">
        <summary>How these counts are defined</summary>
        <p className="type-small">
          Same and different compare the published values for each measure. Not
          comparable means one county has no usable value, or the unit, period,
          release, or method does not match. A count of zero different values
          does not mean the counties are equivalent. A missing value stays
          missing and is not zero. No difference is calculated for county
          records.
        </p>
      </details>
    </div>
  );
}

/** Section 3: the evidence, grouped by the question being asked. */
export function CompareEvidenceSections({
  counties,
  extra,
  rows,
}: {
  counties: CountyPair;
  extra?: ReactNode;
  rows: readonly CompareVisualRow[];
}) {
  return (
    <>
      {compareVisualSectionIds.map((section) => {
        const sectionRows = compareRowsForSection(rows, section);
        if (sectionRows.length === 0) {
          return null;
        }
        const caption = compareSectionCaption(sectionRows);
        const copy = compareVisualSectionTitles[section];
        return (
          <section
            aria-labelledby={`compare-section-${section}-title`}
            className="ux-reset-compare-vsection"
            data-testid={`compare-group-${section}`}
            key={section}
          >
            <h3
              className="ux-reset-compare-section-title"
              id={`compare-section-${section}-title`}
            >
              {copy.title}
            </h3>
            <p className="type-small">{copy.question}</p>
            {caption ? (
              <p
                className="ux-reset-compare-caption type-small"
                data-testid={`compare-caption-${section}`}
              >
                {caption}
              </p>
            ) : null}
            <div className="ux-reset-compare-vrows">
              {sectionRows.map((row) => (
                <CompareVisualRowView
                  counties={counties}
                  key={row.id}
                  row={row}
                />
              ))}
            </div>
          </section>
        );
      })}
      {extra}
    </>
  );
}

function gapWho(sides: CompareGapSides, counties: CountyPair): string {
  switch (sides) {
    case "both": {
      return "both counties";
    }
    case "left": {
      return counties[0].label;
    }
    case "right": {
      return counties[1].label;
    }
    default: {
      const exhaustive: never = sides;
      return exhaustive;
    }
  }
}

function GapList({
  counties,
  items,
  phrase,
  state,
}: {
  counties: CountyPair;
  items: readonly CompareGapItem[];
  phrase: (county: string, reason: string) => string;
  state: "limited" | "unavailable";
}) {
  return (
    <ul>
      {items.map((item) => (
        <li
          data-gap-sides={item.sides}
          data-state={state}
          key={`${item.label}-${item.sides}-${item.reason}`}
        >
          <strong>{item.label}</strong>
          <span className="type-small">
            {phrase(gapWho(item.sides, counties), item.reason)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Section 4: governed absence, request failures, and published cautions. */
export function CompareUnknownPanel({
  countyLimitations,
  counties,
  period,
  rows,
  sharedLimitation,
}: {
  /** Per-county release limitations, only when the two texts differ. */
  countyLimitations: readonly [string, string] | null;
  counties: CountyPair;
  period: string | null;
  rows: readonly CompareVisualRow[];
  sharedLimitation: string | null;
}) {
  const titleId = useId();
  const summary = compareGapSummary(rows);
  return (
    <section
      aria-labelledby={titleId}
      className="ux-reset-compare-unknown"
      data-testid="compare-unknown"
    >
      <h3 className="ux-reset-compare-section-title" id={titleId}>
        What we don’t know
      </h3>
      <p className="type-small" data-testid="compare-unknown-introduction">
        {compareUnknownIntroduction(rows)}
      </p>
      <div
        className="ux-reset-compare-unknown-block"
        data-testid="compare-not-published"
      >
        <h4 className="ux-reset-compare-unknown-heading">Not published</h4>
        {summary.absence.length === 0 ? (
          <p className="type-small">{compareAbsenceEmptyCopy(summary)}</p>
        ) : (
          <GapList
            counties={counties}
            items={summary.absence}
            phrase={compareAbsencePhrase}
            state="unavailable"
          />
        )}
      </div>
      {summary.couldNotLoad.length > 0 ? (
        <div
          className="ux-reset-compare-unknown-block"
          data-testid="compare-could-not-load"
        >
          <h4 className="ux-reset-compare-unknown-heading">Could not load</h4>
          <GapList
            counties={counties}
            items={summary.couldNotLoad}
            phrase={compareCouldNotLoadPhrase}
            state="unavailable"
          />
        </div>
      ) : null}
      {summary.notUsable.length > 0 ? (
        <div
          className="ux-reset-compare-unknown-block"
          data-testid="compare-not-usable"
        >
          <h4 className="ux-reset-compare-unknown-heading">
            Not usable for this release
          </h4>
          <GapList
            counties={counties}
            items={summary.notUsable}
            phrase={compareNotUsablePhrase}
            state="unavailable"
          />
        </div>
      ) : null}
      <div
        className="ux-reset-compare-unknown-block"
        data-testid="compare-cautions"
      >
        <h4 className="ux-reset-compare-unknown-heading">
          Published, but read with care
        </h4>
        {summary.cautions.length === 0 ? (
          <p className="type-small">
            None of the published values above carries a stated caution.
          </p>
        ) : (
          <ul>
            {summary.cautions.map((group) => (
              <li data-state="limited" key={group.reason}>
                <strong>{group.reason}</strong>
                <span className="type-small">
                  {`Applies to: ${group.items
                    .map((item) =>
                      item.sides === "both"
                        ? item.label
                        : `${item.label} (${gapWho(item.sides, counties)} only)`
                    )
                    .join("; ")}.`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {countyLimitations ? (
        <div className="ux-reset-compare-unknown-grid">
          {counties.map((county, index) => (
            <div key={county.letter}>
              <p className="ux-reset-compare-unknown-county">
                <CompareSlotMarker letter={county.letter} />
                <span>{county.label}</span>
              </p>
              <p
                className="type-small"
                data-testid={`compare-limitation-${county.fips}`}
              >
                {countyLimitations[index]}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {sharedLimitation ? (
        <div data-testid="compare-shared-limitation">
          <p className="ux-reset-compare-unknown-county">
            <span>Shared release limitations</span>
          </p>
          <p className="type-small">{sharedLimitation}</p>
        </div>
      ) : null}
      <div>
        <p className="ux-reset-compare-unknown-county">
          <span>How dates and releases work</span>
        </p>
        <p className="type-small" data-testid="compare-profile-comparability">
          {compareProfilePeriodQualification(period)}
        </p>
      </div>
    </section>
  );
}
export type CompareSourceEntry = {
  id: string;
  label: string;
  left: readonly EvidenceObjectModel[];
  right: readonly EvidenceObjectModel[];
};

function SourceCell({
  evidence,
}: {
  evidence: readonly EvidenceObjectModel[];
}) {
  if (evidence.length === 0) {
    return <span className="type-small">No published value</span>;
  }
  return (
    <ul className="ux-reset-compare-source-cell">
      {evidence.map((entry, index) => {
        const facts = compareProvenanceFacts(entry);
        if (compareProvenanceUnknown(facts)) {
          return (
            <li key={`${entry.claimLabel}-${index}`}>
              <span className="ux-reset-compare-info-unknown">
                Source details unavailable
              </span>
              {facts.caveat ? <span> {facts.caveat}</span> : null}
            </li>
          );
        }
        return (
          <li key={`${entry.claimLabel}-${index}`}>
            {[facts.source, facts.period, facts.vintage]
              .filter(Boolean)
              .join(" · ")}
            {facts.caveat ? <span> {facts.caveat}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Section 5: one table with the provenance for every measure. */
export function CompareSourcesTable({
  counties,
  entries,
}: {
  counties: CountyPair;
  entries: readonly CompareSourceEntry[];
}) {
  return (
    <details className="ux-reset-compare-sources" data-testid="compare-sources">
      <summary>Sources and methods</summary>
      <div className="ux-reset-compare-sources-scroll">
        <table>
          <caption className="sr-only">
            Source, observation period, dataset vintage, and caveat for every
            measure shown
          </caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">{counties[0].label} (A)</th>
              <th scope="col">{counties[1].label} (B)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr data-testid={`compare-source-row-${entry.id}`} key={entry.id}>
                <th scope="row">{entry.label}</th>
                <td>
                  <SourceCell evidence={entry.left} />
                </td>
                <td>
                  <SourceCell evidence={entry.right} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Copy link, print or save as PDF, and the hand-off to Ask Atlas. */
export function CompareShareBar({ askHref }: { askHref: string | null }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      setCopied(false);
    }
  };
  const handleCopyClick = () => {
    void handleCopy();
  };
  const handlePrint = () => {
    window.print();
  };
  return (
    <div
      aria-label="Share and hand off this comparison"
      className="ux-reset-compare-share"
      data-testid="compare-share"
      role="group"
    >
      <Button
        data-testid="compare-copy-link"
        size="sm"
        type="button"
        variant="outline"
        onClick={handleCopyClick}
      >
        {copied ? (
          <Check aria-hidden="true" data-icon="inline-start" />
        ) : (
          <Copy aria-hidden="true" data-icon="inline-start" />
        )}
        {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button
        data-testid="compare-print"
        size="sm"
        type="button"
        variant="outline"
        onClick={handlePrint}
      >
        <Printer aria-hidden="true" data-icon="inline-start" />
        Print or save as PDF
      </Button>
      {askHref ? (
        <Link
          className={cn(
            buttonVariants({ size: "sm", variant: "secondary" }),
            "ux-reset-compare-action"
          )}
          data-testid="compare-ask-atlas"
          data-variant="secondary"
          href={askHref}
        >
          <MessageSquare aria-hidden="true" data-icon="inline-start" />
          Ask Atlas about this comparison
        </Link>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to the clipboard" : ""}
      </span>
    </div>
  );
}

function observationRelationLabel(relation: CompareRelation): string {
  switch (relation.kind) {
    case "similar": {
      return "Same value";
    }
    case "different": {
      return "Values differ";
    }
    case "withheld": {
      return relation.explanation;
    }
    default: {
      const exhaustive: never = relation;
      return exhaustive;
    }
  }
}

function observationRelationReasons(relation: CompareRelation): string {
  if (relation.kind !== "withheld") {
    return "";
  }
  return relation.reasons.join(",");
}

function ObservationCell({
  cell,
  county,
  fips,
  measureId,
}: {
  cell: CompareCell;
  county: string;
  fips: string;
  measureId: string;
}) {
  if (cell.kind === "empty") {
    return (
      <div
        data-fips={fips}
        data-measure-id={measureId}
        data-observation={cell.reason}
        data-testid={`compare-cell-${measureId}-${fips}`}
      >
        <p>{compareReaderState(cell.reason, cell.message)}</p>
      </div>
    );
  }
  return (
    <div
      data-fips={fips}
      data-measure-id={measureId}
      data-observation="present"
      data-testid={`compare-cell-${measureId}-${fips}`}
    >
      {cell.records.map((record) => (
        <CompareMeasureValue
          county={county}
          evidence={record.evidence}
          key={record.observation.observation_id}
          label={record.evidence.claimLabel}
        />
      ))}
    </div>
  );
}

/**
 * Catalog observations that are not the same period or value as a county
 * record row. Provenance stays on the value and in the sources table.
 */
export function CompareAdditionalObservations({
  counties,
  rows,
}: {
  counties: CountyPair;
  rows: readonly ReconciledAlignmentRow[];
}) {
  const titleId = useId();
  if (rows.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby={titleId}
      className="ux-reset-compare-vsection"
      data-testid="compare-group-additional"
    >
      <h3 className="ux-reset-compare-section-title" id={titleId}>
        More measures
      </h3>
      <p className="type-small">
        Catalog observations whose period or value is not the same as a
        county-record row. A comparison is withheld when the governed fields do
        not support one.
      </p>
      <div className="ux-reset-compare-vrows">
        {rows.map((entry) => (
          <article
            className="ux-reset-compare-vrow"
            data-measure-id={entry.row.measureId}
            data-relation={entry.row.relation.kind}
            data-testid={`compare-row-${entry.row.measureId}`}
            key={entry.row.measureId}
          >
            <header>
              <h4>{entry.row.measureLabel}</h4>
              <span className="ux-reset-compare-relation">
                {entry.row.relation.kind === "withheld"
                  ? "Not comparable"
                  : observationRelationLabel(entry.row.relation)}
              </span>
            </header>
            {entry.note ? <p className="type-small">{entry.note}</p> : null}
            <p
              className={
                entry.row.relation.kind === "withheld"
                  ? "type-small"
                  : "sr-only"
              }
              data-reasons={observationRelationReasons(entry.row.relation)}
              data-relation={entry.row.relation.kind}
              data-testid={`compare-relation-${entry.row.measureId}`}
            >
              {observationRelationLabel(entry.row.relation)}
            </p>
            <div className="ux-reset-compare-vbars">
              {([entry.row.left, entry.row.right] as const).map(
                (cell, index) => {
                  const county = counties[index];
                  if (!county) {
                    return null;
                  }
                  return (
                    <div className="ux-reset-compare-vside" key={county.letter}>
                      <CompareSlotMarker letter={county.letter} />
                      <span className="sr-only">{county.label}: </span>
                      <ObservationCell
                        cell={cell}
                        county={county.label}
                        fips={county.fips}
                        measureId={entry.row.measureId}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
