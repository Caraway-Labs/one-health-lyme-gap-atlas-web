/**
 * Citation order for the provenance guide. The sentences keep the governed
 * limits: methodology may be absent, null is not zero, provenance_ref is not
 * a literature citation, and response time is not publisher freshness.
 */
export const evidenceFlowAlt =
  "Source, then methodology, then observation, then citation fields.";

export const evidenceFlowChart = `flowchart TB
  source["Source"]
  methodology["Methodology"]
  observation["Observation"]
  citation["Citation fields"]
  source --> methodology
  methodology --> observation
  observation --> citation`;

export const evidenceFlowSteps = [
  {
    detail:
      "The publisher record. Cite `source_id`. It differs from `lineage_source_id` and `dataset_id`.",
    title: "Source",
  },
  {
    detail:
      "The transformation record. `methodology_id` is null when no methodology resource applies.",
    title: "Methodology",
  },
  {
    detail:
      "The measured row. Read `value` with `value_state`. Null is not zero.",
    title: "Observation",
  },
  {
    detail:
      "Keep `value`, `value_state`, source, methodology, `release_id`, and `limitations` together. `provenance_ref` is not a literature citation. `meta.response_at` is when Atlas built the response. It does not show when the publisher last updated the data.",
    title: "Citation fields",
  },
] as const;

export function evidenceFlowMarkdown(): string {
  return [
    `Diagram: ${evidenceFlowAlt}`,
    "",
    ...evidenceFlowSteps.map(
      (step, index) => `${index + 1}. **${step.title}.** ${step.detail}`
    ),
  ].join("\n");
}
