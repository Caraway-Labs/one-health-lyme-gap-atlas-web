import { RESET_DATA_PROVENANCE_PATH } from "@/features/ux-reset/routes";
import type { Indicator, Measure, Source } from "@/generated/models";

/**
 * Governed indicator domain tokens already used for county evidence.
 * A blank or unknown domain is not mapped onto an indicator id.
 */
const DOMAIN_HUMAN = "human";
const DOMAIN_VECTOR = "vector";
const DOMAIN_PATHOGEN = "pathogen";
const DOMAIN_ENVIRONMENTAL = "environmental";
const DOMAIN_POPULATION = "population";

export const PROVENANCE_FAMILY_IDS = [
  "human-surveillance",
  "ticks-and-pathogens",
  "environment",
  "population-context",
] as const;

export type ProvenanceFamilyId = (typeof PROVENANCE_FAMILY_IDS)[number];

export const PROVENANCE_PIPELINE_IDS = [
  "source",
  "validate",
  "transform",
  "release",
  "explore",
] as const;

export type ProvenancePipelineId = (typeof PROVENANCE_PIPELINE_IDS)[number];

const FAMILY_DEFINITIONS: readonly {
  domains: readonly string[];
  id: ProvenanceFamilyId;
  label: string;
}[] = [
  {
    domains: [DOMAIN_HUMAN],
    id: "human-surveillance",
    label: "Human surveillance",
  },
  {
    domains: [DOMAIN_VECTOR, DOMAIN_PATHOGEN],
    id: "ticks-and-pathogens",
    label: "Ticks and pathogens",
  },
  {
    domains: [DOMAIN_ENVIRONMENTAL],
    id: "environment",
    label: "Environment",
  },
  {
    domains: [DOMAIN_POPULATION],
    id: "population-context",
    label: "Population context",
  },
];

export type ProvenanceMeasureReference = {
  definition: string | null;
  geographySemantics: string | null;
  geographyTypes: readonly string[];
  label: string;
  limitations: readonly string[];
  measureId: string;
  measureType: string | null;
  methodology: string | null;
  methodologyId: string | null;
  missingnessSemantics: string | null;
  temporalGrains: readonly string[];
  temporalSemantics: string | null;
};

export type ProvenanceSourceCard = {
  anchorId: string;
  atlasAcquiredAt: string | null;
  datasetId: string;
  domains: readonly string[];
  familyIds: readonly ProvenanceFamilyId[];
  label: string;
  limitations: readonly string[];
  lineageSourceId: string;
  measures: readonly ProvenanceMeasureReference[];
  primaryFamilyId: ProvenanceFamilyId | null;
  publishedAt: string | null;
  publisher: string | null;
  releaseVersion: string;
  semanticVersion: string;
  sourceId: string;
  sourceRetrievedAt: string | null;
  sourceUrl: string | null;
  sourceVersion: string | null;
  sourceVintage: string | null;
  unclassifiedDomains: readonly string[];
  upstreamUpdatedAt: string | null;
};

export type ProvenanceFamilyGroup = {
  entries: readonly ProvenanceFamilyEntry[];
  id: ProvenanceFamilyId;
  label: string;
};

export type ProvenanceFamilyEntry =
  | { card: ProvenanceSourceCard; kind: "card" }
  | {
      card: ProvenanceSourceCard;
      kind: "cross-link";
      primaryLabel: string;
    };

export const COLLECTION_READS = [
  "complete",
  "incomplete",
  "unavailable",
] as const;

export type CollectionRead = (typeof COLLECTION_READS)[number];

export type DataProvenanceCatalog = {
  families: readonly ProvenanceFamilyGroup[];
  indicatorsRead: CollectionRead;
  measuresRead: CollectionRead;
  other: readonly ProvenanceSourceCard[];
  sources: readonly ProvenanceSourceCard[];
  sourcesIncomplete: boolean;
};

export type DataProvenanceCatalogInput = {
  indicators: readonly Indicator[];
  indicatorsRead: CollectionRead;
  measures: readonly Measure[];
  measuresRead: CollectionRead;
  sources: readonly Source[];
  sourcesIncomplete: boolean;
};

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

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text || null;
}

