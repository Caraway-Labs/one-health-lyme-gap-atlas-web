import { evidenceTypeFromGovernedMetadata } from "@/features/ux-reset/evidence/evidence-type";
import {
  evidenceAvailabilityValues,
  type EvidenceAvailability,
  type EvidenceObjectModel,
  type EvidenceProvenanceModel,
  type EvidenceReasonCode,
} from "@/features/ux-reset/evidence/types";
import {
  availabilityFromGovernedValueState,
  evidenceReasonLabel,
  formatGovernedEvidenceValue,
  hasGovernedMaterialLimitations,
  materialCaveatShort,
  normalizeGovernedLimitations,
  reasonCodeForEvidence,
} from "@/features/ux-reset/evidence/value-state-contract";
import type { InvestigateEvidenceFamilyId } from "@/features/ux-reset/investigate/county-evidence";
import {
  EnvironmentalContextCoverageStatus,
  ValueState,
  type CountyDetail,
  type EnvironmentalContext,
  type Measure,
  type SourceMetadata,
} from "@/generated/models";

const ABSENT_PUBLISHED_STATUSES = new Set([
  "",
  "missing",
  "no records",
  "no_county_linked_record",
  "unavailable",
]);

export type PublishedCountyRecord = {
  burgdorferiStatus: string;
  evidenceCompleteness: number;
  fips: string;
  pacificusStatus: string | null;
  population: number | null;
  releaseId: string;
  releaseLimitation: string;
  rucc: number | null;
  scapularisStatus: string | null;
  sources: readonly SourceMetadata[];
  stateUnallocatedRecords: number | null;
  sviPercentile: number | null;
  tickStatus: string;
  uninsuredPercent: number | null;
};

/**
 * Derived state for one published or coverage row. The card, the uncertainty
 * summary, and the gap list all read this instead of re-deciding from
 * provenance text.
 */
export type GovernedPublishedState = {
  availability: EvidenceAvailability;
  /** Status gap the list must not drop: unavailable sentence, suppressed reason, or first caveat. */
  gapLine: string | null;
  /** Every gap line for this row, including source notes and the status gap. */
  gapLines: readonly string[];
  inspectTarget: string | null;
  limitationText: string | null;
  limitations: readonly string[];
  reasonCode: EvidenceReasonCode;
  valueState: ValueState;
};

export type PublishedRowSubject =
  | { kind: "coverage"; status: EnvironmentalContext["coverage_status"] }
  | { kind: "numeric"; value: number }
  | { kind: "status"; status: string };

export type PublishedHierarchyRow = {
  evidence: EvidenceObjectModel;
  familyId: InvestigateEvidenceFamilyId;
  measureId: string;
  state: GovernedPublishedState;
};

export type EnvironmentalCoverageContext = {
  context: EnvironmentalContext;
  measureId: string;
  measureLabel: string;
  observationId: string;
  /** Governed provenance from the parent observation. Coverage does not replace it. */
  provenance: EvidenceProvenanceModel;
};

export type EnvironmentalCoverageRow = {
  coverageStatus: EnvironmentalContext["coverage_status"];
  evidence: EvidenceObjectModel;
  measureId: string;
  observationId: string;
  state: GovernedPublishedState;
};

export function publishedRowAnchor(measureId: string): string {
  return `investigate-published-${measureId}`;
}

export function coverageRowAnchor(observationId: string): string {
  return `investigate-coverage-${observationId}`;
}

export type PublishedCountyHierarchy = {
  completeness: number;
  gaps: readonly string[];
  releaseLimitation: string;
  rows: readonly PublishedHierarchyRow[];
};

type PublishedField = {
  claimLabel: string;
  /** Preformatted display. When set, the measure unit is not appended. */
  displayValue: string | null;
  familyId: InvestigateEvidenceFamilyId;
  gapLabel: string;
  measureId: string;
  sourceKey: string;
  status: string | null;
  unit: string | null;
  value: number | string | null;
};

/** Drops score, priority, and color. Those are not Investigate evidence. */
export function publishedCountyRecordFromDetail(
  detail: CountyDetail
): PublishedCountyRecord {
  return {
    burgdorferiStatus: detail.burgdorferi_status,
    evidenceCompleteness: detail.evidence_completeness,
    fips: detail.fips,
    pacificusStatus: detail.pacificus_status,
    population: detail.population,
    releaseId: detail.release.release_id,
    releaseLimitation: detail.release.limitations.trim(),
    rucc: detail.rucc_2023,
    scapularisStatus: detail.scapularis_status,
    sources: detail.release.sources,
    stateUnallocatedRecords: detail.state_unallocated_records_2023,
    sviPercentile: detail.svi_percentile,
    tickStatus: detail.tick_status,
    uninsuredPercent: detail.uninsured_percent,
  };
}

