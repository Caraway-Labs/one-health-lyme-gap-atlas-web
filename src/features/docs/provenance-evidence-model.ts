import type { TypeNode } from "fumadocs-ui/components/type-table";

/**
 * Schema sentences copied from the pinned public OpenAPI property descriptions.
 * Checked values are separate and come from the 18 October 2026 production reads.
 */
export const observationNullSemantics = {
  atlas_acquired_at: {
    description:
      "When Atlas retrieved the data from the publisher. Includes a UTC offset. `null` when not recorded.",
    required: false,
    type: "date-time | null",
  },
  atlas_processed_at: {
    description:
      "When Atlas processed the data. Includes a UTC offset. It is not the response time. `null` when not recorded.",
    required: false,
    type: "date-time | null",
  },
  denominator: {
    description:
      "What the value is measured against, such as a population. `null` means Atlas supplies no denominator; do not infer one.",
    required: true,
    type: "string | null",
  },
  limitations: {
    description:
      "Factual notes on what the result does not show or where its evidence is bounded. Keep them with the value when you display or store it.",
    required: true,
    type: "string[]",
  },
  methodology_id: {
    description:
      "Identifies the methodology resource. Use it with `/v1/methodologies/{methodology_id}`. `null` when no methodology resource applies.",
    required: true,
    type: "string | null",
  },
  source_published_at: {
    description:
      "When the publisher published the data. Includes a UTC offset. `null` when not recorded; do not assume the data is fresh.",
    required: false,
    type: "date-time | null",
  },
  value: {
    description:
      "The reported value. Read it with `value_state` and `unit`. `null` never means zero.",
    required: true,
    type: "number | string | null",
  },
  value_state: {
    description:
      "How to read `value`. The `ValueState` schema explains each state and what a client should do. Never treat a `null` value as zero.",
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
      "Public key of the source resource. Use it with `/v1/sources/{source_id}`. It differs from `lineage_source_id` and `dataset_id`.",
    name: "source_id",
    required: true,
    schema: "Observation",
    type: "Source.source_id",
  },
  {
    description:
      "Display name of the source. `null` when none is published. The source resource field with this value is label.",
    name: "source_label",
    required: false,
    schema: "Observation",
    type: "Source.label",
  },
  {
    description:
      "When the publisher published the data. Includes a UTC offset. `null` when not recorded; do not assume the data is fresh.",
    name: "source_published_at",
    required: false,
    schema: "Observation",
    type: "Source.published_at",
  },
  {
    description:
      "Deprecated. Use `upstream_updated_at`. When the publisher published the data. The observation publisher timestamp is source_published_at.",
    name: "published_at",
    required: false,
    schema: "Source",
    type: "date-time | null",
  },
  {
    description:
      "When Atlas retrieved the data from the publisher. Includes a UTC offset. `null` when not recorded. Deprecated on Source. Not deprecated on Observation.",
    name: "atlas_acquired_at",
    required: false,
    schema: "Observation",
    type: "Source.atlas_acquired_at",
  },
  {
    description:
      "When Atlas processed the data. Includes a UTC offset. It is not the response time. `null` when not recorded. Source has no atlas_processed_at.",
    name: "atlas_processed_at",
    required: false,
    schema: "Observation",
    type: "date-time | null",
  },
  {
    description:
      "When the publisher last updated the data. `null` when unavailable. Do not use the response time in its place.",
    name: "upstream_updated_at",
    required: false,
    schema: "Source",
    type: "date-time | null",
  },
  {
    description:
      "When Atlas last retrieved the data from the publisher. `null` when unavailable.",
    name: "source_retrieved_at",
    required: false,
    schema: "Source",
    type: "date-time | null",
  },
  {
    description:
      "Identifies the source in Atlas lineage records. It differs from `source_id`. Nullable and not required on Observation. Required string on Source.",
    name: "lineage_source_id",
    required: false,
    schema: "Observation",
    type: "Source.lineage_source_id",
  },
  {
    description:
      "Identifies the publisher's dataset. It differs from `source_id`. Nullable and not required on Observation. Required string on Source.",
    name: "dataset_id",
    required: false,
    schema: "Observation",
    type: "Source.dataset_id",
  },
  {
    description:
      "Identifies the published data release the result came from. Results from different releases are not directly comparable.",
    name: "release_id",
    required: true,
    schema: "Observation",
    type: "Source.release_version",
  },
  {
    description:
      "Identifies the methodology resource. Use it with `/v1/methodologies/{methodology_id}`. `null` when no methodology resource applies.",
    name: "methodology_id",
    required: true,
    schema: "Observation",
    type: "Methodology.methodology_id",
  },
  {
    description:
      "Short name of the method that produced the value. The methodology resource field with this text is description.",
    name: "methodology",
    required: false,
    schema: "Observation",
    type: "Methodology.description",
  },
  {
    description:
      "Version of the transformation applied to this observation. It is separate from the version of the methodology resource.",
    name: "methodology_version",
    required: true,
    schema: "Observation",
    type: "string",
  },
  {
    description:
      "Version of the methodology as published in this release. `null` when none. The methodology resource version is Methodology.version.",
    name: "release_methodology_version",
    required: false,
    schema: "Observation",
    type: "Methodology.version",
  },
  {
    description:
      "Factual notes on what the result does not show or where its evidence is bounded. Keep them with the value when you display or store it.",
    name: "limitations",
    required: true,
    schema: "Observation",
    type: "string[]",
  },
  {
    description:
      "Identifies the provenance record for this observation. It is not a literature citation.",
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
