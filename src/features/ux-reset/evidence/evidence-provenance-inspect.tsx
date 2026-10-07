"use client";

import type { ContentSurface } from "@/lib/atlas-analytics";
import { trackProvenanceOpened } from "@/lib/atlas-analytics";
import { getDocsPageHref } from "@/lib/docs-config";
import { cn } from "@/lib/utils";

import type { EvidenceProvenanceModel } from "./types";

import "./evidence-contract.css";

const EVIDENCE_DOCS_HREF = getDocsPageHref("evidence-and-uncertainty");
const UNAVAILABLE = "Unavailable";

function evaluatedAtText(
  display: string | null | undefined,
  raw: string | null | undefined
): string | null {
  if (display === undefined && raw === undefined) {
    return null;
  }
  const readable = display?.trim() || UNAVAILABLE;
  const timestamp = raw?.trim() || UNAVAILABLE;
  if (readable === UNAVAILABLE && timestamp === UNAVAILABLE) {
    return UNAVAILABLE;
  }
  if (timestamp === UNAVAILABLE || timestamp === readable) {
    return readable;
  }
  if (readable === UNAVAILABLE) {
    return timestamp;
  }
  return `${readable} (${timestamp})`;
}

function configurationText(value: string | null | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value?.trim() ?? "";
  return trimmed || UNAVAILABLE;
}

type EvidenceProvenanceInspectProps = {
  className?: string;
  contentSurface?: ContentSurface;
  provenance: EvidenceProvenanceModel;
};

export function EvidenceProvenanceInspect({
  className,
  contentSurface = "source_card",
  provenance,
}: EvidenceProvenanceInspectProps) {
  const technical = provenance.technical;
  const evaluatedAt = technical
    ? evaluatedAtText(technical.evaluatedAt, technical.evaluatedAtRaw)
    : null;
  const configuration = technical
    ? configurationText(technical.configurationSha256)
    : null;
  const evaluatedAtRaw = technical?.evaluatedAtRaw?.trim() ?? "";
  const evaluatedAtIsTimestamp =
    evaluatedAt !== null &&
    evaluatedAt !== UNAVAILABLE &&
    evaluatedAtRaw !== "" &&
    evaluatedAtRaw !== UNAVAILABLE;

  return (
    <details
      className={cn("ux-reset-evidence-provenance", className)}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          trackProvenanceOpened(
            globalThis.location?.pathname ?? "/",
            contentSurface
          );
        }
      }}
    >
      <summary>Inspect provenance</summary>
      <div className="ux-reset-evidence-provenance-body">
        <p>{provenance.inspectSummary}</p>
        {provenance.datasetVintage ? (
          <p className="type-small">
            Dataset vintage: {provenance.datasetVintage}
          </p>
        ) : null}
        {provenance.limitations.length > 0 ? (
          <div>
            <p className="type-small">Governed limitations</p>
            <ul className="ux-reset-evidence-limitations">
              {provenance.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {provenance.sourceUrl ? (
          <p>
            <a
              href={provenance.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open source reference ↗
            </a>
          </p>
        ) : null}
        {technical ? (
          <details className="ux-reset-evidence-provenance-technical">
            <summary>Technical reproducibility identifiers</summary>
            <dl>
              {technical.observationId ? (
                <div>
                  <dt>Observation ID</dt>
                  <dd>{technical.observationId}</dd>
                </div>
              ) : null}
              {technical.provenanceRef ? (
                <div>
                  <dt>Provenance reference</dt>
                  <dd>{technical.provenanceRef}</dd>
                </div>
              ) : null}
              {technical.releaseId ? (
                <div>
                  <dt>Release ID</dt>
                  <dd>{technical.releaseId}</dd>
                </div>
              ) : null}
              {technical.methodologyVersion ? (
                <div>
                  <dt>Methodology version</dt>
                  <dd>{technical.methodologyVersion}</dd>
                </div>
              ) : null}
              {evaluatedAt ? (
                <div>
                  <dt>Evaluated at</dt>
                  <dd>
                    {evaluatedAtIsTimestamp ? (
                      <time dateTime={evaluatedAtRaw}>{evaluatedAt}</time>
                    ) : (
                      evaluatedAt
                    )}
                  </dd>
                </div>
              ) : null}
              {configuration ? (
                <div>
                  <dt>Configuration</dt>
                  <dd>{configuration}</dd>
                </div>
              ) : null}
            </dl>
            <p className="type-small">
              Full lineage and reproducibility guidance live in{" "}
              <a
                href={EVIDENCE_DOCS_HREF}
                rel="noopener noreferrer"
                target="_blank"
              >
                Atlas documentation ↗
              </a>
              , not in the default evidence view.
            </p>
          </details>
        ) : (
          <p className="type-small">
            <a
              href={EVIDENCE_DOCS_HREF}
              rel="noopener noreferrer"
              target="_blank"
            >
              Read evidence and provenance in Atlas documentation ↗
            </a>
          </p>
        )}
      </div>
    </details>
  );
}
