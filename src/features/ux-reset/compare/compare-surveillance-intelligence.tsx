"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER,
  type SurveillanceIntelligencePerspectiveId,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import { SurveillanceIntelligenceDetails } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-details";
import { SurveillanceIntelligenceGuide } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-guide";
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
  side: "a" | "b";
  title: "County A" | "County B";
};

/**
 * Compare layout only. Four aligned rows share one details region.
 * Each county keeps the Explorer data hook and its own unavailable state.
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
    { fips: leftFips, label: leftLabel, side: "a", title: "County A" },
    { fips: rightFips, label: rightLabel, side: "b", title: "County B" },
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
      className="ux-reset-compare-group flex flex-col gap-3 p-3"
      data-testid="compare-surveillance-intelligence"
    >
      <h3 className="ux-reset-compare-group-title" id={titleId}>
        County Surveillance Intelligence
      </h3>
      <p className="sr-only" aria-live="polite">
        {`${left.announcement} ${right.announcement}`}
      </p>
      <Table
        aria-labelledby={titleId}
        className="table-fixed"
        data-testid="compare-surveillance-intelligence-table"
      >
        <TableHeader>
          <TableRow className="motion-reduce:transition-none">
            <TableHead className="w-[28%] whitespace-normal" scope="col">
              Perspective
            </TableHead>
            {columns.map((column) => (
              <TableHead
                className="whitespace-normal"
                key={column.side}
                scope="col"
              >
                <span className="block">{column.title}</span>
                <span className="type-small block font-normal break-words">
                  {column.label}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER.map((id) => {
            const expanded = openId === id;
            return (
              <TableRow
                className="motion-reduce:transition-none"
                data-perspective={id}
                data-testid={`compare-surveillance-row-${id}`}
                key={id}
              >
                <TableHead className="align-top whitespace-normal" scope="row">
                  <RowControl
                    controlsId={detailsId}
                    expanded={expanded}
                    label={
                      perspectives.a.find((entry) => entry.id === id)?.label ??
                      id
                    }
                    onToggle={() => {
                      toggle(id);
                    }}
                  />
                </TableHead>
                {columns.map((column) => {
                  const perspective = perspectives[column.side].find(
                    (entry) => entry.id === id
                  );
                  return (
                    <TableCell
                      className="align-top break-words whitespace-normal"
                      data-county={`${column.title}, ${column.label}`}
                      data-fips={column.fips}
                      data-kind={perspective?.kind}
                      data-side={column.side}
                      data-testid={`compare-surveillance-cell-${id}-${column.fips}`}
                      key={column.side}
                    >
                      {perspective ? (
                        <SurveillanceValue
                          county={column}
                          onRetry={() => {
                            retry[column.side](id);
                          }}
                          perspective={perspective}
                        />
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
      <SurveillanceIntelligenceGuide />
    </section>
  );
}

function RowControl({
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
        "h-auto min-h-11 w-full justify-start px-2 py-2 text-left whitespace-normal motion-reduce:transition-none",
        expanded && "ring-ring ring-2"
      )}
      type="button"
      variant={expanded ? "secondary" : "outline"}
      onClick={onToggle}
    >
      {label}
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
  return (
    <>
      <p className="m-0 font-semibold break-words">{perspective.primary}</p>
      <p className="type-small m-0 break-words">{perspective.supporting}</p>
      {perspective.fullValue ? (
        <span className="sr-only">{`Full value ${perspective.fullValue}`}</span>
      ) : null}
      {perspective.retryable ? (
        <Button
          className="mt-2 min-h-11 whitespace-normal"
          data-testid={`compare-surveillance-retry-${perspective.id}-${county.fips}`}
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          {`Retry ${perspective.label} for ${county.title}, ${county.label}`}
        </Button>
      ) : null}
    </>
  );
}
