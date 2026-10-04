"use client";

import {
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import { releaseEvidenceLoadStateValues } from "@/features/ux-reset/evidence/types";
import type { AtlasMetadata } from "@/generated/models";

type ReviewReleaseEvidenceProps = {
  errorMessage?: string | null;
  isError: boolean;
  isLoading: boolean;
  metadata: AtlasMetadata | undefined;
};

export function ReviewReleaseEvidence({
  errorMessage = null,
  isError,
  isLoading,
  metadata,
}: ReviewReleaseEvidenceProps) {
  const loadState = isError
    ? releaseEvidenceLoadStateValues.error
    : isLoading
      ? releaseEvidenceLoadStateValues.loading
      : releaseEvidenceLoadStateValues.ready;

  const context = metadata
    ? releaseEvidenceContextFromMetadata(metadata)
    : null;

  return (
    <ReleaseEvidenceStateStrip
      context={context}
      errorMessage={errorMessage}
      loadState={loadState}
    />
  );
}
