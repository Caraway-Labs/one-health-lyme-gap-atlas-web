/**
 * Single source for docs glossary terms.
 * Field and concept sentences are copied from contracts/public-openapi.json.
 * The API style guide vocabulary table is not in this repo.
 */

export type GlossaryTerm = {
  definition: string;
  id: string;
  label: string;
  learnMoreHref: string;
  learnMoreLabel: string;
};

const GEOGRAPHY = "/docs/develop/geography";
const GEOGRAPHY_LABEL = "Geography";
const OBSERVATIONS = "/docs/develop/observation-queries";
const OBSERVATIONS_LABEL = "Observation queries";
const PROVENANCE = "/docs/develop/provenance";
const PROVENANCE_LABEL = "Provenance and evidence";
const RELEASES = "/docs/releases-and-methodology";
const RELEASES_LABEL = "Releases and methodology";
const RESOURCES = "/docs/develop/resources";
const RESOURCES_LABEL = "Indicators, measures, and observations";
const REST = "/docs/develop/rest";
const REST_LABEL = "REST API";
const VALUE_STATES = "/docs/develop/errors#value-states";
const VALUE_STATES_LABEL = "Value states";

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  {
    definition:
      "Whether Atlas has published results for the selection. It does not describe biological presence.",
    id: "availability",
    label: "availability",
    learnMoreHref: OBSERVATIONS,
    learnMoreLabel: OBSERVATIONS_LABEL,
  },
  {
    definition:
      "What the value is measured against, such as a population. `null` means Atlas supplies no denominator; do not infer one.",
    id: "denominator",
    label: "denominator",
    learnMoreHref: RESOURCES,
    learnMoreLabel: RESOURCES_LABEL,
  },
  {
    definition:
      "Compact pointer to the Atlas resource that backs this observation.",
    id: "evidence",
    label: "evidence",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition: "Five-digit county FIPS code, with leading zeros.",
    id: "fips",
    label: "FIPS",
    learnMoreHref: GEOGRAPHY,
    learnMoreLabel: GEOGRAPHY_LABEL,
  },
  {
    definition:
      "When the release was built, with a UTC offset. It is not when the publishers last updated their data.",
    id: "generated_at",
    label: "generated_at",
    learnMoreHref: RELEASES,
    learnMoreLabel: RELEASES_LABEL,
  },
  {
    definition:
      "FIPS code with leading zeros: five digits for a county, two for a state. Example: `08001`.",
    id: "geography_id",
    label: "geography_id",
    learnMoreHref: GEOGRAPHY,
    learnMoreLabel: GEOGRAPHY_LABEL,
  },
  {
    definition:
      "Kind of place. `county` uses five-digit FIPS and `state` uses two-digit FIPS.",
    id: "geography_type",
    label: "geography_type",
    learnMoreHref: GEOGRAPHY,
    learnMoreLabel: GEOGRAPHY_LABEL,
  },
  {
    definition: "A public-health concept that groups related measures.",
    id: "indicator",
    label: "indicator",
    learnMoreHref: RESOURCES,
    learnMoreLabel: RESOURCES_LABEL,
  },
  {
    definition:
      "Factual notes on what the result does not show or where its evidence is bounded. Keep them with the value when you display or store it.",
    id: "limitations",
    label: "limitations",
    learnMoreHref: "/docs/evidence-and-uncertainty",
    learnMoreLabel: "Evidence, provenance, and uncertainty",
  },
  {
    definition:
      "When Atlas loaded the release for serving, with a UTC offset. It is not when the publishers last updated their data.",
    id: "loaded_at",
    label: "loaded_at",
    learnMoreHref: RELEASES,
    learnMoreLabel: RELEASES_LABEL,
  },
  {
    definition:
      "One variable you can query, such as a case count. It belongs to one indicator.",
    id: "measure",
    label: "measure",
    learnMoreHref: RESOURCES,
    learnMoreLabel: RESOURCES_LABEL,
  },
  {
    definition:
      "The method Atlas used to produce or interpret a measure's values.",
    id: "methodology",
    label: "methodology",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition:
      "Identifies the methodology. Use it with `/v1/methodologies/{methodology_id}`.",
    id: "methodology_id",
    label: "methodology_id",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition:
      "Send this value as `page_token` to get the next page, with the same filters. Do not parse it.",
    id: "next_page_token",
    label: "next_page_token",
    learnMoreHref: REST,
    learnMoreLabel: REST_LABEL,
  },
  {
    definition:
      "One value for a measure, a county, and a period, with its state and provenance.",
    id: "observation",
    label: "observation",
    learnMoreHref: OBSERVATIONS,
    learnMoreLabel: OBSERVATIONS_LABEL,
  },
  {
    definition:
      "Stable identifier of the observation. It also serves as the provenance reference.",
    id: "observation_id",
    label: "observation_id",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition: "Opaque next_page_token; retain query filters and release.",
    id: "page_token",
    label: "page_token",
    learnMoreHref: REST,
    learnMoreLabel: REST_LABEL,
  },
  {
    definition:
      "Identifies the provenance record for this observation. It is not a literature citation.",
    id: "provenance_ref",
    label: "provenance_ref",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition: "The data release this record came from.",
    id: "release",
    label: "release",
    learnMoreHref: RELEASES,
    learnMoreLabel: RELEASES_LABEL,
  },
  {
    definition:
      "Identifies the published data release the result came from. Results from different releases are not directly comparable.",
    id: "release_id",
    label: "release_id",
    learnMoreHref: RELEASES,
    learnMoreLabel: RELEASES_LABEL,
  },
  {
    definition:
      "When Atlas built this response, in UTC. It is not when the publisher last updated the data and not when the observation was made.",
    id: "response_at",
    label: "response_at",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition:
      "Version of the data contract the value follows. It is separate from the API version and the application version.",
    id: "semantic_version",
    label: "semantic_version",
    learnMoreHref: REST,
    learnMoreLabel: REST_LABEL,
  },
  {
    definition: "The organization and dataset a value came from.",
    id: "source",
    label: "source",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition:
      "Public key of the source resource. It differs from `lineage_source_id` and `dataset_id`.",
    id: "source_id",
    label: "source_id",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition:
      "Reference year or period of the source dataset, such as `ACS 2018-2022`. It is not an annual value.",
    id: "source_vintage",
    label: "source_vintage",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
  {
    definition:
      "Breakdown the value applies to, such as an age group. Empty when the release has no strata.",
    id: "strata",
    label: "strata",
    learnMoreHref: RESOURCES,
    learnMoreLabel: RESOURCES_LABEL,
  },
  {
    definition: "Time interval the value covers, such as `YEAR` or `DAY`.",
    id: "temporal_grain",
    label: "temporal_grain",
    learnMoreHref: OBSERVATIONS,
    learnMoreLabel: OBSERVATIONS_LABEL,
  },
  {
    definition: "Unit of `value`, such as `count` or `mm`.",
    id: "unit",
    label: "unit",
    learnMoreHref: RESOURCES,
    learnMoreLabel: RESOURCES_LABEL,
  },
  {
    definition: "The reported value. `null` never means zero.",
    id: "value",
    label: "value",
    learnMoreHref: VALUE_STATES,
    learnMoreLabel: VALUE_STATES_LABEL,
  },
  {
    definition: "How to read `value`. Never treat a `null` value as zero.",
    id: "value_state",
    label: "value_state",
    learnMoreHref: VALUE_STATES,
    learnMoreLabel: VALUE_STATES_LABEL,
  },
  {
    definition: "Reference year or period of the source dataset.",
    id: "vintage",
    label: "vintage",
    learnMoreHref: PROVENANCE,
    learnMoreLabel: PROVENANCE_LABEL,
  },
];