function safeHttpUrl(value: string | null | undefined): string | null {
  const text = trimmed(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function familyIdForDomain(domain: string): ProvenanceFamilyId | null {
  const match = FAMILY_DEFINITIONS.find((family) =>
    family.domains.includes(domain)
  );
  return match?.id ?? null;
}

function familyLabel(id: ProvenanceFamilyId): string {
  const match = FAMILY_DEFINITIONS.find((family) => family.id === id);
  if (!match) {
    return id;
  }
  return match.label;
}

function compareLabels(
  left: ProvenanceSourceCard,
  right: ProvenanceSourceCard
): number {
  const byLabel = left.label.localeCompare(right.label);
  if (byLabel !== 0) {
    return byLabel;
  }
  return left.sourceId.localeCompare(right.sourceId);
}

function measureReference(measure: Measure): ProvenanceMeasureReference {
  return {
    definition: trimmed(measure.definition),
    geographySemantics: trimmed(measure.geography_semantics),
    geographyTypes: measure.geography_types ?? [],
    label: measure.label,
    limitations: measure.limitations ?? [],
    measureId: measure.measure_id,
    measureType: trimmed(measure.measure_type),
    methodology: trimmed(measure.methodology),
    methodologyId: trimmed(measure.methodology_id),
    missingnessSemantics: trimmed(measure.missingness_semantics),
    temporalGrains: measure.temporal_grains ?? [],
    temporalSemantics: trimmed(measure.temporal_semantics),
  };
}

function sourceCard(
  source: Source,
  measures: readonly ProvenanceMeasureReference[],
  domains: readonly string[]
): ProvenanceSourceCard {
  const familyIds: ProvenanceFamilyId[] = [];
  const unclassifiedDomains: string[] = [];
  for (const domain of domains) {
    const familyId = familyIdForDomain(domain);
    if (!familyId) {
      unclassifiedDomains.push(domain);
      continue;
    }
    if (!familyIds.includes(familyId)) {
      familyIds.push(familyId);
    }
  }
  const orderedFamilyIds = PROVENANCE_FAMILY_IDS.filter((id) =>
    familyIds.includes(id)
  );
  return {
    anchorId: dataProvenanceSourceAnchor(source.source_id),
    atlasAcquiredAt: trimmed(source.atlas_acquired_at),
    datasetId: source.dataset_id,
    domains,
    familyIds: orderedFamilyIds,
    label: source.label,
    limitations: source.limitations ?? [],
    lineageSourceId: source.lineage_source_id,
    measures,
    primaryFamilyId: orderedFamilyIds[0] ?? null,
    publishedAt: trimmed(source.published_at),
    publisher: trimmed(source.publisher),
    releaseVersion: source.release_version,
    semanticVersion: source.semantic_version,
    sourceId: source.source_id,
    sourceRetrievedAt: trimmed(source.source_retrieved_at),
    sourceUrl: safeHttpUrl(source.source_url),
    sourceVersion: trimmed(source.source_version),
    sourceVintage: trimmed(source.source_vintage),
    unclassifiedDomains,
    upstreamUpdatedAt: trimmed(source.upstream_updated_at),
  };
}

/**
 * Group released sources by governed indicator domains reached through
 * `measure.source_ids`. Domains that are blank stay ungrouped. Unknown
 * tokens stay visible and are not renamed into a planned family.
 */
export function buildDataProvenanceCatalog(
  input: DataProvenanceCatalogInput
): DataProvenanceCatalog {
  const domainsByIndicator = new Map<string, string | null>();
  for (const indicator of input.indicators) {
    if (!domainsByIndicator.has(indicator.indicator_id)) {
      domainsByIndicator.set(indicator.indicator_id, trimmed(indicator.domain));
    }
  }

  const measuresBySource = new Map<string, ProvenanceMeasureReference[]>();
  const domainsBySource = new Map<string, string[]>();
  for (const measure of input.measures) {
    const sourceIds = measure.source_ids ?? [];
    const reference = measureReference(measure);
    const domain = domainsByIndicator.get(measure.indicator_id) ?? null;
    for (const sourceId of sourceIds) {
      const measures = measuresBySource.get(sourceId) ?? [];
      measures.push(reference);
      measuresBySource.set(sourceId, measures);
      if (!domain) {
        continue;
      }
      const domains = domainsBySource.get(sourceId) ?? [];
      if (!domains.includes(domain)) {
        domains.push(domain);
      }
      domainsBySource.set(sourceId, domains);
    }
  }

  const seen = new Set<string>();
  const sources: ProvenanceSourceCard[] = [];
  for (const source of input.sources) {
    if (seen.has(source.source_id)) {
      continue;
    }
    seen.add(source.source_id);
    const measures = [...(measuresBySource.get(source.source_id) ?? [])].sort(
      (left, right) => left.label.localeCompare(right.label)
    );
    const domains = [...(domainsBySource.get(source.source_id) ?? [])].sort();
    sources.push(sourceCard(source, measures, domains));
  }
  sources.sort(compareLabels);

  const families = FAMILY_DEFINITIONS.map((family) => {
    const members = sources.filter((card) =>
      card.familyIds.includes(family.id)
    );
    const entries: ProvenanceFamilyEntry[] = members.map((card) => {
      if (card.primaryFamilyId === family.id) {
        return { card, kind: "card" };
      }
      return {
        card,
        kind: "cross-link",
        primaryLabel: card.primaryFamilyId
          ? familyLabel(card.primaryFamilyId)
          : family.label,
      };
    });
    return { entries, id: family.id, label: family.label };
  }).filter((family) => family.entries.length > 0);

  const other = sources.filter((card) => card.primaryFamilyId === null);

  return {
    families,
    indicatorsRead: input.indicatorsRead,
    measuresRead: input.measuresRead,
    other,
    sources,
    sourcesIncomplete: input.sourcesIncomplete,
  };
}
