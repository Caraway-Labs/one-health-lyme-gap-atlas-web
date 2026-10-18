import type { ProvenancePipelineId } from "./catalog";

export const DATA_PROVENANCE_TITLE = "Data Provenance";
export const DATA_PROVENANCE_SUBTITLE =
  "Understand the evidence behind One Health Atlas.";

export const PROVENANCE_PIPELINE: readonly {
  id: ProvenancePipelineId;
  label: string;
  text: string;
}[] = [
  {
    id: "source",
    label: "Source",
    text: "The publisher's own system, file, or feed. Atlas does not require that system to look like today's open-data release.",
  },
  {
    id: "validate",
    label: "Validate",
    text: "The public contract keeps an observed value, a numeric zero, and missing, suppressed, or unavailable evidence distinct. This stage is conceptual. This page does not show the checks a pipeline run performed.",
  },
  {
    id: "transform",
    label: "Transform",
    text: "Records are normalized into Atlas observations. A mapping can annotate source meaning. It does not erase the original source, version, vintage, or limitations.",
  },
  {
    id: "release",
    label: "Release",
    text: "The product and the public API read the current governed release. Release generation and load times are processing timestamps. They are not the source observation period.",
  },
  {
    id: "explore",
    label: "Explore",
    text: "Atlas Explorer, Compare, and county evidence show the governed result with its source, period, and limitations still beside it.",
  },
];

export const PROVENANCE_LIMITATIONS = [
  "Product geography is the lower 48 states and the District of Columbia.",
  "A source period, a source vintage, a publisher update, a source retrieval time, and an Atlas release time answer different questions.",
  "A published zero stays zero. Missing, suppressed, and unavailable evidence are not zero. “No records” does not establish biological absence.",
  "Suppression means the publisher withheld a value. Atlas does not reconstruct the count.",
  "The county review score is a derived follow-up priority. It is not disease risk, a diagnosis, or an individual exposure.",
  "When the current source resource omits a field, the card says Not provided or leaves that row out.",
] as const;

export const PROVENANCE_DOC_LINKS = [
  {
    href: "/docs/sources-and-canonical-evidence",
    label: "Sources and canonical evidence",
  },
  {
    href: "/docs/evidence-and-uncertainty",
    label: "Evidence, provenance, and uncertainty",
  },
  {
    href: "/docs/releases-and-methodology",
    label: "Releases and methodology labels",
  },
  {
    href: "/docs/develop/provenance",
    label: "Provenance fields in the API",
  },
] as const;