function sourceForKey(
  sources: readonly SourceMetadata[],
  key: string
): SourceMetadata | null {
  return sources.find((source) => source.key === key) ?? null;
}

function measureForId(
  measures: readonly Measure[],
  measureId: string
): Measure | undefined {
  return measures.find((measure) => measure.measure_id === measureId);
}

const NO_ADDED_LIMITATIONS: readonly string[] = [];

function statusValueState(status: string): ValueState {
  const normalized = status.trim().toLowerCase();
  if (normalized === "unknown") {
    return ValueState.UNAVAILABLE;
  }
  if (normalized === "no records" || normalized === "no_county_linked_record") {
    return ValueState.NO_COUNTY_LINKED_RECORD;
  }
  if (normalized === "missing") {
    return ValueState.MISSING;
  }
  if (normalized === ValueState.SUPPRESSED.toLowerCase()) {
    return ValueState.SUPPRESSED;
  }
  if (ABSENT_PUBLISHED_STATUSES.has(normalized)) {
    return ValueState.UNAVAILABLE;
  }
  return ValueState.OBSERVED;
}

function numericValueState(value: number): ValueState {
  return value === 0 ? ValueState.ZERO : ValueState.OBSERVED;
}

function subjectSeed(subject: PublishedRowSubject): {
  limitations: readonly string[];
  valueState: ValueState;
} {
  switch (subject.kind) {
    case "numeric": {
      return {
        limitations: NO_ADDED_LIMITATIONS,
        valueState: numericValueState(subject.value),
      };
    }
    case "status": {
      return {
        limitations: NO_ADDED_LIMITATIONS,
        valueState: statusValueState(subject.status),
      };
    }
    case "coverage": {
      return coveragePresentation(subject.status);
    }
    default: {
      const exhaustive: never = subject;
      return exhaustive;
    }
  }
}

function mergedLimitations(
  inherited: readonly string[],
  added: readonly string[]
): string[] {
  const base = normalizeGovernedLimitations(inherited);
  const extra = normalizeGovernedLimitations(added).filter(
    (line) => !base.includes(line)
  );
  return [...base, ...extra];
}

function limitationTextForRow(input: {
  limitations: readonly string[];
  reasonCode: EvidenceReasonCode;
}): string | null {
  const caveat = materialCaveatShort(input.limitations);
  if (caveat) {
    return caveat;
  }
  if (input.reasonCode === ValueState.SUPPRESSED) {
    return evidenceReasonLabel(ValueState.SUPPRESSED);
  }
  return null;
}

function gapLinesForRow(input: {
  availability: EvidenceAvailability;
  claimLabel: string;
  limitations: readonly string[];
  reasonCode: EvidenceReasonCode;
}): { gapLine: string | null; gapLines: string[] } {
  const caveatLines = input.limitations.map(
    (text) => `${input.claimLabel}: ${text}`
  );
  const suppressedLine =
    input.reasonCode === ValueState.SUPPRESSED && input.limitations.length === 0
      ? `${input.claimLabel}: ${evidenceReasonLabel(ValueState.SUPPRESSED)}.`
      : null;
  const unavailableLine =
    input.availability === evidenceAvailabilityValues.unavailable
      ? `${input.claimLabel} is unavailable for this county. That is not zero.`
      : null;
  const gapLines = [
    ...caveatLines,
    ...(suppressedLine ? [suppressedLine] : []),
    ...(unavailableLine ? [unavailableLine] : []),
  ];
  return {
    gapLine: unavailableLine ?? suppressedLine ?? caveatLines[0] ?? null,
    gapLines,
  };
}

/**
 * One mapping from a published number, status token, or coverage status to
 * the value state, reason, limitation text, gap line, and inspect target.
 */
