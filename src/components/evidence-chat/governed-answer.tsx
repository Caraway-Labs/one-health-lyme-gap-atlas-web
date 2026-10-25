import { Fragment } from "react";

import { EvidenceChatAnswerSources } from "@/components/evidence-chat-answer-sources";
import type {
  KnowledgeChatResponse,
  StructuredAssistantResponse,
} from "@/generated/models";
import type { Coverage } from "@/generated/models/coverage";
import type { EvidenceReference } from "@/generated/models/evidenceReference";
import type { Freshness } from "@/generated/models/freshness";
import type { Observation } from "@/generated/models/observation";
import type { ToolResult } from "@/generated/models/toolResult";
import { classifyKnowledgeChatResponse } from "@/lib/ask-atlas-answer-contract";
import type { AskAtlasGovernedTurn } from "@/lib/ask-atlas-assistant-payload";

import { AssistantOutcome } from "./assistant-outcome";

export function AskAtlasGovernedAnswer({
  actionable,
  onEditQuestion,
  onRetry,
  pending,
  question,
  turn,
}: {
  actionable: boolean;
  onEditQuestion: (question: string) => void;
  onRetry: (question: string) => void;
  pending: boolean;
  question: string;
  turn: AskAtlasGovernedTurn;
}) {
  if (turn.kind === "structured") {
    return (
      <section
        aria-label="Structured Atlas response"
        className="ask-atlas-governed-answer"
        data-assistant-kind="structured"
        data-requested-source-mode={turn.response.answer.requested_source_mode}
      >
        <ResponseIdentity requestId={turn.requestId} />
        <StructuredAnswerBody response={turn.response} />
      </section>
    );
  }

  const { response } = turn;
  return (
    <section
      aria-label="Mixed Atlas response"
      className="ask-atlas-governed-answer"
      data-assistant-kind="mixed"
      data-cross-source-state={response.cross_source_state ?? "null"}
      data-requested-source-mode={response.requested_source_mode}
    >
      <ResponseIdentity requestId={turn.requestId} />
      <FieldList
        rows={[
          ["requested_source_mode", response.requested_source_mode],
          ["outcome", response.outcome],
          ["contract_version", response.contract_version ?? null],
          ["cross_source_state", response.cross_source_state],
        ]}
      />
      <SourceList
        label="actual_sources_used"
        sources={response.actual_sources_used}
      />
      <StringList label="limitations" values={response.limitations} />
      <h3>structured</h3>
      {response.structured ? (
        <div data-branch="structured" data-branch-present="true">
          <StructuredAnswerBody response={response.structured} />
        </div>
      ) : (
        <p data-branch="structured" data-branch-present="false">
          structured: null
        </p>
      )}
      <h3>literature</h3>
      {response.literature ? (
        <div data-branch="literature" data-branch-present="true">
          <LiteratureBranch
            actionable={actionable}
            onEditQuestion={onEditQuestion}
            onRetry={onRetry}
            pending={pending}
            question={question}
            response={response.literature}
          />
        </div>
      ) : (
        <p data-branch="literature" data-branch-present="false">
          literature: null
        </p>
      )}
    </section>
  );
}

function StructuredAnswerBody({
  response,
}: {
  response: StructuredAssistantResponse;
}) {
  const { answer } = response;
  return (
    <div data-outcome={answer.outcome}>
      <FieldList
        rows={[
          ["requested_source_mode", answer.requested_source_mode],
          ["outcome", answer.outcome],
          ["contract_version", answer.contract_version ?? null],
          ["cross_source_state", answer.cross_source_state ?? null],
          [
            "literature_evidence_state",
            answer.literature_evidence_state ?? null,
          ],
        ]}
      />
      <SourceList
        label="actual_sources_used"
        sources={answer.actual_sources_used ?? []}
      />
      <StringList label="limitations" values={answer.limitations ?? []} />
      <ClaimList claims={answer.claims ?? []} />
      <ReferenceList references={answer.structured_evidence_refs ?? []} />
      <FreshnessList rows={answer.freshness ?? []} />
      <CoverageList rows={answer.structured_coverage ?? []} />
      <ReplayLine
        releaseId={answer.replay?.release_id}
        routingPolicyVersion={answer.replay?.routing_policy_version}
        assistantPolicyVersion={answer.replay?.assistant_policy_version}
      />
      <ToolEvidenceList rows={response.tool_evidence ?? []} />
    </div>
  );
}

function LiteratureBranch({
  actionable,
  onEditQuestion,
  onRetry,
  pending,
  question,
  response,
}: {
  actionable: boolean;
  onEditQuestion: (question: string) => void;
  onRetry: (question: string) => void;
  pending: boolean;
  question: string;
  response: KnowledgeChatResponse;
}) {
  const decision = classifyKnowledgeChatResponse(response);
  return (
    <div>
      <FieldList
        rows={[
          ["status", response.status],
          ["evidence_state", response.evidence_state],
          ["source_used", response.source_used],
          ["request_id", response.request_id],
        ]}
      />
      {decision.kind === "grounded" ? (
        <EvidenceChatAnswerSources response={response} />
      ) : null}
      {decision.kind !== "closed" && decision.kind !== "grounded" ? (
        <p>{response.answer}</p>
      ) : null}
      {decision.kind === "closed" ? (
        <div
          className="chat-error"
          data-assistant-state="response_unverified"
          data-close-reason={decision.reason}
          role="alert"
        >
          <p>
            <strong>Response could not be verified.</strong> Evidence chat
            response could not be verified. Please try again later.
          </p>
        </div>
      ) : (
        <AssistantOutcome
          actionable={actionable}
          onEditQuestion={onEditQuestion}
          onRetry={onRetry}
          pending={pending}
          question={question}
          response={response}
        />
      )}
    </div>
  );
}

