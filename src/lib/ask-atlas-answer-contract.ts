import type { KnowledgeChatResponse } from "@/generated/models";
import type { KnowledgeCitation } from "@/generated/models/knowledgeCitation";
import { KnowledgeGraphChatV1KnowledgeGraphChatPostResponse } from "@/generated/zod/atlas";

/**
 * Literature chat is the shipped Ask Atlas response.
 * Structured and Both are not rendered from this contract.
 * Live comparison states deferred by the mixed-assistant comparison work are rejected.
 */
export const LITERATURE_SOURCE_USED = "literature_evidence" as const;

export const LITERATURE_SOURCE_LABEL = "Literature evidence";

const DEFERRED_COMPARISON_STATES = new Set([
  "aligned",
  "partially_aligned",
  "discordant",
]);

const UNSUPPORTED_SOURCE_MODES = new Set(["Structured", "Both"]);

const EVIDENCE_COPY = {
  conflicting: {
    detail: "Conflicting evidence",
    summary: "Conflicting",
  },
  consistent: {
    detail: "Consistent evidence",
    summary: "Consistent",
  },
  insufficient_to_compare: {
    detail: "Insufficient evidence to compare",
    summary: "Insufficient to compare",
  },
  limited: {
    detail: "Limited evidence",
    summary: "Limited",
  },
  mixed: {
    detail: "Mixed evidence",
    summary: "Mixed",
  },
  single_study: {
    detail: "Single-study evidence",
    summary: "Single-study",
  },
} as const;

type AnsweredEvidenceState = keyof typeof EVIDENCE_COPY;

export type AskAtlasCloseReason =
  | "malformed"
  | "missing_citation"
  | "mismatched_source"
  | "partial"
  | "unsupported_comparison"
  | "unsupported_source";

export type AskAtlasAnswerDecision =
  | {
      citations: KnowledgeCitation[];
      evidenceLabel: string;
      evidenceState: AnsweredEvidenceState;
      evidenceSummary: string;
      kind: "grounded";
      sourceLabel: string;
      sourceUsed: typeof LITERATURE_SOURCE_USED;
    }
  | { kind: "corpus_gap" }
  | { kind: "service_unavailable" }
  | { kind: "capacity_limited" }
  | { kind: "safety_refusal" }
  | { kind: "closed"; reason: AskAtlasCloseReason };

export type AskAtlasPayloadResult =
  | { ok: true; response: KnowledgeChatResponse }
  | { ok: false; reason: AskAtlasCloseReason | "not_chat_response" };

export class AskAtlasAnswerContractError extends Error {
  readonly reason: AskAtlasCloseReason;