export function mapPublishedRow(input: {
  claimLabel: string;
  inheritedLimitations?: readonly string[];
  inspectAnchor: string;
  subject: PublishedRowSubject;
}): GovernedPublishedState {
  const seed = subjectSeed(input.subject);
  const limitations = mergedLimitations(
    input.inheritedLimitations ?? NO_ADDED_LIMITATIONS,
    seed.limitations
  );
  const hasMaterialLimitations = hasGovernedMaterialLimitations(limitations);
  const valueState = seed.valueState;
  const availability = availabilityFromGovernedValueState({
    hasMaterialLimitations,
    valueState,
  });
  const reasonCode = reasonCodeForEvidence({
    hasMaterialLimitations,
    valueState,
  });
  const limitationText = limitationTextForRow({ limitations, reasonCode });
  const gaps = gapLinesForRow({
    availability,
    claimLabel: input.claimLabel,
    limitations,
    reasonCode,
  });
  return {
    availability,
    gapLine: gaps.gapLine,
    gapLines: gaps.gapLines,
    inspectTarget: limitationText ? input.inspectAnchor : null,
    limitationText,
    limitations,
    reasonCode,
    valueState,
  };
}

function evidenceFromPublishedField(input: {
  claimLabel: string;
  measure: Measure | undefined;
  releaseId: string;
  source: SourceMetadata | null;
  state: GovernedPublishedState;
  unit: string | null;
  value: number | string | null;
}): EvidenceObjectModel {
  const sourceFamily = input.source?.label.trim() || "Unavailable";
  const datasetVintage = input.source?.vintage.trim() || null;
  const evidenceType = evidenceTypeFromGovernedMetadata(
    input.measure?.measure_type
  );
  const materialCaveat = materialCaveatShort(input.state.limitations);
  const displayValue = formatGovernedEvidenceValue({
    unit: input.unit,
    value: input.value,
    valueState: input.state.valueState,
  });
  const publishedStatus =
    displayValue === "Unavailable" &&
    typeof input.value === "string" &&
    input.value.trim()
      ? `Published status: ${input.value.trim().replaceAll("_", " ")}.`
      : null;
  return {
    availability: input.state.availability,
    claimLabel: input.claimLabel,
    displayValue,
    provenance: {
      datasetVintage,
      evidenceType,
      inspectSummary: [
        `${sourceFamily}.`,
        datasetVintage ? `Dataset vintage ${datasetVintage}.` : null,
        evidenceType === "Unavailable"
          ? null
          : `Evidence type: ${evidenceType}.`,
        `${evidenceReasonLabel(input.state.reasonCode)}.`,
        materialCaveat,
      ]
        .filter((part) => part !== null)
        .join(" "),
      limitations: [...input.state.limitations],
      materialCaveat,
      observationPeriod: "Unavailable",
      sourceFamily,
      sourceUrl: input.source?.url.trim() || null,
      technical: {
        releaseId: input.releaseId,
        sourceId: input.source?.key ?? null,
      },
    },
    reasonCode: input.state.reasonCode,
    valueNote: publishedStatus,
  };
}

function representedMeasureIds(
  measureIds: readonly string[]
): ReadonlySet<string> {
  return new Set(measureIds);
}

function statusField(input: {
  claimLabel: string;
  familyId: InvestigateEvidenceFamilyId;
  gapLabel: string;
  measureId: string;
  sourceKey: string;
  status: string | null;
}): PublishedField {
  return {
    ...input,
    displayValue: null,
    unit: null,
    value: input.status,
  };
}

function numericField(input: {
  claimLabel: string;
  displayValue?: string | null;
  familyId: InvestigateEvidenceFamilyId;
  gapLabel: string;
  measureId: string;
  sourceKey: string;
  value: number | null;
}): PublishedField {
  return {
    claimLabel: input.claimLabel,
    displayValue: input.displayValue ?? null,
    familyId: input.familyId,
    gapLabel: input.gapLabel,
    measureId: input.measureId,
    sourceKey: input.sourceKey,
    status: null,
    unit: null,
    value: input.value,
  };
}

/** CountyDetail.svi_percentile is a 0–1 fraction, same as the county panel. */
function socialVulnerabilityLabel(fraction: number): string | null {
  if (!Number.isFinite(fraction)) {
    return null;
  }
  return `${Math.round(fraction * 100)}th percentile`;
}

/**
 * CountyDetail.uninsured_percent is already a percent. Do not scale it.
 * uninsured_percentile is a separate fraction and is not shown here.
 */
function uninsuredPercentLabel(percent: number): string | null {
  const rendered = formatGovernedEvidenceValue({
    unit: null,
    value: percent,
    valueState: numericValueState(percent),
  });
  if (rendered === "Unavailable") {
    return null;
  }
  return `${rendered}%`;
}

