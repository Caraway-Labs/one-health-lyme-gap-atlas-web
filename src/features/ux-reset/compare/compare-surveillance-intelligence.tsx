"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CompareSlotMarker } from "@/features/ux-reset/compare/compare-county-picker";
import {
  SURVEILLANCE_INTELLIGENCE_GUIDE,
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

const PERSPECTIVE_QUESTIONS = {
  "ecological-situation": "What do tick and pathogen findings suggest alone?",
  "gap-score": "Do human reports match the ecological evidence?",
  "ml-review-priority": "Does this evidence profile look unusual?",
  "surveillance-situation":
    "What pattern do human, tick and pathogen reports form?",
} as const satisfies Record<SurveillanceIntelligencePerspectiveId, string>;

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
        County Surveillance Intelligence
      </h3>
      <p className="sr-only" aria-live="polite">
        {`${left.announcement} ${right.announcement}`}
      </p>
      <p className="type-small" data-testid="compare-intelligence-guide">
        {SURVEILLANCE_INTELLIGENCE_GUIDE}
      </p>
      <ul
        className="ux-reset-compare-tiles"
        data-testid="compare-surveillance-intelligence-table"
      >
        {SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER.map((id) => {
          const expanded = openId === id;
          const label =
            perspectives.a.find((entry) => entry.id === id)?.label ?? id;
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
              <p className="type-small ux-reset-compare-tile-question">
                {PERSPECTIVE_QUESTIONS[id]}
              </p>
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
                heading={`${column.title} · ${perspective.label} details`}
                headingId={headingId}
                id={`${detailsId}-${column.side}-panel`}
                key={column.side}
                labelledBy={headingId}
                onRetry={() => {
                  retry[column.side](perspective.id);
                }}
                perspective={perspective}
                retryLabel={`Retry ${perspective.label} for ${column.title}, ${column.label}`}
              />
            );
          })}
        </div>
      ) : null}
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

const CLASS_MEMBERSHIP_PREFIX = "Class membership ";
const FIT_DECIMALS = 2;
const FIT_PERCENT_SCALE = 100;
const FIT_NOTE = "A model score, not disease risk.";
const FIT_NUMBER = /^(?<value>\d+(?:\.\d+)?)(?:\s+on a 0–1 scale)?$/;

/**
 * "Class membership" is model jargon. Say what it means: how strongly this
 * county's evidence fits the pattern named above it.
 */
function plainSupportingText(supporting: string): string {
  if (!supporting.startsWith(CLASS_MEMBERSHIP_PREFIX)) {
    return supporting;
  }
  const rest = supporting.slice(CLASS_MEMBERSHIP_PREFIX.length).trim();
  const percentText = rest.endsWith("%") ? rest : null;
  if (percentText) {
    return `Strength of fit to this pattern: ${percentText}. ${FIT_NOTE}`;
  }
  const value = Number(FIT_NUMBER.exec(rest)?.groups?.value);
  if (!Number.isFinite(value)) {
    return supporting;
  }
  const percent = (value * FIT_PERCENT_SCALE).toFixed(FIT_DECIMALS);
  const display =
    value < 1 && Number(percent) >= FIT_PERCENT_SCALE
      ? `over ${(FIT_PERCENT_SCALE - 10 ** -FIT_DECIMALS).toFixed(FIT_DECIMALS)}%`
      : `${percent}%`;
  return `Strength of fit to this pattern: ${display}. ${FIT_NOTE}`;
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
  const track = perspective.track;
  return (
    <div className="ux-reset-compare-tile-value">
      <p className="m-0 font-semibold break-words">{perspective.primary}</p>
      {track && track.value !== null ? (
        <>
          <span
            aria-hidden="true"
            className="ux-reset-compare-track"
            data-letter={county.letter}
          >
            <span
              className="ux-reset-compare-fill"
              style={{ width: `${Math.min(Math.max(track.value, 0), 100)}%` }}
            />
          </span>
          <span className="sr-only">{`${track.label}: ${track.valueText}`}</span>
        </>
      ) : null}
      <p className="type-small m-0 break-words">
        {plainSupportingText(perspective.supporting)}
      </p>
      {perspective.fullValue ? (
        <span className="sr-only">{`Full value ${perspective.fullValue}`}</span>
      ) : null}
      {perspective.retryable ? (
        <Button
          className="mt-2 min-h-9 whitespace-normal"
          data-testid={`compare-surveillance-retry-${perspective.id}-${county.fips}`}
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          {`Retry ${perspective.label} for ${county.title}, ${county.label}`}
        </Button>
      ) : null}
    </div>
  );
}
