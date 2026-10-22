import { RESET_DATA_PROVENANCE_PATH } from "@/features/ux-reset/routes";

const SOURCE_ANCHOR_PREFIX = "source-";

export function dataProvenanceSourceAnchor(sourceId: string): string {
  return `${SOURCE_ANCHOR_PREFIX}${encodeURIComponent(sourceId)}`;
}

export function dataProvenanceHref(sourceId?: string | null): string {
  const id = sourceId?.trim() ?? "";
  if (!id) {
    return RESET_DATA_PROVENANCE_PATH;
  }
  return `${RESET_DATA_PROVENANCE_PATH}#${dataProvenanceSourceAnchor(id)}`;
}

export function sourceIdFromProvenanceHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(SOURCE_ANCHOR_PREFIX)) {
    return null;
  }
  const encoded = raw.slice(SOURCE_ANCHOR_PREFIX.length);
  if (!encoded) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(encoded).trim();
    return decoded || null;
  } catch {
    return null;
  }
}
