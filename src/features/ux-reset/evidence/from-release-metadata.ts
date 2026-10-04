import type { AtlasMetadata } from "@/generated/models";
import {
  describeMethodologyVersion,
  describeReleaseAssembly,
  formatEvidenceScope,
  summarizeSourceVintages,
} from "@/lib/atlas-evidence-metadata";

import {
  evidenceAvailabilityValues,
  type EvidenceAvailability,
  type ReleaseEvidenceContextModel,
} from "./types";

export function releaseEvidenceAvailabilityFromMetadata(
  metadata: AtlasMetadata
): EvidenceAvailability {
  const hasRelease = Boolean(metadata.release_id?.trim());
  const hasScope = Boolean(metadata.scope?.trim());
  const hasMethodology = Boolean(metadata.methodology_version?.trim());
  const hasSources = metadata.sources.length > 0;

  if (!(hasRelease && hasScope && hasMethodology && hasSources)) {
    return evidenceAvailabilityValues.unavailable;
  }
  return evidenceAvailabilityValues.available;
}

export function releaseEvidenceContextFromMetadata(
  metadata: AtlasMetadata
): ReleaseEvidenceContextModel {
  return {
    availability: releaseEvidenceAvailabilityFromMetadata(metadata),
    evidenceScope: formatEvidenceScope(metadata.scope),
    limitation: metadata.limitations?.trim() || null,
    methodologyLabel: describeMethodologyVersion(metadata.methodology_version),
    releaseSummary: describeReleaseAssembly(metadata.release_id),
    sourcePeriods: summarizeSourceVintages(metadata.sources),
  };
}
