"use client";

import { FileDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  atlasBriefFilename,
  downloadPdfReport,
  governedCountyReportScoreSettings,
} from "@/lib/pdf-export";

export type CompareShareCounty = {
  countyName: string;
  fips: string;
  /** Human label used in status and error messages. */
  label: string;
  stateCode: string;
};

type DownloadPhase = "done" | "downloading" | "error" | "idle";

type CountyOutcome = { county: CompareShareCounty; ok: boolean };

function describeError(failed: readonly CompareShareCounty[]): string {
  const names = failed.map((county) => county.label).join(" and ");
  return `The PDF for ${names} could not be downloaded. Try again. The published report was not changed.`;
}

/**
 * Downloads the published county report PDF for each compared county, using
 * the same request and filename logic as the Explore county download.
 */
export function CompareDownloadPdfsButton({
  counties,
  releaseId,
}: {
  counties: readonly CompareShareCounty[];
  releaseId: string;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<DownloadPhase>("idle");
  const [failed, setFailed] = useState<readonly CompareShareCounty[]>([]);
  const release = releaseId.trim();
  const ready =
    release.length > 0 &&
    counties.length > 0 &&
    counties.every(
      (county) =>
        /^\d{5}$/.test(county.fips) &&
        atlasBriefFilename(county.countyName, county.stateCode) !== null
    );

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const downloadOne = async (
    county: CompareShareCounty,
    controller: AbortController
  ): Promise<CountyOutcome> => {
    const filename = atlasBriefFilename(county.countyName, county.stateCode);
    if (!filename) {
      return { county, ok: false };
    }
    try {
      await downloadPdfReport(
        { identifier: county.fips, level: "county" },
        governedCountyReportScoreSettings(),
        release,
        {
          approvedFilename: filename,
          isApprovedServerFilename: (serverName) => serverName === filename,
          shouldCommit: () => !controller.signal.aborted,
          signal: controller.signal,
        }
      );
      return { county, ok: true };
    } catch {
      return { county, ok: false };
    }
  };

  const handleDownload = async () => {
    if (!ready || phase === "downloading") {
      return;
    }
    // Retry only the counties that failed last time.
    const targets =
      phase === "error" && failed.length > 0 ? failed : [...counties];
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setPhase("downloading");
    // Both requests start from the same click so the browser treats the two
    // files as one user-initiated download.
    const outcomes = await Promise.all(
      targets.map((county) => downloadOne(county, controller))
    );
    if (controller.signal.aborted) {
      return;
    }
    const failures = outcomes
      .filter((outcome) => !outcome.ok)
      .map((outcome) => outcome.county);
    setFailed(failures);
    setPhase(failures.length > 0 ? "error" : "done");
  };

  const handleClick = () => {
    void handleDownload();
  };

  const busy = phase === "downloading";
  let label = "Download Counties as PDF";
  if (busy) {
    label = "Preparing PDFs…";
  }

  return (
    <>
      <Button
        aria-busy={busy}
        data-state={ready ? phase : "disabled"}
        data-testid="compare-download-pdfs"
        disabled={!ready || busy}
        size="sm"
        type="button"
        variant="outline"
        onClick={handleClick}
      >
        <FileDown aria-hidden="true" data-icon="inline-start" />
        {label}
      </Button>
      <span className="sr-only" aria-live="polite" role="status">
        {phase === "done" ? "County PDFs downloaded." : ""}
        {busy ? "Preparing county PDFs." : ""}
      </span>
      {phase === "error" ? (
        <p
          className="text-destructive text-sm"
          data-testid="compare-download-pdfs-error"
          role="alert"
        >
          {describeError(failed)}
        </p>
      ) : null}
    </>
  );
}
