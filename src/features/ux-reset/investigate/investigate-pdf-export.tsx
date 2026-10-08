"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { downloadInvestigatePdf } from "@/features/ux-reset/investigate/download-investigate-pdf";
import {
  investigateCountyReportExportOffer,
  type InvestigatePdfContext,
} from "@/features/ux-reset/investigate/investigate-next-step";

export function InvestigatePdfExport({
  context,
}: {
  context: InvestigatePdfContext;
}) {
  return (
    <InvestigatePdfExportForContext
      key={JSON.stringify(context)}
      context={context}
    />
  );
}

function InvestigatePdfExportForContext({
  context,
}: {
  context: InvestigatePdfContext;
}) {
  const offer = investigateCountyReportExportOffer(context);
  // Identity includes every visible value, version, source and caveat, not just selectors.
  const identity = JSON.stringify(context);
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    identity: string;
    pending: boolean;
    error: string | null;
  }>({ identity, pending: false, error: null });
  useLayoutEffect(
    () => () => {
      request.current?.abort();
    },
    []
  );
  const current = state.identity === identity;
  const pending = current && state.pending;
  const error = current ? state.error : null;

  async function exportPdf() {
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController();
    request.current = controller;
    const shouldCommit = () => !controller.signal.aborted;
    setState({ identity, pending: true, error: null });
    try {
      await downloadInvestigatePdf(context, {
        signal: controller.signal,
        shouldCommit,
      });
      if (shouldCommit()) setState({ identity, pending: false, error: null });
    } catch (error) {
      if (shouldCommit())
        setState({
          identity,
          pending: false,
          error:
            error instanceof Error
              ? error.message
              : "A matching report could not be generated.",
        });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  return (
    <div
      className="ux-reset-investigate-export"
      data-caveats={context.caveats.join("\n")}
      data-county={context.countyFips}
      data-export-state={offer.state}
      data-included={
        offer.state === "available" ? offer.measureIds.join("\n") : ""
      }
      data-observation-periods={context.periods.join("\n")}
      data-omitted={offer.omitted
        .map((measure) => measure.measureId)
        .join("\n")}
      data-period={context.requestedPeriod ?? ""}
      data-release={context.releaseId}
      data-sources={context.sources.join("\n")}
      data-testid="investigate-export-context"
    >
      {offer.state === "available" ? (
        <div data-testid="investigate-pdf-scope">
          <h3 className="type-body">County PDF</h3>
          <p className="type-body">
            {`This PDF uses ${offer.periodStart} through ${offer.periodEnd}. It includes the published measures below.`}
          </p>
          <h4 className="type-body">Included</h4>
          <ul data-testid="investigate-pdf-included">
            {offer.included.map((measure) => (
              <li key={measure.measureId}>{measure.label}</li>
            ))}
          </ul>
          {offer.omitted.length > 0 ? (
            <>
              <h4 className="type-body">Left out</h4>
              <ul data-testid="investigate-pdf-omitted">
                {offer.omitted.map((measure) => (
                  <li key={measure.measureId}>
                    {`${measure.label}. ${measure.reason}`}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <Button
            className="w-fit"
            variant="secondary"
            disabled={pending}
            onClick={exportPdf}
            type="button"
          >
            {pending ? "Generating PDF…" : "Export PDF"}
          </Button>
        </div>
      ) : (
        <div data-testid="investigate-pdf-empty">
          <h3 className="type-body">County PDF</h3>
          <p>{offer.reason}</p>
          {offer.omitted.length > 0 ? (
            <ul data-testid="investigate-pdf-omitted">
              {offer.omitted.map((measure) => (
                <li key={measure.measureId}>
                  {`${measure.label}. ${measure.reason}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {error ? (
        <AtlasStatusMessage
          title="The PDF did not download"
          titleAs="h3"
          tone="error"
        >
          <p>{error}</p>
        </AtlasStatusMessage>
      ) : null}
    </div>
  );
}
