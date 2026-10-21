"use client";

import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  icon,
  releaseId,
  stateCode,
}: {
  countyName: string;
  fips: string;
  /** Renders an icon-only button. The accessible name stays "Download PDF". */
  icon?: ReactNode;
  releaseId: string;
  stateCode: string;
}) {
  return (
    <DownloadCountyPdfForSelection
      key={`${fips}\u0000${releaseId}\u0000${countyName}\u0000${stateCode}`}
      countyName={countyName}
      fips={fips}
      icon={icon}
      releaseId={releaseId}
      stateCode={stateCode}
    />
  );
}

export type CountyPdfDownload = {
  canDownload: boolean;
  download: () => Promise<void>;
  phase: DownloadPhase;
  reason: string | null;
};

/**
 * Published county report for one selected FIPS and release. The owner must be
 * keyed by the selection so a new county cancels the previous file. What-if
 * display settings are not sent. The server renders the PDF.
 */
export function useCountyPdfDownload({
  countyName,
  fips,
  releaseId,
  stateCode,
}: {
  countyName: string;
  fips: string;
  releaseId: string;
  stateCode: string;
}): CountyPdfDownload {
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

  return { canDownload, download, phase, reason };
}

function DownloadCountyPdfForSelection({
  countyName,
  fips,
  icon,
  releaseId,
  stateCode,
}: {
  countyName: string;
  fips: string;
  icon?: ReactNode;
  releaseId: string;
  stateCode: string;
}) {
  const hintId = useId();
  const errorId = useId();
  const { canDownload, download, phase, reason } = useCountyPdfDownload({
    countyName,
    fips,
    releaseId,
    stateCode,
  });
  const describedBy = [
    reason ? hintId : null,
    phase === "error" ? errorId : null,
  ]
    .filter((id): id is string => id !== null)
    .join(" ");

  const label = phase === "downloading" ? "Downloading PDF…" : "Download PDF";
  const buttonProps = {
    "aria-busy": phase === "downloading",
    "aria-describedby": describedBy || undefined,
    "data-county": /^\d{5}$/.test(fips) ? fips : undefined,
    "data-release": releaseId.trim() || undefined,
    "data-state": canDownload ? phase : "disabled",
    "data-testid": "explore-download-pdf",
    disabled: !(canDownload && phase !== "downloading"),
    type: "button",
    variant: "outline",
  } as const;
  const onClick = () => {
    void download();
  };

  return (
    <>
      {icon ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                {...buttonProps}
                aria-label={label}
                size="icon"
                onClick={onClick}
              />
            }
          >
            {icon}
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        <Button {...buttonProps} onClick={onClick}>
          {label}
        </Button>
      )}
      {reason && !icon ? (
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
