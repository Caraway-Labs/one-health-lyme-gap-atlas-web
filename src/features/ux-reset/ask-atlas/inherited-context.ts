import type { CompareAlignment } from "@/features/ux-reset/compare/compare-alignment";
import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import type { ExploreCommittedSelection } from "@/features/ux-reset/explore/explore-model";
import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import { REVIEW_FIELD_UNAVAILABLE } from "@/features/ux-reset/review/review-governed-values";
import type { Observation } from "@/generated/models";
import { isCountyFips } from "@/lib/county-geography";

/**
 * Closed Ask Atlas inherited-context allowlist.
 *
 * These fields are page context the originating surface has already validated.
 * They are not retrieved evidence, citations, or prompt payload. The supported
 * knowledge-chat request (`message` and `history` only) does not accept them.
 */
export const ASK_ATLAS_INHERITED_FIELD_KEYS = [
  "geography",
  "measure",
  "period",
  "release",
  "source",
] as const;

export type AskAtlasInheritedFieldKey =
  (typeof ASK_ATLAS_INHERITED_FIELD_KEYS)[number];

export const ASK_ATLAS_SURFACES = [
  "review",
  "explore",
  "investigate",
  "compare",
  "action",
] as const;

export type AskAtlasSurface = (typeof ASK_ATLAS_SURFACES)[number];

export type AskAtlasInheritedField =
  | { id: string; label: string; state: "validated" }
  | { state: "absent" };

export type AskAtlasInheritedContext = {
  fields: Record<AskAtlasInheritedFieldKey, AskAtlasInheritedField>;
  surface: AskAtlasSurface;
};

const UNRESOLVED_COMPARE_COUNTY_LABEL = /^County \d{5}$/;

