import type { TypeNode } from "fumadocs-ui/components/type-table";

/**
 * Schema sentences copied from the pinned public OpenAPI property descriptions.
 * Checked values are separate and come from the 18 October 2026 production reads.
 */
export const observationNullSemantics = {
  atlas_acquired_at: {
    description:
      "Atlas acquisition time when governed; distinct from source publication and processing.",
    required: false,
    type: "date-time | null",
  },
  atlas_processed_at: {
    description:
      "Atlas processing time when governed; distinct from response time.",
    required: false,
    type: "date-time | null",
  },
  denominator: {
    description:
      "Governed denominator; null means it is not supplied and must not be inferred.",
    required: true,
    type: "string | null",
  },
  limitations: {
    description:
      "Governed interpretation limitations; preserve alongside values and versions.",
    required: true,
    type: "string[]",
  },
  methodology_id: {
    description:
      "Exact governed methodology resource ID; null when not governed.",
    required: true,
    type: "string | null",
  },
  source_published_at: {
    description:
      "Publisher timestamp when governed; null is not inferred freshness.",
    required: false,
    type: "date-time | null",
  },
  value: {
    description: "Read with value_state and unit; null never means zero.",
    required: true,
    type: "number | string | null",
  },
  value_state: {
    description:
      "OBSERVED is nonzero; ZERO is numeric zero; MISSING/SUPPRESSED/UNAVAILABLE require null; NO_COUNTY_LINKED_RECORD retains the literal no_county_linked_record; NO_RECORDS retains CDC's No records. Neither establishes biological absence.",
    required: true,
    type: "ValueState",
  },
} as const satisfies Record<string, TypeNode>;

export interface ProvenanceNameRow {
  deprecated?: boolean;
  description: string;
  name: string;
  required: boolean;
  schema: "Methodology" | "Observation" | "Source";
  type: string;
}

export const provenanceNameRows: readonly ProvenanceNameRow[] = [
  {
    description:
      "Public source resource key; distinct from lineage_source_id and dataset_id.",
    name: "source_id",
    required: true,
    schema: "Observation",
    type: "Source.source_id",
  },
  {
    description:
      "Observation field. The source resource field with this value is label.",
    name: "source_label",
    required: false,
    schema: "Observation",
    type: "Source.label",
  },
  {
    description:
      "Publisher timestamp when governed; null is not inferred freshness.",
    name: "source_published_at",
    required: false,
    schema: "Observation",
    type: "Source.published_at",
  },
  {
    description:
      "Source field. Deprecated. The observation publisher timestamp is source_published_at.",
    name: "published_at",
    required: false,
    schema: "Source",
    type: "date-time | null",
  },
  {
    description:
      "Atlas acquisition time when governed; distinct from source publication and processing. Deprecated on Source. Not deprecated on Observation.",
    name: "atlas_acquired_at",
    required: false,
    schema: "Observation",
    type: "Source.atlas_acquired_at",
  },
  {
    description:
      "Atlas processing time when governed; distinct from response time. Observation field. Source has no atlas_processed_at.",
    name: "atlas_processed_at",
    required: false,
    schema: "Observation",
    type: "date-time | null",
  },
  {
    description: "Governed publisher update time; null when unavailable.",
    name: "upstream_updated_at",
    required: false,
    schema: "Source",
    type: "date-time | null",
  },
  {
    description: "Governed source retrieval time; null when unavailable.",
    name: "source_retrieved_at",
    required: false,
    schema: "Source",
    type: "date-time | null",
  },
  {
    description:
      "Same name on Observation and Source. Nullable and not required on Observation. Required string on Source.",
    name: "lineage_source_id",
    required: false,
    schema: "Observation",
    type: "Source.lineage_source_id",
  },
  {
    description:
      "Same name on Observation and Source. Nullable and not required on Observation. Required string on Source.",
    name: "dataset_id",
    required: false,
    schema: "Observation",
    type: "Source.dataset_id",
  },
  {
    description: "Governed release identity for reproducibility.",
    name: "release_id",
    required: true,
    schema: "Observation",
    type: "Source.release_version",
  },
  {
    description:
      "Exact governed methodology resource ID; null when not governed.",
    name: "methodology_id",
    required: true,
    schema: "Observation",
    type: "Methodology.methodology_id",
  },
  {
    description:
      "Observation text field. The methodology resource field with this text is description.",
    name: "methodology",
    required: false,
    schema: "Observation",
    type: "Methodology.description",
  },
  {
    description:
      "Transformation version, distinct from methodology resource version.",
    name: "methodology_version",
    required: true,
    schema: "Observation",
    type: "string",
  },
  {
    description:
      "Observation field. The methodology resource version is Methodology.version.",
    name: "release_methodology_version",
    required: false,
    schema: "Observation",
    type: "Methodology.version",
  },
  {
    description:
      "Governed interpretation limitations; preserve alongside values and versions.",
    name: "limitations",
    required: true,
    schema: "Observation",
    type: "string[]",
  },
  {
    description:
      "Structured observation provenance identity; not a literature citation.",
    name: "provenance_ref",
    required: true,
    schema: "Observation",
    type: "EvidenceReference.provenance_ref",
  },
];

