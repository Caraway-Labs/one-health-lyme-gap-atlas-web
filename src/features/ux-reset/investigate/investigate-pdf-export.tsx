import { AtlasStatusMessage } from "@/components/atlas-status-message";
import {
  investigateCountyReportExportOffer,
  type InvestigatePdfContext,
} from "@/features/ux-reset/investigate/investigate-next-step";

/**
 * The legacy county PDF is withheld. Loading, failure, and stale-download
 * guards stay on `downloadPdfReport` for callers whose report contract can
 * be checked.
 */
export function InvestigatePdfExport({
  context,
}: {
  context: InvestigatePdfContext;
}) {
  const offer = investigateCountyReportExportOffer(context);

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
      <AtlasStatusMessage title="PDF unavailable" titleAs="h3" tone="empty">
        <p data-testid="investigate-pdf-unavailable">{offer.reason}</p>
      </AtlasStatusMessage>
    </div>
  );
}
