import type { InvestigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import type { PdfDownloadOptions, PdfDownloadResult } from "@/lib/pdf-export";

export const syntheticPdfExportModes = ["succeed", "pending", "fail"] as const;

export type SyntheticPdfExportMode = (typeof syntheticPdfExportModes)[number];

export const SYNTHETIC_PDF_EXPORT_FAILURE =
  "Synthetic PDF export failed. No file was downloaded.";

let mode: SyntheticPdfExportMode = "succeed";

/** Storybook-only mode for the aliased download module. Each iframe has its own copy. */
export function setSyntheticPdfExportMode(next: SyntheticPdfExportMode): void {
  mode = next;
}

/**
 * Storybook stand-in for `downloadInvestigatePdf`.
 * It never calls the API and never starts a browser download.
 * Pending stays unresolved until the story aborts the request.
 */
export async function downloadInvestigatePdf(
  context: InvestigatePdfContext,
  options: PdfDownloadOptions
): Promise<PdfDownloadResult> {
  if (context.countyFips.trim().length === 0) {
    throw new Error(SYNTHETIC_PDF_EXPORT_FAILURE);
  }
  if (mode === "pending") {
    const pending = Promise.withResolvers<PdfDownloadResult>();
    const abort = () => {
      pending.reject(
        new DOMException("Synthetic PDF export is still pending.", "AbortError")
      );
    };
    if (options.signal?.aborted) {
      abort();
    } else {
      options.signal?.addEventListener("abort", abort, { once: true });
    }
    return pending.promise;
  }
  if (options.signal?.aborted || options.shouldCommit?.() === false) {
    return { committed: false };
  }
  if (mode === "fail") {
    throw new Error(SYNTHETIC_PDF_EXPORT_FAILURE);
  }
  return { committed: false };
}
