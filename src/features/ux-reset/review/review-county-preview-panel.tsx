"use client";

import Link from "next/link";
import type { Ref } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ReviewCountyPreviewModel } from "@/features/ux-reset/review/review-county-preview";
import { cn } from "@/lib/utils";

type ReviewCountyPreviewPanelProps = {
  droppedNotes: readonly string[];
  href: string;
  onOpen: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  preview: ReviewCountyPreviewModel;
};

export function ReviewCountyPreviewPanel({
  droppedNotes,
  href,
  onOpen,
  openRef,
  preview,
}: ReviewCountyPreviewPanelProps) {
  const title = `${preview.countyName}, ${preview.stateName}`;
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
      <AtlasSectionHeader
        className="card-title-row"
        eyebrow="County preview"
        headingLevel="h2"
        title={title}
      />
      <p className="type-body" data-testid="review-preview-identity">
        FIPS {preview.fips} · {preview.stateCode}
      </p>
      <p className="type-body" data-testid="review-preview-why">
        {preview.why}
      </p>
      <p className="type-body" data-testid="review-preview-follow-up">
        <span className="eyebrow">Suggested follow-up</span> {preview.followUp}
      </p>
      <p className="type-small" data-testid="review-preview-guardrail">
        Review priority is not a diagnosis, an individual risk estimate, or an
        outbreak status.
      </p>
      {droppedNotes.length > 0 ? (
        <ul data-testid="review-preview-dropped">
          {droppedNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <Link
        ref={openRef}
        className={cn(buttonVariants(), "ux-reset-review-open")}
        data-county={preview.fips}
        data-testid="review-investigate"
        data-variant="primary"
        href={href}
        onClick={() => {
          onOpen(preview.fips);
        }}
      >
        Open Investigate
      </Link>
    </Card>
  );
}