type ReviewCountyIdentity = {
  county: string | null;
  fips: string;
  state_name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAskAtlasSurface(value: unknown): value is AskAtlasSurface {
  return (
    typeof value === "string" &&
    (ASK_ATLAS_SURFACES as readonly string[]).includes(value)
  );
}

export function absentInheritedField(): AskAtlasInheritedField {
  return { state: "absent" };
}

export function validatedInheritedField(
  id: string,
  label: string
): AskAtlasInheritedField {
  const trimmedId = id.trim();
  const trimmedLabel = label.trim();
  if (!(trimmedId && trimmedLabel)) {
    return absentInheritedField();
  }
  return { id: trimmedId, label: trimmedLabel, state: "validated" };
}

function sourceFieldFromEvidence(
  evidence: EvidenceObjectModel | null
): AskAtlasInheritedField {
  const sourceId = evidence?.provenance.technical?.sourceId?.trim() ?? "";
  const sourceLabel = evidence?.provenance.sourceFamily?.trim() ?? "";
  if (!(sourceId && sourceLabel) || sourceLabel === "Unavailable") {
    return absentInheritedField();
  }
  return validatedInheritedField(sourceId, sourceLabel);
}

/**
 * One inherited period exists only when every accepted observation shares a
 * period identity. A requested URL period is not an observation identity.
 */
function inheritedPeriodField(
  observations: readonly Pick<
    Observation,
    "period_end" | "period_start" | "temporal_grain"
  >[]
): AskAtlasInheritedField {
  const identities = new Map<
    string,
    { periodEnd: string; periodStart: string; temporalGrain: string }
  >();
  for (const observation of observations) {
    const periodStart = observation.period_start.trim();
    const periodEnd = observation.period_end.trim();
    if (!(periodStart && periodEnd)) {
      continue;
    }
    const key = `${periodStart}|${periodEnd}`;
    if (!identities.has(key)) {
      identities.set(key, {
        periodEnd,
        periodStart,
        temporalGrain: observation.temporal_grain,
      });
    }
  }
  if (identities.size !== 1) {
    return absentInheritedField();
  }
  const identity = [...identities.values()][0];
  if (!identity) {
    return absentInheritedField();
  }
  const label = formatObservationPeriod(
    identity.periodStart,
    identity.periodEnd,
    identity.temporalGrain
  );
  if (label === "Unavailable") {
    return absentInheritedField();
  }
  return validatedInheritedField(identity.periodStart, label);
}

function investigateAcceptedObservations(
  bundle: CountyEvidenceBundle
): Observation[] {
  const observations: Observation[] = [];
  for (const family of bundle.families) {
    for (const record of family.observations) {
      observations.push(record.observation);
    }
  }
  for (const record of bundle.unassigned) {
    observations.push(record.observation);
  }
  return observations;
}

function compareAcceptedObservations(
  alignment: CompareAlignment
): Observation[] {
  const observations: Observation[] = [];
  for (const row of alignment.rows) {
    for (const cell of [row.left, row.right]) {
      if (cell.kind !== "observations") {
        continue;
      }
      for (const record of cell.records) {
        observations.push(record.observation);
      }
    }
  }
  return observations;
}

function emptyFields(): Record<
  AskAtlasInheritedFieldKey,
  AskAtlasInheritedField
> {
  return {
    geography: absentInheritedField(),
    measure: absentInheritedField(),
    period: absentInheritedField(),
    release: absentInheritedField(),
    source: absentInheritedField(),
  };
}

export function finalizeInheritedContext(input: {
  fields: Record<AskAtlasInheritedFieldKey, AskAtlasInheritedField>;
  surface: AskAtlasSurface;
}): AskAtlasInheritedContext | null {
  const anyValidated = ASK_ATLAS_INHERITED_FIELD_KEYS.some(
    (key) => input.fields[key].state === "validated"
  );
  if (!anyValidated) {
    return null;
  }
  return { fields: input.fields, surface: input.surface };
}

function parseField(value: unknown): AskAtlasInheritedField | null {
  if (!isRecord(value) || typeof value.state !== "string") {
    return null;
  }
  if (value.state === "absent") {
    return Object.keys(value).length === 1 ? { state: "absent" } : null;
  }
  if (value.state !== "validated") {
    return null;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    value.id.trim() !== value.id ||
    value.label.trim() !== value.label ||
    value.id.length === 0 ||
    value.label.length === 0 ||
    Object.keys(value).length !== 3
  ) {
    return null;
  }
  return { id: value.id, label: value.label, state: "validated" };
}

export function serializeAskAtlasInheritedContext(
  context: AskAtlasInheritedContext
): string {
  return JSON.stringify({
    fields: context.fields,
    surface: context.surface,
  });
}

/** Fail closed. Unknown keys or unvalidated values become no context. */
export function parseAskAtlasInheritedContext(
  value: string
): AskAtlasInheritedContext | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || Object.keys(parsed).length !== 2) {
    return null;
  }
  if (!isAskAtlasSurface(parsed.surface) || !isRecord(parsed.fields)) {
    return null;
  }
  if (
    Object.keys(parsed.fields).length !== ASK_ATLAS_INHERITED_FIELD_KEYS.length
  ) {
    return null;
  }
  const fields = emptyFields();
  for (const key of ASK_ATLAS_INHERITED_FIELD_KEYS) {
    const field = parseField(parsed.fields[key]);
    if (!field) {
      return null;
    }
    fields[key] = field;
  }
  return finalizeInheritedContext({ fields, surface: parsed.surface });
}

export function inheritedContextPublicationKey(
  context: AskAtlasInheritedContext | null
): string {
  return context ? serializeAskAtlasInheritedContext(context) : "";
}

export function inheritedContextFromExplore(input: {
  committed: ExploreCommittedSelection | null;
  selectedFips: string | null;
}): AskAtlasInheritedContext | null {
  if (!input.committed) {
    return null;
  }
  const row = input.selectedFips
    ? input.committed.rows.find((item) => item.fips === input.selectedFips)
    : undefined;
  return finalizeInheritedContext({
    fields: {
      geography: row
        ? validatedInheritedField(
            row.fips,
            `${row.countyName}, ${row.stateName} (${row.fips})`
          )
        : absentInheritedField(),
      measure: validatedInheritedField(
        input.committed.measureId,
        input.committed.measureLabel
      ),
      period: validatedInheritedField(
        input.committed.handoffPeriod,
        input.committed.handoffPeriod
      ),
      release: validatedInheritedField(
        input.committed.releaseId,
        input.committed.releaseId
      ),
      source: sourceFieldFromEvidence(row?.evidence ?? null),
    },
    surface: "explore",
  });
}

