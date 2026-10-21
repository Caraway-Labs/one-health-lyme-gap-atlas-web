"use client";

import { ChevronDown, Download, FileDown, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCountyPdfDownload } from "@/features/ux-reset/review/download-county-pdf-button";
import { EXPLORER_COUNTY_EXPORT_NOTE } from "@/features/ux-reset/review/explorer-county-reference";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import "./explorer-visual-first.css";

export type ExplorerExportCounty = {
  countyName: string;
  fips: string;
  releaseId: string;
  stateCode: string;
};

const CSV_DESCRIPTION = "Counties in the current filters. No scores.";
const PDF_DESCRIPTION = "Published report for the selected county.";
const PDF_NEEDS_COUNTY = "Select a county";

/**
 * One Export menu (UX audit B7). The CSV keeps its governed scope note for
 * assistive technology; the menu shows a one-line description. A county
 * report needs a selected county and says so instead of a separate sentence.
 * Exports with scores need a provenance decision and are not offered.
 */
export function ExplorerExportMenu({
  county,
  csvDisabled,
  onDownloadCsv,
}: {
  county: ExplorerExportCounty | null;
  csvDisabled: boolean;
  onDownloadCsv: () => void;
}) {
  return (
    <ExplorerExportMenuForSelection
      key={county ? `${county.fips}\u0000${county.releaseId}` : "none"}
      county={county}
      csvDisabled={csvDisabled}
      onDownloadCsv={onDownloadCsv}
    />
  );
}

function ExplorerExportMenuForSelection({
  county,
  csvDisabled,
  onDownloadCsv,
}: {
  county: ExplorerExportCounty | null;
  csvDisabled: boolean;
  onDownloadCsv: () => void;
}) {
  const pdf = useCountyPdfDownload({
    countyName: county?.countyName ?? "",
    fips: county?.fips ?? "",
    releaseId: county?.releaseId ?? "",
    stateCode: county?.stateCode ?? "",
  });
  const pdfBusy = pdf.phase === "downloading";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              {...analyticsControlAttributes("csv_download")}
              aria-describedby="explorer-county-export-note"
              data-export-scope="state,county-search,available-data"
              data-testid="explorer-export-menu"
              size="sm"
              type="button"
              variant="outline"
            />
          }
        >
          <Download aria-hidden="true" data-icon="inline-start" />
          <span className="max-sm:sr-only">Export</span>
          <ChevronDown aria-hidden="true" data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            <DropdownMenuItem
              aria-label="Download county list as CSV"
              data-testid="explorer-download-counties"
              disabled={csvDisabled}
              onClick={onDownloadCsv}
            >
              <FileSpreadsheet aria-hidden="true" />
              <span className="ux-reset-explorer-export-item">
                <span>County list (CSV)</span>
                <span className="ux-reset-explorer-export-description">
                  {CSV_DESCRIPTION}
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              aria-label="Download county report as PDF"
              data-county={county?.fips}
              data-testid="explorer-export-pdf"
              disabled={!pdf.canDownload || pdfBusy}
              onClick={() => {
                void pdf.download();
              }}
            >
              <FileDown aria-hidden="true" />
              <span className="ux-reset-explorer-export-item">
                <span>County report (PDF)</span>
                <span className="ux-reset-explorer-export-description">
                  {pdf.canDownload ? PDF_DESCRIPTION : PDF_NEEDS_COUNTY}
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <p
        className="sr-only"
        data-testid="explorer-county-export-note"
        id="explorer-county-export-note"
      >
        {EXPLORER_COUNTY_EXPORT_NOTE}
      </p>
      {pdf.phase === "error" ? (
        <p className="text-destructive text-sm" role="alert">
          The county PDF could not be downloaded. Try again. The published
          report was not changed.
        </p>
      ) : null}
    </>
  );
}