function fieldsForRecord(record: PublishedCountyRecord): PublishedField[] {
  const speciesKnown =
    record.scapularisStatus !== null || record.pacificusStatus !== null;
  const tickField = speciesKnown
    ? [
        statusField({
          claimLabel: "Ixodes scapularis status",
          familyId: "vector_pathogen",
          gapLabel: "Ixodes scapularis status",
          measureId: "scapularis_status",
          sourceKey: "tick",
          status: record.scapularisStatus,
        }),
        statusField({
          claimLabel: "Ixodes pacificus status",
          familyId: "vector_pathogen",
          gapLabel: "Ixodes pacificus status",
          measureId: "pacificus_status",
          sourceKey: "tick",
          status: record.pacificusStatus,
        }),
      ]
    : [
        statusField({
          claimLabel: "Tick surveillance status",
          familyId: "vector_pathogen",
          gapLabel: "Tick surveillance status",
          measureId: "tick_status",
          sourceKey: "tick",
          status: record.tickStatus,
        }),
      ];
  return [
    ...tickField,
    statusField({
      claimLabel: "Borrelia burgdorferi status",
      familyId: "vector_pathogen",
      gapLabel: "Borrelia burgdorferi status",
      measureId: "burgdorferi_status",
      sourceKey: "pathogen",
      status: record.burgdorferiStatus,
    }),
    numericField({
      claimLabel: "Population",
      familyId: "environmental_population",
      gapLabel: "Population",
      measureId: "population_2022",
      sourceKey: "context_svi",
      value: record.population,
    }),
    numericField({
      claimLabel: "Social vulnerability percentile",
      displayValue:
        record.sviPercentile === null
          ? null
          : socialVulnerabilityLabel(record.sviPercentile),
      familyId: "environmental_population",
      gapLabel: "Social vulnerability",
      measureId: "svi_percentile_2022",
      sourceKey: "context_svi",
      value: record.sviPercentile,
    }),
    numericField({
      claimLabel: "Uninsured percent",
      displayValue:
        record.uninsuredPercent === null
          ? null
          : uninsuredPercentLabel(record.uninsuredPercent),
      familyId: "environmental_population",
      gapLabel: "Uninsured percent",
      measureId: "uninsured_percent_2022",
      sourceKey: "context_svi",
      value: record.uninsuredPercent,
    }),
    numericField({
      claimLabel: "Rural-urban classification",
      familyId: "environmental_population",
      gapLabel: "Rural-urban classification",
      measureId: "rucc_2023",
      sourceKey: "context_rucc",
      value: record.rucc,
    }),
  ];
}

function unallocatedGap(count: number | null): string | null {
  if (count === null || count <= 0) {
    return null;
  }
  const noun = count === 1 ? "record was" : "records were";
  return `${count} published human-surveillance ${noun} not allocated to a county in this release. That is not a county case count.`;
}

function rowFromField(input: {
  field: PublishedField;
  measures: readonly Measure[];
  record: PublishedCountyRecord;
  subject: PublishedRowSubject;
  value: number | string;
}): PublishedHierarchyRow {
  const measure = measureForId(input.measures, input.field.measureId);
  const claimLabel = measure?.label ?? input.field.claimLabel;
  const source = sourceForKey(input.record.sources, input.field.sourceKey);
  const state = mapPublishedRow({
    claimLabel,
    inheritedLimitations: [
      ...(measure?.limitations ?? NO_ADDED_LIMITATIONS),
      source?.note ?? "",
    ],
    inspectAnchor: publishedRowAnchor(input.field.measureId),
    subject: input.subject,
  });
  return {
    evidence: evidenceFromPublishedField({
      claimLabel,
      measure,
      releaseId: input.record.releaseId,
      source,
      state,
      unit: input.field.displayValue ? null : (measure?.unit ?? null),
      value: input.value,
    }),
    familyId: input.field.familyId,
    measureId: input.field.measureId,
    state,
  };
}

/**
 * Published county-record rows for measures that have no observation series.
 * Null context stays a gap. It is not rendered as zero. Numeric zero is
 * ValueState.ZERO.
 */