export function provenanceNameTable(): Record<string, TypeNode> {
  return Object.fromEntries(
    provenanceNameRows.map((row) => [
      row.name,
      {
        deprecated: row.deprecated,
        description: row.description,
        required: row.required,
        type: row.type,
      },
    ])
  );
}

export const provenanceCitationPaths = {
  discoverMeasure: "/v1/measures/case_count_floor_2023",
  discoverSources: "/v1/sources?page_size=100",
  observeGap:
    "/v1/observations?measure_id=case_count_floor_2023&geography_type=county&geography_id=08001&year=2023",
  resolveMethodology:
    "/v1/methodologies/human_confirmed_probable_case_floor_v1",
  resolveSource: "/v1/sources/human",
} as const;

export const checkedCaseFloorLimitations = [
  "Published surveillance values are privacy-protected floors, not complete incidence estimates.",
  "Privacy-protected floor.",
  "This is a deterministic surveillance follow-up priority release, not a diagnosis, prediction, causal claim, exposure map, or individual risk estimate. Published human values are privacy-protected floors; no records is not absence. Human rows with explicitly unavailable state geography are retained in source provenance but are not allocated to county or state release values. Restricted pathogen source gaps are explicitly unknown source coverage. Selected 2025 TIGER geographies 09110 and 51013 only; unselected counties are not zero. COMPLETE describes valid source-supported area; preserve source coverage fraction. 09110 is Capitol Planning Region, with no historical Connecticut county crosswalk. Official MRLC mosaic lineage, not USGS S3 tiles. Descriptive land-cover context only; no Lyme causal/risk estimate or automatic ML admission.",
] as const;

const checkedGapObservationId =
  "43c0ce4e82c89ba4d75ebca07f97e63d75fdf18a0dae9fed778aa22266c81273";

export const checkedGapObservationFields = {
  atlas_acquired_at: "2026-09-07T17:21:14.768948-07:00",
  atlas_processed_at: null,
  evidence: {
    methodology_version: "semantic_county_assembly_v1",
    provenance_ref: checkedGapObservationId,
    release_id: "governed-2026-10-15-january-climate-prod",
    resource_id: checkedGapObservationId,
    resource_type: "observation",
    semantic_version: "2.0.0",
    source_id: "human",
    uri: null,
  },
  geography: {
    geography_id: "08001",
    geography_type: "county",
  },
  limitations: [...checkedCaseFloorLimitations],
  methodology: "x5j9 confirmed plus probable",
  methodology_id: "human_confirmed_probable_case_floor_v1",
  methodology_version: "semantic_county_assembly_v1",
  observation_id: checkedGapObservationId,
  provenance_ref: checkedGapObservationId,
  release_id: "governed-2026-10-15-january-climate-prod",
  release_methodology_version: "semantic-2.0.0",
  source_label: "CDC Lyme surveillance",
  source_published_at: null,
  value: null,
  value_state: "MISSING",
} as const;

export const checkedObservedValueFields = {
  geography: {
    geography_id: "36061",
    geography_type: "county",
  },
  unit: "cases",
  value: 1114,
  value_state: "OBSERVED",
} as const;

export const checkedSourceFields = {
  atlas_acquired_at: null,
  dataset_id: "x5j9-wybp",
  label: "CDC Lyme surveillance",
  limitations: [
    "County-of-residence surveillance. County-linked values are published privacy-protected floors, not complete incidence estimates.",
  ],
  lineage_source_id: "cdc_lyme",
  published_at: null,
  publisher: "Centers for Disease Control and Prevention",
  release_version: "governed-2026-10-15-january-climate-prod",
  source_id: "human",
  source_retrieved_at: null,
  source_version: null,
  upstream_updated_at: null,
} as const;

export const checkedMethodologyFields = {
  description: "x5j9 confirmed plus probable",
  limitations: ["Privacy-protected floor."],
  methodology_id: "human_confirmed_probable_case_floor_v1",
  release_version: "governed-2026-10-15-january-climate-prod",
  version: "semantic-2.0.0",
} as const;
