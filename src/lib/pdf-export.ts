import {
  getCountyReportPdfV1CountiesFipsReportPdfGetUrl,
  getStateReportPdfV1StatesStateReportPdfGetUrl,
} from "@/generated/atlas";
import {
  countyReportPdfV1CountiesFipsReportPdfGetParamsEcologicalShareDefault,
  countyReportPdfV1CountiesFipsReportPdfGetParamsLowIncidenceBreakpointDefault,
  countyReportPdfV1CountiesFipsReportPdfGetParamsMissingHumanWeaknessDefault,
} from "@/generated/zod/countyReportPdfV1CountiesFipsReportPdfGetParams.zod";
import type { ScoreSettings } from "@/lib/atlas-ui";
import { getPublicConfig } from "@/lib/public-config";

type ReportGeography =
  | { identifier: string; level: "county" }
  | { identifier: string; level: "state" };

export type PdfDownloadOptions = {
  /** When this flips, the response is discarded and no file is saved. */
  shouldCommit?: () => boolean;
  signal?: AbortSignal;
};

export type PdfDownloadResult = {
  /** True only when a file download was started for this response. */
  committed: boolean;
};

/**
 * Contract defaults for the county report. Investigate has no scoring lab, so
 * export uses these values instead of a second parameter mapping.
 */
export function governedCountyReportScoreSettings(): ScoreSettings {
  return {
    ecological_share:
      countyReportPdfV1CountiesFipsReportPdfGetParamsEcologicalShareDefault,
    low_incidence_breakpoint:
      countyReportPdfV1CountiesFipsReportPdfGetParamsLowIncidenceBreakpointDefault,
    missing_human_weakness:
      countyReportPdfV1CountiesFipsReportPdfGetParamsMissingHumanWeaknessDefault,
  };
}

function filenameFromDisposition(header: string | null, fallback: string) {
  const match = /filename="?(?<filename>[^";]+)"?/i.exec(header ?? "");
  return match?.groups?.filename ?? fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function exportSuperseded(options: PdfDownloadOptions | undefined): boolean {
  if (options?.signal?.aborted) {
    return true;
  }
  return options?.shouldCommit?.() === false;
}

export async function downloadPdfReport(
  geography: ReportGeography,
  settings: ScoreSettings,
  datasetVersion: string,
  options?: PdfDownloadOptions
): Promise<PdfDownloadResult> {
  if (exportSuperseded(options)) {
    return { committed: false };
  }
  const params = {
    dataset_version: datasetVersion,
    ecological_share: settings.ecological_share,
    low_incidence_breakpoint: settings.low_incidence_breakpoint,
    missing_human_weakness: settings.missing_human_weakness,
  };
  // The generated client provides the contract URL. This small wrapper retains
  // binary response headers so the browser can honor the server filename.
  const path =
    geography.level === "county"
      ? getCountyReportPdfV1CountiesFipsReportPdfGetUrl(
          geography.identifier,
          params
        )
      : getStateReportPdfV1StatesStateReportPdfGetUrl(
          geography.identifier,
          params
        );
  let response: Response;
  try {
    response = await fetch(`${getPublicConfig().apiBaseUrl}${path}`, {
      signal: options?.signal,
    });
  } catch (error) {
    if (exportSuperseded(options) || isAbortError(error)) {
      return { committed: false };
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(`PDF export failed (${response.status})`);
  }
  const blob = await response.blob();
  // A late or failed response must not create a download, including one left
  // over from an earlier county or release.
  if (exportSuperseded(options)) {
    return { committed: false };
  }
  if (!(blob.size > 0)) {
    throw new Error("PDF export failed (empty file).");
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFromDisposition(
    response.headers.get("content-disposition"),
    `lyme-gap-atlas-${geography.level}-${geography.identifier}.pdf`
  );
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return { committed: true };
}