export function publishedCountyHierarchy(input: {
  measures: readonly Measure[];
  observedMeasureIds: readonly string[];
  record: PublishedCountyRecord;
}): PublishedCountyHierarchy {
  const observed = representedMeasureIds(input.observedMeasureIds);
  const rows: PublishedHierarchyRow[] = [];
  const gaps: string[] = [];
  for (const field of fieldsForRecord(input.record)) {
    if (observed.has(field.measureId)) {
      continue;
    }
    if (typeof field.value === "number") {
      if (!Number.isFinite(field.value)) {
        gaps.push(
          `${field.gapLabel} was not returned for this county. That is not zero.`
        );
        continue;
      }
      rows.push(
        rowFromField({
          field,
          measures: input.measures,
          record: input.record,
          subject: { kind: "numeric", value: field.value },
          value: field.displayValue ?? field.value,
        })
      );
      continue;
    }
    if (typeof field.value !== "string" || field.value.trim().length === 0) {
      gaps.push(
        `${field.gapLabel} was not returned for this county. That is not zero.`
      );
      continue;
    }
    rows.push(
      rowFromField({
        field,
        measures: input.measures,
        record: input.record,
        subject: { kind: "status", status: field.value },
        value: field.value,
      })
    );
  }
  const unallocated = unallocatedGap(input.record.stateUnallocatedRecords);
  if (unallocated) {
    gaps.push(unallocated);
  }
  return {
    completeness: input.record.evidenceCompleteness,
    gaps,
    releaseLimitation: input.record.releaseLimitation,
    rows,
  };
}

const COVERAGE_STATUS_LABELS: Record<
  EnvironmentalContext["coverage_status"],
  string
> = {
  [EnvironmentalContextCoverageStatus.COMPLETE]: "Complete",
  [EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE]: "Partial coverage",
  [EnvironmentalContextCoverageStatus.SOURCE_MISSING]: "Source missing",
  [EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE]:
    "Out of source coverage",
};

function coveragePresentation(
  status: EnvironmentalContext["coverage_status"]
): {
  limitations: string[];
  valueState: ValueState;
} {
  switch (status) {
    case EnvironmentalContextCoverageStatus.COMPLETE: {
      return { limitations: [], valueState: ValueState.OBSERVED };
    }
    case EnvironmentalContextCoverageStatus.PARTIAL_COVERAGE: {
      return {
        limitations: ["Partial coverage."],
        valueState: ValueState.OBSERVED,
      };
    }
    case EnvironmentalContextCoverageStatus.SOURCE_MISSING: {
      return { limitations: [], valueState: ValueState.MISSING };
    }
    case EnvironmentalContextCoverageStatus.OUT_OF_SOURCE_COVERAGE: {
      return { limitations: [], valueState: ValueState.UNAVAILABLE };
    }
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function coverageFractionNote(context: EnvironmentalContext): string | null {
  const fraction = context.source_coverage_fraction;
  if (fraction === null) {
    return null;
  }
  const rendered =
    typeof fraction === "string" ? fraction.trim() : String(fraction);
  if (!rendered) {
    return null;
  }
  return `Source coverage fraction ${rendered}.`;
}

/** Governed environmental coverage. One row per observation. Partial coverage is limited, not a score. */
export function environmentalCoverageRows(input: {
  contexts: readonly EnvironmentalCoverageContext[];
}): EnvironmentalCoverageRow[] {
  return input.contexts.map((entry) => {
    const fractionNote = coverageFractionNote(entry.context);
    const source = entry.provenance;
    const claimLabel = `${entry.measureLabel} coverage`;
    const state = mapPublishedRow({
      claimLabel,
      inheritedLimitations: source.limitations,
      inspectAnchor: coverageRowAnchor(entry.observationId),
      subject: { kind: "coverage", status: entry.context.coverage_status },
    });
    const label = COVERAGE_STATUS_LABELS[entry.context.coverage_status];
    const observationSummary = source.inspectSummary.trim();
    return {
      coverageStatus: entry.context.coverage_status,
      evidence: {
        availability: state.availability,
        claimLabel,
        displayValue: label,
        provenance: {
          ...source,
          inspectSummary: [
            `${entry.measureLabel} coverage is ${label}.`,
            "Environmental context.",
            observationSummary || null,
            fractionNote,
          ]
            .filter((part) => part !== null)
            .join(" "),
          limitations: [...state.limitations],
          materialCaveat: materialCaveatShort(state.limitations),
          technical: {
            ...source.technical,
            observationId: entry.observationId,
            releaseId: source.technical?.releaseId ?? null,
          },
        },
        reasonCode: state.reasonCode,
        valueNote: null,
      },
      measureId: entry.measureId,
      observationId: entry.observationId,
      state,
    };
  });
}
