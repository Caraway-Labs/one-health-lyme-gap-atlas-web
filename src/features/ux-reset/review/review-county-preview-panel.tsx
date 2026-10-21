"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { Ref } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import {
  CountySummaryActions,
  CountySummaryHeader,
} from "@/features/ux-reset/review/county-summary-card-parts";
import type { ReviewCountyPreviewModel } from "@/features/ux-reset/review/review-county-preview";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import { CountySummarySurveillance } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";

type ReviewCountyPreviewPanelProps = {
  categoryLabel?: string;
  compareHref: string;
  droppedNotes: readonly string[];
  href: string;
  onOpen: (fips: string) => void;
  onViewCountyEvidence?: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  preview: ReviewCountyPreviewModel;
  release: Tier1ActiveRelease;
  releaseId: string;
};

export function ReviewCountyPreviewPanel({
  categoryLabel = "Review category unavailable",
  compareHref,
  droppedNotes,
  href,
  onOpen,
  onViewCountyEvidence,
  openRef,
  preview,
  release,
  releaseId,
}: ReviewCountyPreviewPanelProps) {
  const countyName = preview.countyName.trim() || "Unavailable";
  const stateName = preview.stateName.trim() || "Unavailable";
  const stateCode = preview.stateCode.trim() || "Unavailable";
  const fipsLabel = preview.fips.trim() || "Unavailable";
  const title = `${countyName}, ${stateName}`;
  const pathname = usePathname() ?? ATLAS_EXPLORER_PATH;
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const askHref = resetAskAtlasWorkspaceHref(pathname, searchParams);
  return (
    <Card
      aria-label={`County preview for ${title}`}
      className="ux-reset-review-preview gap-0 py-0"
      data-availability={preview.availability}
      data-caveat={preview.caveat}
      data-fips={preview.fips}
      data-follow-up={preview.followUp}
      data-target={href}
      data-testid="review-county-preview"
      data-why={preview.why}
      role="region"
    >
      <CountySummaryHeader
        county={countyName}
        fips={fipsLabel}
        fipsTestId="review-preview-identity"
        stateCode={stateCode}
        stateName={stateName}
      />
      <p
        className="county-summary-category"
        data-testid="review-preview-category"
      >
        <Badge variant="secondary">{categoryLabel}</Badge>
      </p>{" "}
      {/^\d{5}$/.test(preview.fips) ? (
        <CountySummarySurveillance fips={preview.fips} release={release} />
      ) : null}
      <p className="type-body" data-testid="review-preview-why">
        {preview.why}
      </p>
      <details className="ux-reset-explorer-score">
        <summary>Score and methodology</summary>
        {preview.reasonCodes.length > 0 ? (
          <div data-testid="review-reason-codes">
            <p className="type-small">Review reason codes</p>
            <ul>
              {preview.reasonCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {preview.observedBasis ? (
          <p className="type-body" data-testid="review-observed-basis">
            {preview.observedBasis}
          </p>
        ) : null}
        {preview.qualification ? (
          <div data-testid="review-preview-qualification">
            <EvidenceStateStrip
              model={preview.qualification}
              showCaveat={false}
              showReason={Boolean(preview.qualification.reasonCode)}
            />
            {preview.qualification.reasonCode ? (
              <EvidenceProvenanceInspect
                availability={preview.qualification.availability}
                provenance={preview.qualification.provenance}
                reasonCode={preview.qualification.reasonCode}
                showLimitations={false}
              />
            ) : (
              <EvidenceProvenanceInspect
                provenance={preview.qualification.provenance}
                showLimitations={false}
                stateLabel={evidenceAvailabilityLabel(
                  preview.qualification.availability
                )}
              />
            )}
          </div>
        ) : null}
        <p className="type-body" data-testid="review-preview-follow-up">
          <span className="eyebrow">
            {preview.followUpLabel ?? "Suggested follow-up"}
          </span>{" "}
          {preview.followUp}
        </p>
      </details>
      {droppedNotes.length > 0 ? (
        <ul data-testid="review-preview-dropped">
          {droppedNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <CountySummaryActions
        askHref={askHref}
        compareHref={compareHref}
        countyName={preview.countyName}
        evidenceHref={href}
        fips={preview.fips}
        openRef={openRef}
        releaseId={releaseId}
        stateCode={preview.stateCode}
        onOpen={onOpen}
        onViewCountyEvidence={onViewCountyEvidence}
      />
    </Card>
  );
}
