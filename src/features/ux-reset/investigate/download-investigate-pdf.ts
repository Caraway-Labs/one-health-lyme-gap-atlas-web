import {
  investigateCountyReportExportOffer,
  type InvestigatePdfContext,
} from "@/features/ux-reset/investigate/investigate-next-step";
import {
  countyReportPdfV1CountiesFipsReportPdfGet,
  observationsV1ObservationsGet,
} from "@/generated/atlas";
import type { Observation } from "@/generated/models";
import { ObservationsV1ObservationsGetResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import type { PdfDownloadOptions, PdfDownloadResult } from "@/lib/pdf-export";

/** Stable comparison includes all governed fields, without depending on JSON key order. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function evidenceIdentity(records: readonly Observation[]): string {
  return canonicalJson(
    [...records].sort((a, b) =>
      a.observation_id.localeCompare(b.observation_id)
    )
  );
}

export async function downloadInvestigatePdf(
  context: InvestigatePdfContext,
  options: PdfDownloadOptions
): Promise<PdfDownloadResult> {
  const offer = investigateCountyReportExportOffer(context);
  if (offer.state !== "available") throw new Error(offer.reason);
  const superseded = () =>
    options.signal?.aborted || options.shouldCommit?.() === false;
  if (superseded()) return { committed: false };
  const expected = evidenceIdentity(context.observations ?? []);
  const verify = async () => {
    const fresh: Observation[] = [];
    // Match the backend's bounded, unpaginated read. Never reuse the query cache.
    for (const measureId of offer.measureIds) {
      const response = await observationsV1ObservationsGet(
        {
          measure_id: measureId,
          geography_type: "county",
          geography_id: [context.countyFips],
          start_date: offer.periodStart,
          end_date: offer.periodEnd,
          page_size: 500,
        },
        { signal: options.signal, cache: "no-store" }
      );
      if (response.status !== 200)
        throw new Error("Canonical evidence could not be checked.");
      const parsed = validateApiResponse(
        "Observations",
        ObservationsV1ObservationsGetResponse,
        response.data
      );
      if (parsed.meta.next_page_token || !parsed.data.length)
        throw new Error("Complete canonical evidence is unavailable.");
      fresh.push(...parsed.data);
    }
    if (evidenceIdentity(fresh) !== expected)
      throw new Error(
        "Evidence changed. Refresh Investigate before exporting."
      );
  };
  await verify();
  if (superseded()) return { committed: false };
  const response = await countyReportPdfV1CountiesFipsReportPdfGet(
    context.countyFips,
    {
      template: "county-v2",
      dataset_version: context.releaseId,
      period_start: offer.periodStart,
      period_end: offer.periodEnd,
      measure_id: offer.measureIds,
    },
    {
      signal: options.signal,
      cache: "no-store",
      headers: { Accept: "application/pdf" },
    }
  );
  if (
    response.status !== 200 ||
    !(response.data instanceof Blob) ||
    response.data.size === 0 ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/pdf") ||
    !response.headers
      .get("cache-control")
      ?.toLowerCase()
      .split(",")
      .some((item) => item.trim() === "no-store")
  ) {
    throw new Error("A matching PDF is unavailable.");
  }
  // Reject changed evidence during rendering, including provenance or caveat changes.
  await verify();
  if (superseded()) return { committed: false };
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `atlas-county-${context.countyFips}-${offer.periodStart}-${offer.periodEnd}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return { committed: true };
}
