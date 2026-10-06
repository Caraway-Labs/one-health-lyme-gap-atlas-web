"use client";

import { useEffect, useRef, useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import {
  investigateExportIdentity,
  type InvestigatePdfContext,
} from "@/features/ux-reset/investigate/investigate-next-step";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import {
  downloadPdfReport,
  governedCountyReportScoreSettings,
} from "@/lib/pdf-export";

type ExportPhase = "error" | "idle" | "loading";

function joinVisible(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.join("; ") : empty;
}

export function InvestigatePdfExport({
  context,
}: {
  context: InvestigatePdfContext;
}) {
  const identity = investigateExportIdentity(context);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const activeRef = useRef(false);
  const identityRef = useRef(identity);

  useEffect(() => {
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      activeRef.current = false;
      setPhase("idle");
    }
    return () => {
      generation.current += 1;
      activeRef.current = false;
      abortRef.current?.abort();
    };
  }, [identity]);

  async function exportPdf() {
    if (activeRef.current || phase === "loading") {
      return;
    }
    activeRef.current = true;
    const generationAtStart = generation.current + 1;
    generation.current = generationAtStart;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("loading");
    try {
      await downloadPdfReport(
        { identifier: context.countyFips, level: "county" },
        governedCountyReportScoreSettings(),
        context.releaseId,
        {
          shouldCommit: () =>
            generation.current === generationAtStart &&
            !controller.signal.aborted,
          signal: controller.signal,
        }
      );
      if (generation.current !== generationAtStart) {
        return;
      }
      setPhase("idle");
    } catch {
      if (generation.current !== generationAtStart) {
        return;
      }
      setPhase("error");
    } finally {
      if (generation.current === generationAtStart) {
        activeRef.current = false;
      }
    }
  }

  const periodText = context.requestedPeriod
    ? `Requested period ${context.requestedPeriod}. Observation period ${joinVisible(context.periods, "none shown")}.`
    : `Observation period ${joinVisible(context.periods, "none shown")}.`;

  return (
    <div
      className="ux-reset-investigate-export"
      data-export-state={phase}
      data-testid="investigate-export-state"
    >
      <dl
        className="type-small"
        data-caveats={context.caveats.join("\n")}
        data-county={context.countyFips}
        data-observation-periods={context.periods.join("\n")}
        data-period={context.requestedPeriod ?? ""}
        data-release={context.releaseId}
        data-sources={context.sources.join("\n")}
        data-testid="investigate-export-context"
        id="investigate-export-context"
      >
        <div>
          <dt>County</dt>
          <dd>{context.countyFips}</dd>
        </div>
        <div>
          <dt>Release</dt>
          <dd>{context.releaseId}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>{periodText}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{joinVisible(context.sources, "No source is shown.")}</dd>
        </div>
        <div>
          <dt>Caveats</dt>
          <dd>
            {joinVisible(context.caveats, "No caveat is shown on this page.")}
          </dd>
        </div>
      </dl>
      <Button
        {...analyticsControlAttributes("pdf_export")}
        aria-busy={phase === "loading"}
        aria-describedby="investigate-export-context"
        data-testid="investigate-export"
        disabled={phase === "loading"}
        type="button"
        variant="secondary"
        onClick={() => {
          void exportPdf();
        }}
      >
        {phase === "loading" ? "Generating PDF…" : "Export PDF"}
      </Button>
      {phase === "loading" ? (
        <AtlasStatusMessage tone="loading">
          Generating the report for this county.
        </AtlasStatusMessage>
      ) : null}
      {phase === "error" ? (
        <AtlasStatusMessage tone="error">
          We couldn’t generate this report. Please try again.
        </AtlasStatusMessage>
      ) : null}
    </div>
  );
}
