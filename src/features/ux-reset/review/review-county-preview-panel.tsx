"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Ref } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { askAtlasEntryHref } from "@/features/ux-reset/ask-atlas/page-reference";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import type { ReviewCountyPreviewModel } from "@/features/ux-reset/review/review-county-preview";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { Tier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";
import { cn } from "@/lib/utils";

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
}: ReviewCountyPreviewPanelProps) {
  const countyName = preview.countyName.trim() || "Unavailable";
  const stateName = preview.stateName.trim() || "Unavailable";
  const stateCode = preview.stateCode.trim() || "Unavailable";
  const fipsLabel = preview.fips.trim() || "Unavailable";
  const title = `${countyName}, ${stateName}`;
  const pathname = usePathname() ?? ATLAS_EXPLORER_PATH;
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const askContext = useAskAtlasInheritedContext();
  const askHref = askAtlasEntryHref({
    context: askContext,
    pathname,
    searchParams,
  });
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
      <p className="eyebrow">Selected county</p>
      <h2 className="type-card">{title}</h2>
      <p className="type-body" data-testid="review-preview-category">
        {categoryLabel}
      </p>
      <p className="type-body" data-testid="review-preview-identity">
        FIPS {fipsLabel} · {stateCode}
      </p>
      <p className="type-body" data-testid="review-preview-why">
        {preview.why}
      </p>
      <p className="type-small" data-testid="review-preview-guardrail">
        Review priority is not a diagnosis, an individual risk estimate, or an
        outbreak status.
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
              showReason={Boolean(preview.qualification.reasonCode)}
            />
            {preview.qualification.reasonCode ? (
              <EvidenceProvenanceInspect
                availability={preview.qualification.availability}
                provenance={preview.qualification.provenance}
                reasonCode={preview.qualification.reasonCode}
              />
            ) : (
              <EvidenceProvenanceInspect
                provenance={preview.qualification.provenance}
                stateLabel={evidenceAvailabilityLabel(
                  preview.qualification.availability
                )}
              />
            )}
          </div>
        ) : null}
        <Tier1SurveillancePriority
          fips={preview.fips}
          headingLevel="h3"
          release={release}
        />
        <p className="type-body" data-testid="review-preview-follow-up">
          <span className="eyebrow">
            {preview.followUpLabel ?? "Suggested follow-up"}
          </span>{" "}
          {preview.followUp}
        </p>
        <p className="type-small">
          A priority score is not a disease-risk estimate. Unavailable is not
          zero.
        </p>
      </details>
      {droppedNotes.length > 0 ? (
        <ul data-testid="review-preview-dropped">
          {droppedNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <div className="ux-reset-review-preview-actions">
        {onViewCountyEvidence ? (
          <Button
            data-county={preview.fips}
            data-testid="review-view-county-evidence"
            type="button"
            onClick={() => {
              onViewCountyEvidence(preview.fips);
            }}
          >
            View county evidence
          </Button>
        ) : null}
        <Link
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "ux-reset-review-open"
          )}
          data-county={preview.fips}
          data-testid="review-investigate"
          data-variant="secondary"
          href={href}
          onClick={() => {
            onOpen(preview.fips);
          }}
        >
          County evidence
        </Link>
        <Link
          ref={openRef}
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "ux-reset-review-open"
          )}
          data-county={preview.fips}
          data-testid="review-compare"
          data-variant="secondary"
          href={compareHref}
          onClick={() => {
            onOpen(preview.fips);
          }}
        >
          Compare this county
        </Link>
        <Link
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "ux-reset-review-open"
          )}
          data-testid="review-ask-atlas"
          href={askHref}
        >
          Ask Atlas
        </Link>
      </div>
    </Card>
  );
}
