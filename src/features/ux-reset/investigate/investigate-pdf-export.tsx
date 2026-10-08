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
      data-observation-periods={context.periods.join("\n")}
      data-period={context.requestedPeriod ?? ""}
      data-release={context.releaseId}
      data-sources={context.sources.join("\n")}
      data-testid="investigate-export-context"
    >
      {offer.state === "available" ? (
        <Button disabled={pending} onClick={exportPdf} type="button">
          {pending ? "Generating PDF…" : "Export PDF"}
        </Button>
      ) : (
        <AtlasStatusMessage title="PDF unavailable" titleAs="h3" tone="empty">
          <p data-testid="investigate-pdf-unavailable">{offer.reason}</p>
        </AtlasStatusMessage>
      )}
      {error ? (
        <AtlasStatusMessage title="PDF unavailable" titleAs="h3" tone="error">
          <p>{error}</p>
        </AtlasStatusMessage>
      ) : null}
    </div>
  );
}
