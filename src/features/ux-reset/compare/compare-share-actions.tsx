"use client";

import { FileDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

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
 * Identity of one download operation. Retry-only-failed stays inside this key.
 * A different pair or release is a new operation.
 */
export function compareDownloadOperationKey(
  counties: readonly Pick<CompareShareCounty, "fips">[],
  releaseId: string
): string {
  return `${releaseId.trim()}:${counties.map((county) => county.fips).join(",")}`;
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
  const release = releaseId.trim();
  const operationKey = compareDownloadOperationKey(counties, releaseId);
  const operationKeyRef = useRef(operationKey);
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<DownloadPhase>("idle");
  const [failed, setFailed] = useState<readonly CompareShareCounty[]>([]);
  const [phaseKey, setPhaseKey] = useState(operationKey);
  if (phaseKey !== operationKey) {
    setPhaseKey(operationKey);
    setPhase("idle");
    setFailed([]);
  }
  const ready =
    release.length > 0 &&
    counties.length > 0 &&
    counties.every(
      (county) =>
        /^\d{5}$/.test(county.fips) &&
        atlasBriefFilename(county.countyName, county.stateCode) !== null
    );

  useLayoutEffect(() => {
    operationKeyRef.current = operationKey;
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [operationKey]);

  const downloadOne = async (
    county: CompareShareCounty,
    controller: AbortController,
    operationIdentity: string
  ): Promise<CountyOutcome> => {
    const filename = atlasBriefFilename(county.countyName, county.stateCode);
    if (!filename) {
      return { county, ok: false };
    }
    const stillCurrent = () =>
      operationKeyRef.current === operationIdentity &&
      !controller.signal.aborted;
    try {
      const result = await downloadPdfReport(
        { identifier: county.fips, level: "county" },
        governedCountyReportScoreSettings(),
        release,
        {
          approvedFilename: filename,
          isApprovedServerFilename: (serverName) => serverName === filename,
          shouldCommit: stillCurrent,
          signal: controller.signal,
        }
      );
      return { county, ok: result.committed && stillCurrent() };
    } catch {
      return { county, ok: false };
    }
  };

  const handleDownload = async () => {
    if (!ready || phase === "downloading") {
      return;
    }
    const operationIdentity = operationKey;
    // Retry only the counties that failed for this same pair and release.
    const targets =
      phase === "error" && failed.length > 0 ? failed : [...counties];
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setPhase("downloading");
    // Both requests start from the same click so the browser treats the two
    // files as one user-initiated download.
    const outcomes = await Promise.all(
      targets.map((county) =>
        downloadOne(county, controller, operationIdentity)
      )
    );
    if (
      controller.signal.aborted ||
      operationKeyRef.current !== operationIdentity
    ) {
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
