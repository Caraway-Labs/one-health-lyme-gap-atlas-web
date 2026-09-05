"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ScoreSettings } from "@/lib/atlas-ui";
import { downloadPdfReport } from "@/lib/pdf-export";

export function PdfExportButton({
  geography,
  settings,
  datasetVersion,
}: {
  geography:
    | { identifier: string; level: "county" }
    | { identifier: string; level: "state" };
  settings: ScoreSettings;
  datasetVersion: string;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(false);

  async function exportPdf() {
    if (isExporting) return;
    setError(false);
    setIsExporting(true);
    try {
      await downloadPdfReport(geography, settings, datasetVersion);
    } catch {
      setError(true);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <Button disabled={isExporting} onClick={exportPdf} type="button">
        {isExporting ? "Generating PDF…" : "Export PDF"}
      </Button>
      {error && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          We couldn’t generate this report. Please try again.
        </p>
      )}
    </div>
  );
}
