/**
 * Banned public-documentation terms.
 *
 * Copied from the "Banned and replace list" in the API writing style guide:
 * https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-api/blob/main/docs/api-writing-style.md
 *
 * That file is the source. Update this copy when that table changes.
 * This is the only banned-term list in the web repository.
 *
 * `mechanical: false` rows are sense-qualified in the style guide
 * ("as the whole explanation", "warehouse sense", or "of a result" versus
 * "of storage"). They stay here so the copied list is complete. The checker
 * does not guess that sense.
 *
 * `allowInCode: true` rows are also exact contract tokens (a cache directive
 * or a filename). Style-guide sentence rule 10 keeps those tokens exact when
 * they are in code font. Prose uses of the same words still fail.
 */

export const BANNED_TERMS = [
  {
    allowInCode: false,
    avoid: "pre-execution logical-result ceiling",
    id: "pre-execution-logical-result-ceiling",
    instead:
      "result limit (state the number, for example 10,000, and that a request over the limit is rejected, not truncated)",
    mechanical: true,
    pattern: "pre-execution logical-result ceiling",
    patternKind: "phrase",
  },
  {
    allowInCode: false,
    avoid: "logical-result ceiling",
    id: "logical-result-ceiling",
    instead: "result limit",
    mechanical: true,
    pattern: "logical-result ceiling",
    patternKind: "phrase",
  },
  {
    allowInCode: false,
    avoid: "admitted Data delivery",
    id: "admitted-data-delivery",
    instead:
      'describe what the data is, for example "published surveillance context"',
    mechanical: true,
    pattern: "admitted Data delivery",
    patternKind: "phrase",
  },
  {
    allowInCode: true,
    avoid: "persisted",
    id: "persisted",
    instead: "published (of a result) or stored (of storage)",
    mechanical: true,
    pattern: String.raw`\bpersisted\b`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: "typed 200",
    id: "typed-200",
    instead: "describe the HTTP 200 body and its `availability` value",
    mechanical: true,
    pattern: String.raw`\btyped 200\b`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: "typed availability",
    id: "typed-availability",
    instead: "the `availability` field",
    mechanical: true,
    pattern: "typed availability",
    patternKind: "phrase",
  },
  {
    avoid: "retained / existing / legacy (as the whole explanation)",
    id: "retained-existing-legacy",
    instead:
      'describe the behavior, for example "returns the same fields as before"',
    mechanical: false,
  },
  {
    avoid: "Fumadocs, `/docs`, and `/redoc` consume...",
    id: "fumadocs-consumes-openapi",
    instead:
      "remove from public API prose; tooling notes belong in contributor docs",
    mechanical: true,
    pattern: String.raw`Fumadocs[\s\S]{0,80}\/docs[\s\S]{0,80}\/redoc\s+consume`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: "consumer-safe",
    id: "consumer-safe",
    instead: "suitable for public use, or say the specific reviewed property",
    mechanical: true,
    pattern: "consumer-safe",
    patternKind: "phrase",
  },
  {
    allowInCode: false,
    avoid: "producer-native",
    id: "producer-native",
    instead: "as supplied by the publisher",
    mechanical: true,
    pattern: "producer-native",
    patternKind: "phrase",
  },
  {
    allowInCode: false,
    avoid: "source-native",
    id: "source-native",
    instead: "as supplied by the publisher",
    mechanical: true,
    pattern: "source-native",
    patternKind: "phrase",
  },
  {
    allowInCode: false,
    avoid: "fail closed",
    id: "fail-closed",
    instead: "return an error instead of partial data (name the status code)",
    mechanical: true,
    pattern: String.raw`\bfail[- ]closed\b`,
    patternKind: "regex",
  },
  {
    allowInCode: true,
    avoid: "no-store",
    id: "no-store",
    instead: "the response must not be cached",
    mechanical: true,
    pattern: String.raw`\bno-store\b`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: "exact Data record admission",
    id: "exact-data-record-admission",
    instead: "the record is published for that county",
    mechanical: true,
    pattern: "exact Data record admission",
    patternKind: "phrase",
  },
  {
    avoid: "bundle, slice, projector, view (warehouse sense)",
    id: "warehouse-pipeline-words",
    instead: "describe the data, not the pipeline",
    mechanical: false,
  },
  {
    allowInCode: false,
    avoid: "resource503",
    id: "resource503",
    instead: "HTTP 503",
    mechanical: true,
    pattern: String.raw`\bresource503\b`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: "typed 503",
    id: "typed-503",
    instead: "HTTP 503",
    mechanical: true,
    pattern: String.raw`\btyped 503\b`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: "ticket or issue numbers, `API #nnn`, `ADR nnnn`",
    id: "ticket-number",
    instead: "remove; link to a public document if needed",
    mechanical: true,
    pattern: String.raw`\b(?:API|WEB)\s*#\s*\d+\b|\bADR\s+\d+\b|\bissue\s+#\d+\b`,
    patternKind: "regex",
  },
  {
    allowInCode: false,
    avoid: '"this endpoint is not..." chains',
    id: "endpoint-is-not-chain",
    instead: "one positive sentence, one limit sentence",
    mechanical: true,
    pattern: "this endpoint is not",
    patternKind: "phrase",
  },
];