export function inheritedContextFromInvestigate(input: {
  bundle: CountyEvidenceBundle | null;
  identity: { fips: string; label: string } | null;
  releaseId: string | null;
  releaseMismatch: boolean;
  requestedFips: string | null;
}): AskAtlasInheritedContext | null {
  const geographyReady = Boolean(
    input.identity && input.identity.fips === input.requestedFips
  );
  const releaseReady = Boolean(input.releaseId) && !input.releaseMismatch;
  const bundleReady = Boolean(
    geographyReady &&
    !input.releaseMismatch &&
    input.bundle &&
    input.bundle.county.fips === input.identity?.fips &&
    input.bundle.releaseId === input.releaseId
  );
  const lead = bundleReady ? (input.bundle?.leadFinding ?? null) : null;
  return finalizeInheritedContext({
    fields: {
      geography:
        geographyReady && input.identity
          ? validatedInheritedField(input.identity.fips, input.identity.label)
          : absentInheritedField(),
      measure: lead
        ? validatedInheritedField(lead.measureId, lead.measureLabel)
        : absentInheritedField(),
      period: inheritedPeriodField(
        bundleReady && input.bundle
          ? investigateAcceptedObservations(input.bundle)
          : []
      ),
      release:
        releaseReady && input.releaseId
          ? validatedInheritedField(input.releaseId, input.releaseId)
          : absentInheritedField(),
      source: sourceFieldFromEvidence(lead?.evidence ?? null),
    },
    surface: "investigate",
  });
}

export function inheritedContextFromAction(
  input: Parameters<typeof inheritedContextFromInvestigate>[0]
): AskAtlasInheritedContext | null {
  const context = inheritedContextFromInvestigate(input);
  if (!context) {
    return null;
  }
  return { ...context, surface: "action" };
}

function reviewSelectedCounty(
  rankedCounties: readonly ReviewCountyIdentity[],
  requestedCounty: string | null
): ReviewCountyIdentity | null {
  if (rankedCounties.length === 0) {
    return null;
  }
  if (requestedCounty) {
    const match = rankedCounties.find(
      (county) => county.fips === requestedCounty
    );
    if (match) {
      return match;
    }
  }
  return rankedCounties[0] ?? null;
}

function reviewGeographyField(
  selected: ReviewCountyIdentity
): AskAtlasInheritedField {
  const county = selected.county?.trim() ?? "";
  const stateName = selected.state_name.trim();
  if (
    !(county && stateName && isCountyFips(selected.fips)) ||
    county === REVIEW_FIELD_UNAVAILABLE
  ) {
    return absentInheritedField();
  }
  return validatedInheritedField(
    selected.fips,
    `${county}, ${stateName} (${selected.fips})`
  );
}

export function inheritedContextFromReview(input: {
  rankedCounties: readonly ReviewCountyIdentity[];
  releaseId: string | null;
  releaseReady: boolean;
  requestedCounty: string | null;
}): AskAtlasInheritedContext | null {
  if (!(input.releaseReady && input.releaseId)) {
    return null;
  }
  const selected = reviewSelectedCounty(
    input.rankedCounties,
    input.requestedCounty
  );
  return finalizeInheritedContext({
    fields: {
      geography: selected
        ? reviewGeographyField(selected)
        : absentInheritedField(),
      measure: absentInheritedField(),
      period: absentInheritedField(),
      release: validatedInheritedField(input.releaseId, input.releaseId),
      source: absentInheritedField(),
    },
    surface: "review",
  });
}

export function inheritedContextFromCompare(input: {
  alignment: CompareAlignment | null;
  alignmentReady: boolean;
  counties: readonly { fips: string; label: string }[];
  releaseId: string | null;
}): AskAtlasInheritedContext | null {
  if (!(input.alignmentReady && input.releaseId)) {
    return null;
  }
  const pair = input.counties.length === 2 ? input.counties : null;
  const pairResolved = Boolean(
    pair?.every(
      (county) =>
        isCountyFips(county.fips) &&
        county.label.trim().length > 0 &&
        !UNRESOLVED_COMPARE_COUNTY_LABEL.test(county.label)
    )
  );
  return finalizeInheritedContext({
    fields: {
      geography:
        pairResolved && pair
          ? validatedInheritedField(
              `${pair[0].fips},${pair[1].fips}`,
              `${pair[0].label} compared with ${pair[1].label}`
            )
          : absentInheritedField(),
      measure: absentInheritedField(),
      period: inheritedPeriodField(
        input.alignmentReady && input.alignment
          ? compareAcceptedObservations(input.alignment)
          : []
      ),
      release: validatedInheritedField(input.releaseId, input.releaseId),
      source: absentInheritedField(),
    },
    surface: "compare",
  });
}
