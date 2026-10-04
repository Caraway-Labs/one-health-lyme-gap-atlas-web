import type { AtlasMetadata } from "@/generated/models";
import {
  describeMethodologyVersion,
  describeReleaseAssembly,
  formatEvidenceScope,
  summarizeSourceVintages,
} from "@/lib/atlas-evidence-metadata";

import type { ReleaseEvidenceContextModel } from "./types";

export function releaseEvidenceContextFromMetadata(
  metadata: AtlasMetadata
): ReleaseEvidenceContextModel {
  return {
    evidenceScope: formatEvidenceScope(metadata.scope),
    limitation: metadata.limitations?.trim() || null,
    methodologyLabel: describeMethodologyVersion(metadata.methodology_version),
    releaseSummary: describeReleaseAssembly(metadata.release_id),
    sourcePeriods: summarizeSourceVintages(metadata.sources),
  };
}
