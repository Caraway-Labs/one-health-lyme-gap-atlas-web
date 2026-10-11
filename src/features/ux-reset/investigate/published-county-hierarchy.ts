import { evidenceTypeFromGovernedMetadata } from "@/features/ux-reset/evidence/evidence-type";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
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

export type PublishedHierarchyRow = {
  evidence: EvidenceObjectModel;
  familyId: InvestigateEvidenceFamilyId;
  measureId: string;
};

export type EnvironmentalCoverageRow = {
  coverageStatus: EnvironmentalContext["coverage_status"];
  evidence: EvidenceObjectModel;
  measureId: string;
};

export type PublishedCountyHierarchy = {
  completeness: number;
  gaps: readonly string[];
  releaseLimitation: string;
  rows: readonly PublishedHierarchyRow[];
};

type PublishedField = {
  claimLabel: string;
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
  if (ABSENT_PUBLISHED_STATUSES.has(normalized)) {
    return ValueState.UNAVAILABLE;
  }
  return ValueState.OBSERVED;
}

function evidenceFromPublishedField(input: {
  claimLabel: string;
  measure: Measure | undefined;
  source: SourceMetadata | null;
  unit: string | null;
  value: number | string | null;
  valueState: ValueState;
}): EvidenceObjectModel {
  const sourceLimitations = normalizeGovernedLimitations([
    ...(input.measure?.limitations ?? []),
    input.source?.note ?? "",
  ]);
  const hasMaterialLimitations =
    hasGovernedMaterialLimitations(sourceLimitations);
  const availability = availabilityFromGovernedValueState({
    hasMaterialLimitations,
    valueState: input.valueState,
  });
  const reasonCode = reasonCodeForEvidence({
    hasMaterialLimitations,
    valueState: input.valueState,
  });
  const sourceFamily = input.source?.label.trim() || "Unavailable";
  const datasetVintage = input.source?.vintage.trim() || null;
  const evidenceType = evidenceTypeFromGovernedMetadata(
    input.measure?.measure_type
  );
  const materialCaveat = materialCaveatShort(sourceLimitations);
  const displayValue = formatGovernedEvidenceValue({
    unit: input.unit,
    value: input.value,
    valueState: input.valueState,
  });
  const publishedStatus =
    displayValue === "Unavailable" &&
    typeof input.value === "string" &&
    input.value.trim()
      ? `Published status: ${input.value.trim().replaceAll("_", " ")}.`
      : null;
  return {
    availability,
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
        `${evidenceReasonLabel(reasonCode)}.`,
        materialCaveat,
      ]
        .filter((part) => part !== null)
        .join(" "),
      limitations: sourceLimitations,
      materialCaveat,
      observationPeriod: "Unavailable",
      sourceFamily,
      sourceUrl: input.source?.url.trim() || null,
      technical: input.source
        ? { releaseId: null, sourceId: input.source.key }
        : null,
    },
    reasonCode,
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
    unit: null,
    value: input.status,
  };
}

function numericField(input: {
  claimLabel: string;
  familyId: InvestigateEvidenceFamilyId;
  gapLabel: string;
  measureId: string;
  sourceKey: string;
  value: number | null;
}): PublishedField {
  return {
    claimLabel: input.claimLabel,
    familyId: input.familyId,
    gapLabel: input.gapLabel,
    measureId: input.measureId,
    sourceKey: input.sourceKey,
    status: null,
    unit: null,
    value: input.value,
  };
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
      familyId: "environmental_population",
      gapLabel: "Social vulnerability",
      measureId: "svi_percentile_2022",
      sourceKey: "context_svi",
      value: record.sviPercentile,
    }),
    numericField({
      claimLabel: "Uninsured percent",
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

/**
 * Published county-record rows for measures that have no observation series.
 * Null context stays a gap. It is not rendered as zero.
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
      const measure = measureForId(input.measures, field.measureId);
      rows.push({
        evidence: evidenceFromPublishedField({
          claimLabel: measure?.label ?? field.claimLabel,
          measure,
          source: sourceForKey(input.record.sources, field.sourceKey),
          unit: measure?.unit ?? null,
          value: field.value,
          valueState: ValueState.OBSERVED,
        }),
        familyId: field.familyId,
        measureId: field.measureId,
      });
      continue;
    }
    if (typeof field.value !== "string" || field.value.trim().length === 0) {
      gaps.push(
        `${field.gapLabel} was not returned for this county. That is not zero.`
      );
      continue;
    }
    const measure = measureForId(input.measures, field.measureId);
    rows.push({
      evidence: evidenceFromPublishedField({
        claimLabel: measure?.label ?? field.claimLabel,
        measure,
        source: sourceForKey(input.record.sources, field.sourceKey),
        unit: measure?.unit ?? null,
        value: field.value,
        valueState: statusValueState(field.value),
      }),
      familyId: field.familyId,
      measureId: field.measureId,
    });
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

/** Governed environmental coverage. Partial coverage is limited, not a score. */
export function environmentalCoverageRows(input: {
  contexts: readonly {
    context: EnvironmentalContext;
    measureId: string;
    measureLabel: string;
  }[];
}): EnvironmentalCoverageRow[] {
  return input.contexts.map((entry) => {
    const presentation = coveragePresentation(entry.context.coverage_status);
    const valueState = presentation.valueState;
    const fractionNote = coverageFractionNote(entry.context);
    const limitations = presentation.limitations;
    const hasMaterialLimitations = hasGovernedMaterialLimitations(limitations);
    const availability = availabilityFromGovernedValueState({
      hasMaterialLimitations,
      valueState,
    });
    const reasonCode = reasonCodeForEvidence({
      hasMaterialLimitations,
      valueState,
    });
    const label = COVERAGE_STATUS_LABELS[entry.context.coverage_status];
    return {
      coverageStatus: entry.context.coverage_status,
      evidence: {
        availability,
        claimLabel: `${entry.measureLabel} coverage`,
        displayValue: label,
        provenance: {
          datasetVintage: null,
          evidenceType: "Unavailable",
          inspectSummary: [
            `${entry.measureLabel} coverage is ${label}.`,
            fractionNote,
          ]
            .filter((part) => part !== null)
            .join(" "),
          limitations,
          materialCaveat: materialCaveatShort(limitations),
          observationPeriod: "Unavailable",
          sourceFamily: "Environmental context",
        },
        reasonCode,
        valueNote: null,
      },
      measureId: entry.measureId,
    };
  });
}
