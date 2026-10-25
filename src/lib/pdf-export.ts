import {
  getDownloadCountyReportUrl,
  getDownloadStateReportUrl,
} from "@/generated/atlas";
import {
  downloadCountyReportParamsEcologicalShareDefault,
  downloadCountyReportParamsSmoothKDefault,
  downloadCountyReportParamsMissingHumanWeaknessDefault,
} from "@/generated/zod/downloadCountyReportParams.zod";
import type { ScoreSettings } from "@/lib/atlas-ui";
import { getPublicConfig } from "@/lib/public-config";

type ReportGeography =
  | { identifier: string; level: "county" }
  | { identifier: string; level: "state" };

export type PdfDownloadOptions = {
  /**
   * Saved name when the server filename is missing or not approved.
   * An approved server filename still wins.
   */
  approvedFilename?: string;
  /** True only for a server filename that matches the approved naming standard. */
  isApprovedServerFilename?: (filename: string) => boolean;
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
    ecological_share: downloadCountyReportParamsEcologicalShareDefault,
    smooth_k: downloadCountyReportParamsSmoothKDefault,
    missing_human_weakness:
      downloadCountyReportParamsMissingHumanWeaknessDefault,
  };
}

/**
 * Exact `application/pdf` only. Letter case and parameters are ignored.
 * Prefixed subtypes such as `application/pdf+json` are not PDFs.
 */
function isPdfContentType(contentType: string | null): boolean {
  const [mediaType = ""] = (contentType ?? "").split(";", 1);
  return mediaType.trim().toLowerCase() === "application/pdf";
}

function serverFilename(header: string | null): string | null {
  const match = /filename="?(?<filename>[^";]+)"?/i.exec(header ?? "");
  const filename = match?.groups?.filename?.trim();
  return filename || null;
}

const ATLAS_BRIEF_FILENAME =
  /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_[A-Z]{2}_AtlasBrief\.pdf$/;

/**
 * Approved browser filename, for example `Worth_IA_AtlasBrief.pdf`.
 * A trailing "County" is omitted. Other punctuation becomes underscores.
 */
export function atlasBriefFilename(
  countyName: string,
  stateCode: string
): string | null {
  const state = stateCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    return null;
  }
  const county = countyName
    .trim()
    .replace(/ county$/i, "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .replaceAll(/[^A-Za-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
  if (!county) {
    return null;
  }
  const filename = `${county}_${state}_AtlasBrief.pdf`;
  return ATLAS_BRIEF_FILENAME.test(filename) ? filename : null;
}

function savedDownloadName(
  header: string | null,
  fallback: string,
  options: PdfDownloadOptions | undefined
): string {
  const serverName = serverFilename(header);
  if (!options?.approvedFilename) {
    return serverName ?? fallback;
  }
  if (serverName && options.isApprovedServerFilename?.(serverName) === true) {
    return serverName;
  }
  return options.approvedFilename;
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
    smooth_k: settings.smooth_k,
    missing_human_weakness: settings.missing_human_weakness,
  };
  // The generated client provides the contract URL. This small wrapper retains
  // binary response headers so the browser can honor the server filename.
  const path =
    geography.level === "county"
      ? getDownloadCountyReportUrl(geography.identifier, params)
      : getDownloadStateReportUrl(geography.identifier, params);
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
  const mediaType = response.headers.get("content-type") || blob.type;
  if (!isPdfContentType(mediaType)) {
    throw new Error("PDF export failed (unexpected type).");
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = savedDownloadName(
    response.headers.get("content-disposition"),
    `lyme-gap-atlas-${geography.level}-${geography.identifier}.pdf`,
    options
  );
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return { committed: true };
}
