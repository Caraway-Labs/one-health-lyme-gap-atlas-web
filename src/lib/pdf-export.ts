import {
  getCountyReportPdfV1CountiesFipsReportPdfGetUrl,
  getStateReportPdfV1StatesStateReportPdfGetUrl,
} from "@/generated/atlas";
import type { ScoreSettings } from "@/lib/atlas-ui";
import { getPublicConfig } from "@/lib/public-config";

type ReportGeography =
  | { identifier: string; level: "county" }
  | { identifier: string; level: "state" };

function filenameFromDisposition(header: string | null, fallback: string) {
  const match = /filename="?(?<filename>[^";]+)"?/i.exec(header ?? "");
  return match?.groups?.filename ?? fallback;
}

export async function downloadPdfReport(
  geography: ReportGeography,
  settings: ScoreSettings,
  datasetVersion: string
) {
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
  const response = await fetch(`${getPublicConfig().apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`PDF export failed (${response.status})`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
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
}