const glossaryTermsById = indexGlossaryTerms(GLOSSARY_TERMS);

const TERM_TAG = /<Term\b(?<attributes>[^>]*)>/g;
const TERM_ID =
  /\bid\s*=\s*(?:"(?<double>[^"]+)"|'(?<single>[^']+)'|\{\s*"(?<jsonDouble>[^"]+)"\s*\}|\{\s*'(?<jsonSingle>[^']+)'\s*\})/u;

function indexGlossaryTerms(
  terms: readonly GlossaryTerm[]
): ReadonlyMap<string, GlossaryTerm> {
  const byId = new Map<string, GlossaryTerm>();
  for (const term of terms) {
    if (byId.has(term.id)) {
      throw new Error(`Duplicate glossary term "${term.id}".`);
    }
    byId.set(term.id, term);
  }
  return byId;
}

export function listGlossaryTerms(): readonly GlossaryTerm[] {
  return [...GLOSSARY_TERMS].sort((left, right) =>
    left.label.localeCompare(right.label, "en", { sensitivity: "base" })
  );
}

export function lookupGlossaryTerm(id: string): GlossaryTerm {
  const term = glossaryTermsById.get(id);
  if (!term) {
    throw new Error(
      `Unknown glossary term "${id}". Add it to src/features/docs/glossary-terms.ts.`
    );
  }
  return term;
}

export function renderGlossaryMarkdown(): string {
  return listGlossaryTerms()
    .map(
      (term) =>
        `## ${term.label}\n\n${term.definition}\n\n[${term.learnMoreLabel}](${term.learnMoreHref})`
    )
    .join("\n\n");
}

/**
 * Docs build check. A missing `<Term>` id is a build error.
 */
export function glossaryTermProblems(source: string, file: string): string[] {
  const problems: string[] = [];
  for (const match of source.matchAll(TERM_TAG)) {
    const attributes = match.groups?.attributes ?? "";
    const idMatch = TERM_ID.exec(attributes);
    const id =
      idMatch?.groups?.double ??
      idMatch?.groups?.single ??
      idMatch?.groups?.jsonDouble ??
      idMatch?.groups?.jsonSingle;
    if (!id) {
      problems.push(`${file}: <Term> requires an id.`);
      continue;
    }
    if (!glossaryTermsById.has(id)) {
      problems.push(
        `${file}: unknown glossary term "${id}". Add it to src/features/docs/glossary-terms.ts.`
      );
    }
  }
  return problems;
}
