"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MINIMUM_REPORTED_CASES_TOOLTIP,
  MINIMUM_REPORTED_INCIDENCE_TOOLTIP,
} from "@/features/ux-reset/review/published-human-case-copy";
import { reviewRationaleEvidence } from "@/features/ux-reset/review/review-rationale-provenance";
import {
  reviewRationaleMeasures,
  type ReviewRationaleMeasureView,
} from "@/features/ux-reset/review/review-rationale-rows";
import { ReviewRationaleSourceDetails } from "@/features/ux-reset/review/review-rationale-source-details";
import type { CountyDetail } from "@/generated/models";

const MEASURE_HELP: Partial<Record<number, string>> = {
  1: `${MINIMUM_REPORTED_CASES_TOOLTIP} ${MINIMUM_REPORTED_INCIDENCE_TOOLTIP}`,
};

function MeasureHeader({ measure }: { measure: ReviewRationaleMeasureView }) {
  const help = MEASURE_HELP[measure.number] ?? measure.headerHelp;
  const title =
    measure.number === 3 ? (
      <>
        <em>Borrelia burgdorferi</em> detection
      </>
    ) : (
      measure.label
    );
  return (
    <h4 className="ux-reset-review-rationale-measure-title">
      <span>{title}</span>
      {help ? (
        <Popover>
          <PopoverTrigger
            aria-label={`About ${measure.label}`}
            className="ux-reset-review-rationale-measure-help"
            type="button"
          >
            <Info aria-hidden="true" size={14} strokeWidth={2} />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="ux-reset-review-rationale-measure-help-content w-auto max-w-xs text-xs"
            side="top"
          >
            <p className="m-0">{help}</p>
          </PopoverContent>
        </Popover>
      ) : null}
    </h4>
  );
}

function CompactRows({ rows }: { rows: ReviewRationaleMeasureView["rows"] }) {
  return (
    <dl className="ux-reset-review-rationale-rows">
      {rows.map((row) => (
        <div className="ux-reset-review-rationale-row" key={row.label}>
          <dt>
            {row.label === "Ixodes scapularis" ||
            row.label === "Ixodes pacificus" ? (
              <em>{row.label}</em>
            ) : (
              row.label
            )}
          </dt>
          <dd
            className={
              row.valueTone === "neutral"
                ? "ux-reset-review-rationale-value-neutral"
                : undefined
            }
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RationaleMeasure({
  evidence,
  measure,
}: {
  evidence: ReturnType<typeof reviewRationaleEvidence>;
  measure: ReviewRationaleMeasureView;
}) {
  const models = evidence.get(measure.number) ?? [];
  return (
    <article
      className="ux-reset-review-rationale-measure"
      data-testid={`review-rationale-${measure.number}`}
    >
      <MeasureHeader measure={measure} />
      <CompactRows rows={measure.rows} />
      {measure.secondaryNote ? (
        <p className="ux-reset-review-rationale-secondary">
          {measure.secondaryNote}
        </p>
      ) : null}
      <ReviewRationaleSourceDetails models={models} />
    </article>
  );
}

export function ReviewRationalePanel({ detail }: { detail: CountyDetail }) {
  const measures = reviewRationaleMeasures(detail);
  const evidence = reviewRationaleEvidence(detail);
  const surveillance = measures.filter((item) => item.group === "surveillance");
  const community = measures.filter((item) => item.group === "community");
  return (
    <section
      aria-label="County evidence"
      className="ux-reset-review-rationale"
      data-testid="review-rationale"
    >
      <h3>Disease and tick data</h3>
      <div className="ux-reset-review-rationale-group">
        {surveillance.map((measure) => (
          <RationaleMeasure
            evidence={evidence}
            key={measure.number}
            measure={measure}
          />
        ))}
      </div>
      <h3>Community context</h3>
      <div className="ux-reset-review-rationale-group">
        {community.map((measure) => (
          <RationaleMeasure
            evidence={evidence}
            key={measure.number}
            measure={measure}
          />
        ))}
      </div>
      <p className="ux-reset-review-rationale-footnote">
        No record does not mean absent or zero.
      </p>
    </section>
  );
}