function ResponseIdentity({ requestId }: { requestId: string | null }) {
  return (
    <p data-request-id={requestId ?? "null"}>
      X-Request-ID: {requestId ?? "null"}
    </p>
  );
}

function SourceList({
  label,
  sources,
}: {
  label: string;
  sources: readonly string[];
}) {
  return (
    <div data-actual-sources-used={sources.join(",")}>
      <p>{label}</p>
      {sources.length === 0 ? (
        <p>none</p>
      ) : (
        <ul>
          {sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StringList({
  label,
  values,
}: {
  label: string;
  values: readonly string[];
}) {
  return (
    <div>
      <p>{label}</p>
      {values.length === 0 ? (
        <p>none</p>
      ) : (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClaimList({
  claims,
}: {
  claims: readonly {
    claim_id: string;
    coverage_ids?: string[];
    measure_ids?: string[];
    role?: string;
    structured_refs?: EvidenceReference[];
    text: string;
  }[];
}) {
  if (claims.length === 0) {
    return (
      <div>
        <p>claims</p>
        <p>none</p>
      </div>
    );
  }
  return (
    <ol className="chat-claim-list">
      {claims.map((claim) => (
        <li
          className="chat-claim"
          data-claim-id={claim.claim_id}
          key={claim.claim_id}
        >
          <p>{claim.text}</p>
          <FieldList
            rows={[
              ["claim_id", claim.claim_id],
              ["role", claim.role ?? null],
              ["measure_ids", (claim.measure_ids ?? []).join(", ") || null],
              ["coverage_ids", (claim.coverage_ids ?? []).join(", ") || null],
            ]}
          />
          <ReferenceList references={claim.structured_refs ?? []} />
        </li>
      ))}
    </ol>
  );
}

function ReferenceList({
  references,
}: {
  references: readonly EvidenceReference[];
}) {
  if (references.length === 0) {
    return null;
  }
  return (
    <ul aria-label="structured_evidence_refs">
      {references.map((reference) => (
        <li key={`${reference.resource_type}:${reference.resource_id}`}>
          <FieldList
            rows={[
              ["resource_type", reference.resource_type],
              ["resource_id", reference.resource_id],
              ["source_id", reference.source_id ?? null],
              ["provenance_ref", reference.provenance_ref ?? null],
              ["methodology_version", reference.methodology_version ?? null],
              ["semantic_version", reference.semantic_version ?? null],
              ["release_id", reference.release_id ?? null],
              ["uri", reference.uri ?? null],
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

function FreshnessList({ rows }: { rows: readonly Freshness[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul aria-label="freshness">
      {rows.map((row) => (
        <li key={row.observation_id}>
          <FieldList
            rows={[
              ["observation_id", row.observation_id],
              ["state", row.state ?? null],
              ["policy_id", row.policy_id ?? null],
              ["source_timestamp", row.source_timestamp ?? null],
              ["compared_at", row.compared_at ?? null],
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

function CoverageList({ rows }: { rows: readonly Coverage[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul aria-label="structured_coverage">
      {rows.map((row) => (
        <li key={row.coverage_id}>
          <FieldList
            rows={[
              ["coverage_id", row.coverage_id],
              ["state", row.state],
              ["geography_id", row.geography.geography_id],
              ["period_start", row.period_start],
              ["period_end", row.period_end],
              ["measure_id", row.measure_id],
              ["observation_id", row.observation_id],
              ["release_id", row.release_id],
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

function ReplayLine({
  assistantPolicyVersion,
  releaseId,
  routingPolicyVersion,
}: {
  assistantPolicyVersion: string | null | undefined;
  releaseId: string | null | undefined;
  routingPolicyVersion: string | null | undefined;
}) {
  return (
    <FieldList
      rows={[
        ["release_id", releaseId ?? null],
        ["routing_policy_version", routingPolicyVersion ?? null],
        ["assistant_policy_version", assistantPolicyVersion ?? null],
      ]}
    />
  );
}

function ToolEvidenceList({ rows }: { rows: readonly ToolResult[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div>
      <p>tool_evidence</p>
      <ul>
        {rows.map((row, index) => (
          <li key={`${row.tool}:${index}`}>
            <FieldList
              rows={[
                ["tool", row.tool],
                ["status", row.status],
                ["error_code", row.error_code ?? null],
                ["release_id", row.release_id ?? null],
              ]}
            />
            <ObservationList rows={row.observations ?? []} />
            <CoverageList rows={row.coverage ?? []} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ObservationList({ rows }: { rows: readonly Observation[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul aria-label="observations">
      {rows.map((row) => (
        <li key={row.observation_id}>
          <FieldList
            rows={[
              ["observation_id", row.observation_id],
              ["geography_id", row.geography.geography_id],
              ["period_start", row.period_start],
              ["period_end", row.period_end],
              ["measure_id", row.measure_id],
              ["value", row.value],
              ["value_state", row.value_state],
              ["unit", row.unit],
              ["source_id", row.source_id],
              ["methodology_id", row.methodology_id ?? null],
              ["methodology_version", row.methodology_version],
              ["release_id", row.release_id],
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

function FieldList({
  rows,
}: {
  rows: readonly (readonly [string, unknown])[];
}) {
  const visible = rows.flatMap(([label, value]) => {
    const text = primitiveText(value);
    if (text === null) {
      return [];
    }
    return [[label, text] as const];
  });
  if (visible.length === 0) {
    return null;
  }
  return (
    <dl>
      {visible.map(([label, text]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{text}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function primitiveText(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return "null";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return null;
}
