"use client";

import type { ContentSurface } from "@/lib/atlas-analytics";
import { trackProvenanceOpened } from "@/lib/atlas-analytics";
import { getDocsPageHref } from "@/lib/docs-config";
import { cn } from "@/lib/utils";

import {
  evidenceInspectFreshness,
  evidenceInspectMethod,
  evidenceInspectState,
} from "./from-observation";
import type {
  EvidenceAvailability,
  EvidenceProvenanceModel,
  EvidenceReasonCode,
} from "./types";

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
  availability: EvidenceAvailability;
  className?: string;
  contentSurface?: ContentSurface;
  provenance: EvidenceProvenanceModel;
  reasonCode: EvidenceReasonCode;
};

export function EvidenceProvenanceInspect({
  availability,
  className,
  contentSurface = "source_card",
  provenance,
  reasonCode,
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
  const sourceUrl = provenance.sourceUrl?.trim() || null;
  const referenceLines = provenance.referenceLines ?? [];

  return (
    <details
      className={cn("ux-reset-evidence-provenance", className)}
      data-testid="evidence-provenance-inspect"
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
        <dl className="ux-reset-evidence-provenance-fields">
          <div data-testid="evidence-provenance-source">
            <dt>Source</dt>
            <dd>
              {provenance.sourceFamily}
              {sourceUrl ? (
                <p>
                  <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
                    Open source reference ↗
                  </a>
                </p>
              ) : null}
            </dd>
          </div>
          <div data-testid="evidence-provenance-period">
            <dt>Period</dt>
            <dd>{provenance.observationPeriod}</dd>
          </div>
          <div data-testid="evidence-provenance-freshness">
            <dt>Availability / freshness</dt>
            <dd>{evidenceInspectFreshness(provenance)}</dd>
          </div>
          <div data-testid="evidence-provenance-method">
            <dt>Method</dt>
            <dd>{evidenceInspectMethod(provenance)}</dd>
          </div>
          <div data-testid="evidence-provenance-state">
            <dt>Evidence state</dt>
            <dd>{evidenceInspectState(availability, reasonCode)}</dd>
          </div>
        </dl>
        {referenceLines.length > 0 ? (
          <div data-testid="evidence-provenance-references">
            <p className="type-small">Evidence references</p>
            <ul className="ux-reset-evidence-limitations">
              {referenceLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div data-testid="evidence-provenance-limitations">
          <p className="type-small">Governed limitations</p>
          {provenance.limitations.length > 0 ? (
            <ul className="ux-reset-evidence-limitations">
              {provenance.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : (
            <p>No governed limitations were returned.</p>
          )}
        </div>
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
