"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import {
  atlasBriefFilename,
  downloadPdfReport,
  governedCountyReportScoreSettings,
} from "@/lib/pdf-export";

const DOWNLOAD_ERROR =
  "The county PDF could not be downloaded. Try again. The published report was not changed.";

type DownloadPhase = "error" | "idle" | "downloading";

function unavailableReason(
  fips: string,
  releaseId: string,
  filename: string | null
): string | null {
  if (!/^\d{5}$/.test(fips)) {
    return "Choose a county to download its PDF.";
  }
  if (!(releaseId.trim() && filename)) {
    return "The published release is not available, so this PDF cannot be downloaded.";
  }
  return null;
}

export function DownloadCountyPdfButton({
  countyName,
  fips,
  releaseId,
  stateCode,
}: {
  countyName: string;
  fips: string;
  releaseId: string;
  stateCode: string;
}) {
  return (
    <DownloadCountyPdfForSelection
      key={`${fips}\u0000${releaseId}\u0000${countyName}\u0000${stateCode}`}
      countyName={countyName}
      fips={fips}
      releaseId={releaseId}
      stateCode={stateCode}
    />
  );
}

/**
 * Published county report for one selected FIPS and release.
 * A new selection remounts this control and cancels the previous file.
 * What-if display settings are not sent. The server renders the PDF.
 */
function DownloadCountyPdfForSelection({
  countyName,
  fips,
  releaseId,
  stateCode,
}: {
  countyName: string;
  fips: string;
  releaseId: string;
  stateCode: string;
}) {
  const hintId = useId();
  const errorId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<DownloadPhase>("idle");
  const filename = atlasBriefFilename(countyName, stateCode);
  const reason = unavailableReason(fips, releaseId, filename);
  const canDownload = reason === null && filename !== null;
  useLayoutEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  async function download() {
    if (!(canDownload && filename) || phase === "downloading") {
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const shouldCommit = () => !controller.signal.aborted;
    setPhase("downloading");
    try {
      await downloadPdfReport(
        { identifier: fips, level: "county" },
        governedCountyReportScoreSettings(),
        releaseId.trim(),
        {
          approvedFilename: filename,
          isApprovedServerFilename: (serverName) => serverName === filename,
          shouldCommit,
          signal: controller.signal,
        }
      );
      if (shouldCommit()) {
        setPhase("idle");
      }
    } catch {
      if (shouldCommit()) {
        setPhase("error");
      }
    }
  }

  const describedBy = [
    reason ? hintId : null,
    phase === "error" ? errorId : null,
  ]
    .filter((id): id is string => id !== null)
    .join(" ");

  return (
    <>
      <Button
        {...analyticsControlAttributes("pdf_export")}
        aria-busy={phase === "downloading"}
        aria-describedby={describedBy || undefined}
        data-county={/^\d{5}$/.test(fips) ? fips : undefined}
        data-release={releaseId.trim() || undefined}
        data-state={canDownload ? phase : "disabled"}
        data-testid="explore-download-pdf"
        disabled={!canDownload || phase === "downloading"}
        type="button"
        variant="outline"
        onClick={() => {
          void download();
        }}
      >
        {phase === "downloading" ? "Downloading PDF…" : "Download PDF"}
      </Button>
      {reason ? (
        <p className="type-small" id={hintId}>
          {reason}
        </p>
      ) : null}
      {phase === "error" ? (
        <p className="text-destructive text-sm" id={errorId} role="alert">
          {DOWNLOAD_ERROR}
        </p>
      ) : null}
    </>
  );
}
