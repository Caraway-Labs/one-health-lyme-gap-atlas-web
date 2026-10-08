"use client";

import { useId } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import {
  presentTier1SurveillancePriority,
  sufficiencyLabel,
  TIER1_FAILED_MESSAGE,
  TIER1_HEADING,
  TIER1_LIMITATION,
  TIER1_MODEL_ASSISTED_LABEL,
  TIER1_REASON_ABSENCE,
  TIER1_REGION_LABEL,
  TIER1_STALE_MESSAGE,
  TIER1_SUPPORT_NOTE,
  TIER1_UNAVAILABLE_MESSAGE,
  type Tier1ModelDetails,
  type Tier1ReasonDisplay,
  type Tier1SurveillancePriorityView,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { useTier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/use-tier1-surveillance-priority";
import { AtlasApiError } from "@/lib/api-mutator";

import "./surveillance-priority.css";

type HeadingLevel = "h2" | "h3";

function queryStatus(query: {
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
}): "error" | "loading" | "success" {
  if (query.isPending) {
    return "loading";
  }
  if (query.isError) {
    return "error";
  }
  if (query.isSuccess) {
    return "success";
  }
  return "loading";
}

export function Tier1SurveillancePriority({
  fips,
  headingLevel = "h2",
}: {
  fips: string;
  headingLevel?: HeadingLevel;
}) {
  const query = useTier1SurveillancePriority(fips);
  const status = queryStatus(query);
  const view = presentTier1SurveillancePriority({
    errorStatus:
      query.error instanceof AtlasApiError ? query.error.status : null,
    requestedFips: fips,
    result: status === "success" ? (query.data ?? null) : null,
    status,
  });
  return (
    <Tier1SurveillancePriorityPanel headingLevel={headingLevel} view={view} />
  );
}

export function Tier1SurveillancePriorityPanel({
  headingLevel,
  view,
}: {
  headingLevel: HeadingLevel;
  view: Tier1SurveillancePriorityView;
}) {
  const titleId = useId();
  const Heading = headingLevel;
  return (
    <section
      aria-label={TIER1_REGION_LABEL}
      className="ux-reset-model-signal"
      data-fips={view.fips}
      data-signal="model-assisted"
      data-state={view.kind}
      data-sufficiency={viewSufficiency(view)}
      data-testid="tier1-surveillance-priority"
      data-tier={view.kind === "result" ? view.tier : undefined}
    >
      <div className="ux-reset-model-signal-heading">
        <Badge variant="outline">{TIER1_MODEL_ASSISTED_LABEL}</Badge>
        <Heading className="type-card" id={titleId}>
          {TIER1_HEADING}
        </Heading>
      </div>
      <Tier1SurveillancePriorityBody view={view} />
    </section>
  );
}

function Tier1SurveillancePriorityBody({
  view,
}: {
  view: Tier1SurveillancePriorityView;
}) {
  switch (view.kind) {
    case "loading": {
      return (
        <AtlasStatusMessage tone="loading">
          Loading model-assisted surveillance priority…
        </AtlasStatusMessage>
      );
    }
    case "unavailable": {
      return (
        <AtlasStatusMessage tone="empty">
          {TIER1_UNAVAILABLE_MESSAGE}
        </AtlasStatusMessage>
      );
    }
    case "failed": {
      return (
        <AtlasStatusMessage tone="error">
          {TIER1_FAILED_MESSAGE}
        </AtlasStatusMessage>
      );
    }
    case "stale": {
      return (
        <AtlasStatusMessage tone="error">
          {TIER1_STALE_MESSAGE}
        </AtlasStatusMessage>
      );
    }
    case "not-estimable": {
      return (
        <Tier1ReturnedPriority
          details={view.details}
          reasons={view.reasons}
          sufficiencyLabelText={sufficiencyLabel("NOT_ESTIMABLE")}
          tierLabel="Not returned"
        />
      );
    }
    case "result": {
      return (
        <Tier1ReturnedPriority
          details={view.details}
          reasons={view.reasons}
          sufficiencyLabelText={sufficiencyLabel(view.sufficiency)}
          tierLabel={view.tier}
        />
      );
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

function viewSufficiency(
  view: Tier1SurveillancePriorityView
): string | undefined {
  switch (view.kind) {
    case "result": {
      return view.sufficiency;
    }
    case "not-estimable": {
      return "NOT_ESTIMABLE";
    }
    case "loading":
    case "unavailable":
    case "failed":
    case "stale": {
      return undefined;
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

function Tier1ReturnedPriority({
  details,
  reasons,
  sufficiencyLabelText,
  tierLabel,
}: {
  details: Tier1ModelDetails;
  reasons: readonly Tier1ReasonDisplay[];
  sufficiencyLabelText: string;
  tierLabel: string;
}) {
  return (
    <>
      <dl className="ux-reset-model-signal-facts">
        <div>
          <dt>Priority tier</dt>
          <dd className="type-card" data-testid="tier1-priority-tier">
            {tierLabel}
          </dd>
        </div>
        <div>
          <dt>Evidence sufficiency</dt>
          <dd data-testid="tier1-evidence-sufficiency">
            {sufficiencyLabelText}
          </dd>
        </div>
      </dl>
      {reasons.length > 0 ? (
        <ul
          aria-label="Contributing reasons"
          className="ux-reset-model-signal-reasons"
        >
          {reasons.map((reason) => (
            <li
              data-reason-code={reason.code}
              key={`${reason.code}:${reason.text}`}
            >
              {reason.text}
            </li>
          ))}
        </ul>
      ) : (
        <p data-testid="tier1-reasons-absent">{TIER1_REASON_ABSENCE}</p>
      )}
      <p className="type-small ux-reset-model-signal-support">
        {TIER1_SUPPORT_NOTE}
      </p>
      <p
        className="type-small ux-reset-model-signal-limitation"
        data-testid="tier1-limitation"
      >
        {TIER1_LIMITATION}
      </p>
      <Tier1ModelDetailsDisclosure details={details} />
    </>
  );
}

function Tier1ModelDetailsDisclosure({
  details,
}: {
  details: Tier1ModelDetails;
}) {
  return (
    <details
      className="ux-reset-model-signal-details"
      data-testid="tier1-model-details"
    >
      <summary>Model and as-of details</summary>
      <dl>
        <div>
          <dt>Model</dt>
          <dd>{details.modelVersion}</dd>
        </div>
        <div>
          <dt>Batch generated</dt>
          <dd>{details.generatedAtLabel}</dd>
        </div>
        <div>
          <dt>Prediction batch</dt>
          <dd>{details.predictionBatchVersion}</dd>
        </div>
        <div>
          <dt>Tier policy</dt>
          <dd>{details.tierPolicyVersion}</dd>
        </div>
        <div>
          <dt>Within-batch percentile</dt>
          <dd>{details.percentileLabel}</dd>
        </div>
        <div>
          <dt>Model-native score</dt>
          <dd>{details.rawScoreLabel}</dd>
        </div>
        <div>
          <dt>Release</dt>
          <dd>{details.releaseId}</dd>
        </div>
        <div>
          <dt>Source commit</dt>
          <dd>{details.sourceCommit}</dd>
        </div>
        <div>
          <dt>Limitation reference</dt>
          <dd>{details.limitationRef}</dd>
        </div>
      </dl>
      <p className="type-small ux-reset-model-signal-details-note">
        Batch generated time is the model batch, not the request time.
        Percentile is relative to this batch and population. The model-native
        score is not predicted incidence.
      </p>
    </details>
  );
}
