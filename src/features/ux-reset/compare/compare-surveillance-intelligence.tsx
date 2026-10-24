"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CompareSlotMarker } from "@/features/ux-reset/compare/compare-county-picker";
import {
  COMPARE_MODEL_ROW_LABELS,
  membershipPercentText,
  situationDisplay,
} from "@/features/ux-reset/compare/compare-situation-display";
import {
  PERCENTILE_QUALIFIER,
  SUFFICIENCY_QUALIFIER,
  SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER,
  type SurveillanceIntelligencePerspectiveId,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import { SurveillanceIntelligenceDetails } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-details";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";
import { useCountySurveillanceIntelligence } from "@/features/ux-reset/surveillance-intelligence/use-county-surveillance-intelligence";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { cn } from "@/lib/utils";

type OpenPerspective = {
  id: SurveillanceIntelligencePerspectiveId | null;
  pairKey: string;
};

type CountyColumn = {
  fips: string;
  label: string;
  letter: "A" | "B";
  side: "a" | "b";
  title: "County A" | "County B";
};

const MODEL_INTRO =
  "These summaries describe reporting patterns and review priority, not personal disease risk.";

const INTERPRETATION = [
  "Gap review score: the published score used by the map and county ranking. It describes a defined discrepancy in the published method. It is not personal disease risk.",
  "ML review priority: a review tier for unusual reporting patterns. The percentile compares this county with others in the same model batch. It is not a disease probability. A tier can still be shown when the data are insufficient. The tier does not make that data sufficient.",
  "Combined surveillance pattern: this model groups counties using human Lyme disease reporting, tick records, and pathogen records.",
  "Tick and pathogen pattern: this model groups counties using tick and pathogen records, without using human Lyme disease reporting.",
  "No record does not mean the tick or pathogen is absent. These results answer different questions and may differ. Disagreement is not an error.",
] as const;

/**
 * Compare layout only. Four perspective cards share one details region.
 * Each county keeps the Explorer data hook and its own unavailable state.
 * The perspectives answer different questions and are never merged or ranked.
 */
export function CompareSurveillanceIntelligence({
  leftFips,
  leftLabel,
  release,
  rightFips,
  rightLabel,
}: {
  leftFips: string;
  leftLabel: string;
  release: Tier1ActiveRelease;
  rightFips: string;
  rightLabel: string;
}) {
  const left = useCountySurveillanceIntelligence({ fips: leftFips, release });
  const right = useCountySurveillanceIntelligence({ fips: rightFips, release });
  const pairKey = `${leftFips}|${rightFips}`;
  const [openState, setOpenState] = useState<OpenPerspective>({
    id: null,
    pairKey,
  });
  if (openState.pairKey !== pairKey) {
    setOpenState({ id: null, pairKey });
  }
  const openId = openState.pairKey === pairKey ? openState.id : null;
  const detailsId = useId();
  const titleId = useId();
  const columns: readonly CountyColumn[] = [
    {
      fips: leftFips,
      label: leftLabel,
      letter: "A",
      side: "a",
      title: "County A",
    },
    {
      fips: rightFips,
      label: rightLabel,
      letter: "B",
      side: "b",
      title: "County B",
    },
  ];
  const perspectives = {
    a: left.perspectives,
    b: right.perspectives,
  };
  const retry = {
    a: left.retry,
    b: right.retry,
  };
  const toggle = (id: SurveillanceIntelligencePerspectiveId) => {
    setOpenState((current) => ({
      id: current.id === id ? null : id,
      pairKey,
    }));
  };
  const loading = [...left.perspectives, ...right.perspectives].some(
    (perspective) => perspective.kind === "loading"
  );
  return (
    <section
      aria-busy={loading}
      aria-labelledby={titleId}
      className="ux-reset-compare-perspectives"
      data-testid="compare-surveillance-intelligence"
    >
      <h3 className="ux-reset-compare-section-title" id={titleId}>
        Model results
      </h3>
      <p className="sr-only" aria-live="polite">
        {`${left.announcement} ${right.announcement}`}
      </p>
      <p className="type-small" data-testid="compare-intelligence-guide">
        {MODEL_INTRO}
      </p>
      <ul
        className="ux-reset-compare-tiles"
        data-testid="compare-surveillance-intelligence-table"
      >
        {SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER.map((id) => {
          const expanded = openId === id;
          const label = COMPARE_MODEL_ROW_LABELS[id];
          return (
            <li
              className="ux-reset-compare-tile"
              data-expanded={expanded ? "true" : "false"}
              data-perspective={id}
              data-testid={`compare-surveillance-row-${id}`}
              key={id}
            >
              <h4 className="ux-reset-compare-tile-title">
                <TileControl
                  controlsId={detailsId}
                  expanded={expanded}
                  label={label}
                  onToggle={() => {
                    toggle(id);
                  }}
                />
              </h4>
              <p className="sr-only">{COMPARE_MODEL_ROW_LABELS[id]}</p>
              <div className="ux-reset-compare-tile-sides">
                {columns.map((column) => {
                  const perspective = perspectives[column.side].find(
                    (entry) => entry.id === id
                  );
                  return (
                    <div
                      className="ux-reset-compare-tile-side"
                      data-county={`${column.title}, ${column.label}`}
                      data-fips={column.fips}
                      data-kind={perspective?.kind}
                      data-side={column.side}
                      data-testid={`compare-surveillance-cell-${id}-${column.fips}`}
                      key={column.side}
                    >
                      <CompareSlotMarker letter={column.letter} />
                      <span className="sr-only">{`${column.title}, ${column.label}: `}</span>
                      {perspective ? (
                        <SurveillanceValue
                          county={column}
                          onRetry={() => {
                            retry[column.side](id);
                          }}
                          perspective={perspective}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {openId ? (
        <div
          className="ux-reset-compare-values"
          data-testid="compare-surveillance-intelligence-details"
          id={detailsId}
        >
          {columns.map((column) => {
            const perspective = perspectives[column.side].find(
              (entry) => entry.id === openId
            );
            if (!perspective) {
              return null;
            }
            const headingId = `${detailsId}-${column.side}`;
            return (
              <SurveillanceIntelligenceDetails
                fips={column.fips}
                heading={`${column.title} · ${COMPARE_MODEL_ROW_LABELS[perspective.id]} details`}
                headingId={headingId}
                id={`${detailsId}-${column.side}-panel`}
                key={column.side}
                labelledBy={headingId}
                onRetry={() => {
                  retry[column.side](perspective.id);
                }}
                perspective={perspective}
                retryLabel={`Retry ${COMPARE_MODEL_ROW_LABELS[perspective.id]} for ${column.title}, ${column.label}`}
              />
            );
          })}
        </div>
      ) : null}
      <details
        className="compare-disclosure"
        data-testid="compare-model-interpretation"
      >
        <summary>How to interpret these model results</summary>
        <ul>
          {INTERPRETATION.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>{PERCENTILE_QUALIFIER}</p>
        <p>{SUFFICIENCY_QUALIFIER}</p>
      </details>
    </section>
  );
}

function TileControl({
  controlsId,
  expanded,
  label,
  onToggle,
}: {
  controlsId: string;
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Button
      aria-controls={expanded ? controlsId : undefined}
      aria-expanded={expanded}
      className={cn(
        "ux-reset-compare-tile-button h-auto min-h-9 w-full justify-between px-2 py-1.5 text-left whitespace-normal motion-reduce:transition-none",
        expanded && "ring-ring ring-2"
      )}
      type="button"
      variant={expanded ? "secondary" : "ghost"}
      onClick={onToggle}
    >
      <span>{label}</span>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 transition-transform motion-reduce:transition-none",
          expanded && "rotate-180"
        )}
      />
    </Button>
  );
}

function SurveillanceValue({
  county,
  onRetry,
  perspective,
}: {
  county: CountyColumn;
  onRetry: () => void;
  perspective: IntelligencePerspectiveView;
}) {
  const grouped =
    perspective.id === "surveillance-situation" ||
    perspective.id === "ecological-situation"
      ? situationDisplay(perspective)
      : null;
  const headline = grouped?.label ?? perspective.primary;
  const showSupporting = !(
    perspective.kind === "ready" &&
    (perspective.id === "surveillance-situation" ||
      perspective.id === "ecological-situation")
  );
  return (
    <div className="ux-reset-compare-tile-value">
      <p className="m-0 font-semibold break-words">{headline}</p>
      {perspective.reviewCategory ? (
        <p className="type-small m-0">{perspective.reviewCategory}</p>
      ) : null}
      {showSupporting ? (
        <p className="type-small m-0 break-words">{perspective.supporting}</p>
      ) : null}
      {grouped?.explanation ? (
        <p className="sr-only">{grouped.explanation}</p>
      ) : null}
      {perspective.fullValue ? (
        <span className="sr-only">{`Full value ${perspective.fullValue}`}</span>
      ) : null}
      {perspective.memberships.length > 0 ? (
        <details>
          <summary>Model grouping details</summary>
          <p>
            These percentages describe how the model assigns this county among
            its groups. They do not measure disease risk, pathogen presence,
            data completeness, or the probability that the model is correct.
          </p>
          <ul>
            {perspective.memberships.map((entry) => (
              <li key={entry.classId}>
                {`${entry.classId}: ${membershipPercentText(entry.percent)}`}
                {entry.selected ? " — Assigned group" : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {perspective.retryable ? (
        <Button
          className="mt-2 min-h-9 whitespace-normal"
          data-testid={`compare-surveillance-retry-${perspective.id}-${county.fips}`}
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          {`Retry ${COMPARE_MODEL_ROW_LABELS[perspective.id]} for ${county.title}, ${county.label}`}
        </Button>
      ) : null}
    </div>
  );
}