  constructor(reason: AskAtlasCloseReason) {
    super(
      "Evidence chat response could not be verified. Please try again later."
    );
    this.name = "AskAtlasAnswerContractError";
    this.reason = reason;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function unsupportedRawSignal(
  raw: Record<string, unknown>
): AskAtlasCloseReason | null {
  if (
    typeof raw.evidence_state === "string" &&
    DEFERRED_COMPARISON_STATES.has(raw.evidence_state)
  ) {
    return "unsupported_comparison";
  }
  if (
    typeof raw.cross_source_state === "string" &&
    DEFERRED_COMPARISON_STATES.has(raw.cross_source_state)
  ) {
    return "unsupported_comparison";
  }
  if ("source_used" in raw && raw.source_used !== LITERATURE_SOURCE_USED) {
    return "unsupported_source";
  }
  if (
    typeof raw.requested_source_mode === "string" &&
    UNSUPPORTED_SOURCE_MODES.has(raw.requested_source_mode)
  ) {
    return "unsupported_source";
  }
  if ("actual_sources_used" in raw) {
    const sources = raw.actual_sources_used;
    if (
      !Array.isArray(sources) ||
      sources.length === 0 ||
      sources.some((item) => item !== LITERATURE_SOURCE_USED)
    ) {
      return "unsupported_source";
    }
  }
  return null;
}

function reportedSourceLabel(rawCitation: unknown): string | null {
  const record = asRecord(rawCitation);
  if (!record || typeof record.source_label !== "string") {
    return null;
  }
  const label = record.source_label.trim();
  return label.length > 0 ? record.source_label : null;
}

function citationAsReported(
  citation: KnowledgeCitation,
  rawCitation: unknown
): KnowledgeCitation {
  const reported = reportedSourceLabel(rawCitation);
  const { source_label: _defaultedLabel, ...rest } = citation;
  if (!reported) {
    return rest;
  }
  return { ...rest, source_label: reported };
}

function citationsAsReported(
  raw: unknown,
  response: KnowledgeChatResponse
): KnowledgeChatResponse {
  if (!response.citations) {
    return response;
  }
  const record = asRecord(raw);
  const rawCitations = Array.isArray(record?.citations) ? record.citations : [];
  const rawById = new Map<string, unknown>();
  for (const item of rawCitations) {
    const citation = asRecord(item);
    if (citation && typeof citation.citation_id === "string") {
      rawById.set(citation.citation_id, item);
    }
  }
  return {
    ...response,
    citations: response.citations.map((citation) =>
      citationAsReported(citation, rawById.get(citation.citation_id))
    ),
  };
}

function sameMembers(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const member of left) {
    if (!right.has(member)) {
      return false;
    }
  }
  return true;
}

function groundedCitations(
  response: KnowledgeChatResponse
):
  | { citations: KnowledgeCitation[]; ok: true }
  | { ok: false; reason: AskAtlasCloseReason } {
  const answer = response.answer.trim();
  const claims = response.claims ?? [];
  const citations = response.citations ?? [];
  if (!answer) {
    return { ok: false, reason: "partial" };
  }
  if (claims.length === 0 || citations.length === 0) {
    return { ok: false, reason: "missing_citation" };
  }

  const citationById = new Map<string, KnowledgeCitation>();
  for (const citation of citations) {
    if (
      !citation.citation_id.trim() ||
      !citation.pmid.trim() ||
      !citation.title.trim()
    ) {
      return { ok: false, reason: "partial" };
    }
    if (citationById.has(citation.citation_id)) {
      return { ok: false, reason: "mismatched_source" };
    }
    citationById.set(citation.citation_id, citation);
  }

  const referencedClaimIds = new Map<string, Set<string>>();
  const seenClaims = new Set<string>();
  for (const claim of claims) {
    if (!claim.claim_id.trim() || !claim.text.trim()) {
      return { ok: false, reason: "partial" };
    }
    if (seenClaims.has(claim.claim_id)) {
      return { ok: false, reason: "mismatched_source" };
    }
    seenClaims.add(claim.claim_id);
    const citationIds = new Set(claim.citation_ids);
    if (citationIds.size === 0) {
      return { ok: false, reason: "missing_citation" };
    }
    for (const citationId of citationIds) {
      if (!citationById.has(citationId)) {
        return { ok: false, reason: "missing_citation" };
      }
      const claimsForCitation =
        referencedClaimIds.get(citationId) ?? new Set<string>();
      claimsForCitation.add(claim.claim_id);
      referencedClaimIds.set(citationId, claimsForCitation);
    }
  }

  if (referencedClaimIds.size !== citationById.size) {
    return { ok: false, reason: "mismatched_source" };
  }

  for (const [citationId, claimIds] of referencedClaimIds) {
    const citation = citationById.get(citationId);
    if (!citation) {
      return { ok: false, reason: "missing_citation" };
    }
    if (!sameMembers(claimIds, new Set(citation.claim_ids))) {
      return { ok: false, reason: "mismatched_source" };
    }
  }

  const ordered: KnowledgeCitation[] = [];
  const seenCitations = new Set<string>();
  for (const claim of claims) {
    for (const citationId of claim.citation_ids) {
      if (seenCitations.has(citationId)) {
        continue;
      }
      const citation = citationById.get(citationId);
      if (!citation) {
        return { ok: false, reason: "missing_citation" };
      }
      seenCitations.add(citationId);
      ordered.push(citation);
    }
  }
  // The literature service sets answer to the claim texts joined by a blank line.
  if (response.answer !== claims.map((claim) => claim.text).join("\n\n")) {
    return { ok: false, reason: "partial" };
  }
  return { citations: ordered, ok: true };
}

function answeredEvidenceState(
  state: KnowledgeChatResponse["evidence_state"]
): AnsweredEvidenceState | null {
  switch (state) {
    case "single_study":
    case "consistent":
    case "limited":
    case "mixed":
    case "conflicting":
    case "insufficient_to_compare": {
      return state;
    }
    case "no_relevant_corpus_evidence":
    case "evidence_unavailable":
    case "not_applicable": {
      return null;
    }
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
}

function classifyAnswered(
  response: KnowledgeChatResponse
): AskAtlasAnswerDecision {
  switch (response.source_used) {
    case "literature_evidence": {
      break;
    }
    default: {
      const unhandled: never = response.source_used;
      return unhandled;
    }
  }
  const evidenceState = answeredEvidenceState(response.evidence_state);
  if (!evidenceState) {
    return { kind: "closed", reason: "partial" };
  }
  const grounded = groundedCitations(response);
  if (!grounded.ok) {
    return { kind: "closed", reason: grounded.reason };
  }
  const copy = EVIDENCE_COPY[evidenceState];
  return {
    citations: grounded.citations,
    evidenceLabel: copy.detail,
    evidenceState,
    evidenceSummary: copy.summary,
    kind: "grounded",
    sourceLabel: LITERATURE_SOURCE_LABEL,
    sourceUsed: response.source_used,
  };
}

function hasAnswerText(response: KnowledgeChatResponse): boolean {
  return response.answer.trim().length > 0;
}

export function classifyKnowledgeChatResponse(
  response: KnowledgeChatResponse
): AskAtlasAnswerDecision {
  switch (response.status) {
    case "answered": {
      return classifyAnswered(response);
    }
    case "no_evidence": {
      if (
        response.evidence_state === "no_relevant_corpus_evidence" &&
        hasAnswerText(response)
      ) {
        return { kind: "corpus_gap" };
      }
      return { kind: "closed", reason: "partial" };
    }
    case "evidence_unavailable": {
      if (
        response.evidence_state === "evidence_unavailable" &&
        hasAnswerText(response)
      ) {
        return { kind: "service_unavailable" };
      }
      return { kind: "closed", reason: "partial" };
    }
    case "capacity_limited": {
      if (
        response.evidence_state === "not_applicable" &&
        hasAnswerText(response)
      ) {
        return { kind: "capacity_limited" };
      }
      return { kind: "closed", reason: "partial" };
    }
    case "safety_refusal": {
      if (
        response.evidence_state === "not_applicable" &&
        hasAnswerText(response)
      ) {
        return { kind: "safety_refusal" };
      }
      return { kind: "closed", reason: "partial" };
    }
    default: {
      const unhandled: never = response.status;
      return unhandled;
    }
  }
}

export function acceptAskAtlasPayload(raw: unknown): AskAtlasPayloadResult {
  const record = asRecord(raw);
  if (!record) {
    return { ok: false, reason: "not_chat_response" };
  }
  const unsupported = unsupportedRawSignal(record);
  if (unsupported) {
    return { ok: false, reason: unsupported };
  }
  const parsed =
    KnowledgeGraphChatV1KnowledgeGraphChatPostResponse.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "not_chat_response" };
  }
  const response = citationsAsReported(raw, {
    ...parsed.data,
    conversation_token: undefined,
  });
  const decision = classifyKnowledgeChatResponse(response);
  if (decision.kind === "closed") {
    return { ok: false, reason: decision.reason };
  }
  return { ok: true, response };
}
