"use client";

import {
  CircleCheck,
  CircleHelp,
  CircleSlash,
  Info,
  SquareDashed,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CompareSlotMarker,
  type CompareSlotLetter,
} from "@/features/ux-reset/compare/compare-county-picker";
import {
  compareBarFraction,
  compareBarScale,
  compareProvenanceFacts,
  compareProvenanceUnknown,
  type CompareMissingReason,
  type CompareSideValue,
  type CompareVisualRow,
} from "@/features/ux-reset/compare/compare-visual-model";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import { cn } from "@/lib/utils";

export type CompareCountyIdentity = {
  fips: string;
  label: string;
  letter: CompareSlotLetter;
};

function missingLabel(reason: CompareMissingReason): string {
  switch (reason) {
    case "failed": {
      return "Couldn’t load";
    }
    case "missing": {
      return "No record";
    }
    case "release_mismatch": {
      return "Different release";
    }
    case "suppressed": {
      return "Suppressed";
    }
    case "unavailable": {
      return "Unavailable";
    }
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

/**
 * Missing is drawn as a dashed, empty mark with words. It is never an empty
 * bar that could be read as zero.
 */
export function CompareMissingMark({
  side,
}: {
  side: Extract<CompareSideValue, { kind: "missing" }>;
}) {
  return (
    <span className="ux-reset-compare-missing" data-observation={side.reason}>
      <SquareDashed aria-hidden="true" className="size-3.5 shrink-0" />
      <span aria-hidden="true">{missingLabel(side.reason)}</span>
      <span className="sr-only">{side.text}</span>
    </span>
  );
}

function ProvenanceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="ux-reset-compare-info-line">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * One tap for the sources and limitations behind a single value.
 * The full set for every measure is also in the Sources and methods table.
 */
export function CompareInfoButton({
  county,
  evidence,
  label,
}: {
  county: string;
  evidence: EvidenceObjectModel;
  label: string;
}) {
  const facts = compareProvenanceFacts(evidence);
  const unknown = compareProvenanceUnknown(facts);
  const limitations = evidence.provenance.limitations.filter(
    (entry) => entry.trim().length > 0
  );
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Sources and limitations for ${label}, ${county}`}
            className="ux-reset-compare-info-button"
            size="icon-xs"
            type="button"
            variant="ghost"
          />
        }
      >
        <Info aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="ux-reset-compare-info"
        initialFocus
        side="top"
      >
        <p className="ux-reset-compare-info-title">
          {label} · {county}
        </p>
        <p className="type-small">
          {evidenceAvailabilityLabel(evidence.availability)}.{" "}
          {evidence.displayValue}
        </p>
        {unknown ? (
          <p
            className="ux-reset-compare-info-unknown"
            data-testid="compare-source-unavailable"
          >
            Source details unavailable
          </p>
        ) : (
          <dl>
            {facts.source ? (
              <ProvenanceLine label="Source" value={facts.source} />
            ) : null}
            {facts.period ? (
              <ProvenanceLine label="Observation period" value={facts.period} />
            ) : null}
            {facts.vintage ? (
              <ProvenanceLine label="Dataset vintage" value={facts.vintage} />
            ) : null}
          </dl>
        )}
        {evidence.valueNote?.trim() ? (
          <p className="type-small">{evidence.valueNote.trim()}</p>
        ) : null}
        {limitations.length > 0 ? (
          <ul className="ux-reset-compare-info-limits">
            {limitations.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function barLabel(row: CompareVisualRow, side: CompareSideValue): string {
  if (side.kind !== "value") {
    return "";
  }
  if (side.number === null) {
    return side.text;
  }
  const formatted = side.number.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
  const prefix = row.atLeast ? "≥ " : "";
  const suffix =
    row.unit && row.unit !== "%" && row.unit !== "percentile"
      ? ` ${row.unit}`
      : "";
  const percent = row.unit === "%" ? "%" : "";
  return `${prefix}${formatted}${percent}${suffix}`;
}

function SideFrame({
  children,
  county,
  fips,
  rowId,
  side,
}: {
  children: ReactNode;
  county: CompareCountyIdentity;
  fips: string;
  rowId: string;
  side: CompareSideValue;
}) {
  const evidenceType =
    side.kind === "value" ? side.evidence.provenance.evidenceType.trim() : "";
  const caveat =
    side.kind === "value"
      ? (side.evidence.provenance.materialCaveat?.trim() ?? "")
      : "";
  return (
    <div
      className="ux-reset-compare-vside"
      data-evidence-availability={
        side.kind === "value" ? side.evidence.availability : "unavailable"
      }
      data-fips={fips}
      data-observation={side.kind === "missing" ? side.reason : "present"}
      data-testid={`compare-profile-cell-${rowId}-${fips}`}
    >
      <CompareSlotMarker letter={county.letter} />
      <span className="sr-only">{county.label}: </span>
      {children}
      {side.kind === "value" && side.limited ? (
        <span className="ux-reset-compare-limited">Limited</span>
      ) : null}
      {caveat ? <span className="sr-only">{caveat}</span> : null}
      {evidenceType && evidenceType !== "Unavailable" ? (
        <span className="sr-only">Evidence type {evidenceType}</span>
      ) : null}
    </div>
  );
}

function SideInfo({
  county,
  row,
  side,
}: {
  county: CompareCountyIdentity;
  row: CompareVisualRow;
  side: CompareSideValue;
}) {
  return side.kind === "value" ? (
    <CompareInfoButton
      county={county.label}
      evidence={side.evidence}
      label={row.label}
    />
  ) : null;
}

function BarsVisual({
  counties,
  row,
}: {
  counties: readonly [CompareCountyIdentity, CompareCountyIdentity];
  row: CompareVisualRow;
}) {
  const scale = compareBarScale(row);
  const sides = [row.left, row.right] as const;
  return (
    <div className="ux-reset-compare-vbars">
      {sides.map((side, index) => {
        const county = counties[index];
        const fraction = compareBarFraction(side, scale);
        return (
          <SideFrame
            county={county}
            fips={county.fips}
            key={county.letter}
            rowId={row.id}
            side={side}
          >
            {side.kind === "missing" ? (
              <CompareMissingMark side={side} />
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="ux-reset-compare-track"
                  data-letter={county.letter}
                >
                  {fraction === null ? null : (
                    <span
                      className="ux-reset-compare-fill"
                      style={{
                        width: `${Math.max(fraction * 100, fraction > 0 ? 2 : 0)}%`,
                      }}
                    />
                  )}
                </span>
                <span aria-hidden="true" className="ux-reset-compare-vlabel">
                  {barLabel(row, side)}
                  {side.isZero && side.evidence.reasonCode === "ZERO" ? (
                    <span className="ux-reset-compare-zero">
                      {" "}
                      published zero
                    </span>
                  ) : null}
                </span>
                <span className="sr-only">{side.text}</span>
              </>
            )}
            <SideInfo county={county} row={row} side={side} />
          </SideFrame>
        );
      })}
    </div>
  );
}

function DotsVisual({
  counties,
  row,
}: {
  counties: readonly [CompareCountyIdentity, CompareCountyIdentity];
  row: CompareVisualRow;
}) {
  const scale = row.scale ?? 100;
  const sides = [row.left, row.right] as const;
  const lanes = [8, 20] as const;
  return (
    <div className="ux-reset-compare-vdots">
      <svg
        aria-hidden="true"
        className="ux-reset-compare-dotplot"
        focusable="false"
        viewBox="0 0 200 28"
      >
        {[0, 50, 100].map((tick) => (
          <line
            className="ux-reset-compare-dot-tick"
            key={tick}
            x1={6 + (tick / 100) * 188}
            x2={6 + (tick / 100) * 188}
            y1="2"
            y2="26"
          />
        ))}
        {lanes.map((lane) => (
          <line
            className="ux-reset-compare-dot-lane"
            key={lane}
            x1="6"
            x2="194"
            y1={lane}
            y2={lane}
          />
        ))}
        {sides.map((side, index) => {
          const fraction = compareBarFraction(side, scale);
          if (fraction === null) {
            return null;
          }
          const cx = 6 + fraction * 188;
          return index === 0 ? (
            <circle
              className="ux-reset-compare-dot-a"
              cx={cx}
              cy={lanes[0]}
              key="a"
              r="4.5"
            />
          ) : (
            <circle
              className="ux-reset-compare-dot-b"
              cx={cx}
              cy={lanes[1]}
              key="b"
              r="4"
            />
          );
        })}
      </svg>
      <p aria-hidden="true" className="ux-reset-compare-dot-scale">
        <span>0</span>
        <span>{scale}</span>
      </p>
      <div className="ux-reset-compare-vbars">
        {sides.map((side, index) => {
          const county = counties[index];
          return (
            <SideFrame
              county={county}
              fips={county.fips}
              key={county.letter}
              rowId={row.id}
              side={side}
            >
              {side.kind === "missing" ? (
                <CompareMissingMark side={side} />
              ) : (
                <>
                  <span aria-hidden="true" className="ux-reset-compare-vlabel">
                    {barLabel(row, side)}
                  </span>
                  <span className="sr-only">{side.text}</span>
                </>
              )}
              <SideInfo county={county} row={row} side={side} />
            </SideFrame>
          );
        })}
      </div>
    </div>
  );
}

type StatusTone = "absent" | "present" | "unknown";

function statusTone(text: string): StatusTone {
  const value = text.trim().toLowerCase();
  if (
    /(?:not detected|not found|absent|no evidence|not established)/.test(value)
  ) {
    return "absent";
  }
  if (/(?:present|detected|established|reported|found|confirmed)/.test(value)) {
    return "present";
  }
  return "unknown";
}

function StatusIcon({ tone }: { tone: StatusTone }) {
  switch (tone) {
    case "present": {
      return <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />;
    }
    case "absent": {
      return <CircleSlash aria-hidden="true" className="size-3.5 shrink-0" />;
    }
    case "unknown": {
      return <CircleHelp aria-hidden="true" className="size-3.5 shrink-0" />;
    }
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
}

function ChipsVisual({
  counties,
  row,
}: {
  counties: readonly [CompareCountyIdentity, CompareCountyIdentity];
  row: CompareVisualRow;
}) {
  const sides = [row.left, row.right] as const;
  return (
    <div className="ux-reset-compare-vbars">
      {sides.map((side, index) => {
        const county = counties[index];
        return (
          <SideFrame
            county={county}
            fips={county.fips}
            key={county.letter}
            rowId={row.id}
            side={side}
          >
            {side.kind === "missing" ? (
              <CompareMissingMark side={side} />
            ) : (
              <span
                className="ux-reset-compare-status-chip"
                data-tone={statusTone(side.text)}
              >
                <StatusIcon tone={statusTone(side.text)} />
                <span>{side.text}</span>
              </span>
            )}
            <SideInfo county={county} row={row} side={side} />
          </SideFrame>
        );
      })}
    </div>
  );
}

function relationLabel(relation: CompareVisualRow["relation"]): string {
  switch (relation) {
    case "same": {
      return "Same value";
    }
    case "different": {
      return "Values differ";
    }
    case "incomparable": {
      return "Not comparable";
    }
    default: {
      const exhaustive: never = relation;
      return exhaustive;
    }
  }
}

/** One measure, drawn with the visual that fits its data type. */
export function CompareVisualRowView({
  counties,
  row,
}: {
  counties: readonly [CompareCountyIdentity, CompareCountyIdentity];
  row: CompareVisualRow;
}) {
  let visual: ReactNode;
  switch (row.visual) {
    case "bars": {
      visual = <BarsVisual counties={counties} row={row} />;
      break;
    }
    case "dots": {
      visual = <DotsVisual counties={counties} row={row} />;
      break;
    }
    case "chips": {
      visual = <ChipsVisual counties={counties} row={row} />;
      break;
    }
    default: {
      const exhaustive: never = row.visual;
      visual = exhaustive;
    }
  }
  return (
    <article
      className="ux-reset-compare-vrow"
      data-gap={row.gap ? "true" : "false"}
      data-relation={row.relation}
      data-row-id={row.id}
      data-testid={`compare-profile-row-${row.id}`}
    >
      <header>
        <h4>{row.label}</h4>
        <span className="ux-reset-compare-relation">
          {relationLabel(row.relation)}
        </span>
      </header>
      {row.note ? <p className="type-small">{row.note}</p> : null}
      {visual}
    </article>
  );
}

/** Ring gauge for a 0 to 100 published score. A missing score draws no ring. */
export function CompareScoreRing({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const fraction = value === null ? 0 : Math.min(Math.max(value / 100, 0), 1);
  return (
    <span
      aria-label={
        value === null ? `${label}: unavailable` : `${label}: ${value} of 100`
      }
      className={cn("ux-reset-compare-ring")}
      data-missing={value === null ? "true" : "false"}
      role="img"
    >
      <svg aria-hidden="true" focusable="false" viewBox="0 0 64 64">
        <circle
          className="ux-reset-compare-ring-track"
          cx="32"
          cy="32"
          r={radius}
        />
        {value === null ? null : (
          <circle
            className="ux-reset-compare-ring-value"
            cx="32"
            cy="32"
            r={radius}
            strokeDasharray={`${fraction * circumference} ${circumference}`}
            transform="rotate(-90 32 32)"
          />
        )}
      </svg>
      <span aria-hidden="true" className="ux-reset-compare-ring-text">
        {value === null
          ? "—"
          : value.toLocaleString("en-US", { maximumFractionDigits: 1 })}
      </span>
    </span>
  );
}

/** A 0 to 100 mini track used for score components. */
export function CompareMiniTrack({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="ux-reset-compare-mini">
      <span className="ux-reset-compare-mini-label">{label}</span>
      {value === null ? (
        <span
          className="ux-reset-compare-missing"
          data-observation="unavailable"
        >
          <SquareDashed aria-hidden="true" className="size-3.5" />
          <span>No value</span>
        </span>
      ) : (
        <>
          <span aria-hidden="true" className="ux-reset-compare-track">
            <span
              className="ux-reset-compare-fill"
              style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
            />
          </span>
          <span className="ux-reset-compare-vlabel">
            {value.toLocaleString("en-US", { maximumFractionDigits: 1 })}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Value for a catalog observation shown under "More measures".
 * Source details live behind one info button, never repeated under the value.
 */
export function CompareMeasureValue({
  county,
  evidence,
  label,
}: {
  county: string;
  evidence: EvidenceObjectModel;
  label: string;
}) {
  const caveat = evidence.provenance.materialCaveat?.trim();
  const zero = evidence.reasonCode === "ZERO";
  return (
    <div
      className="ux-reset-compare-measure-value"
      data-evidence-availability={evidence.availability}
      data-testid="ux-reset-evidence-object"
    >
      <p
        className="ux-reset-evidence-value"
        data-testid="evidence-display-value"
      >
        {evidence.displayValue}
      </p>
      {zero ? (
        <p className="type-small">
          Published zero. This is not a missing value.
        </p>
      ) : null}
      {caveat ? <p className="type-small">{caveat}</p> : null}
      <CompareInfoButton county={county} evidence={evidence} label={label} />
    </div>
  );
}
