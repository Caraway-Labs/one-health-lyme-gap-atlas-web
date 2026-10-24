"use client";

import { Button } from "@/components/ui/button";
import {
  MODEL_GROUPING_INTERPRETATION,
  MODEL_GROUPING_INTRO,
  NO_RECORD_IS_NOT_ABSENCE,
  type SurveillanceIntelligencePerspectiveId,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import type {
  IntelligenceField,
  IntelligencePerspectiveView,
  SituationPlainMembership,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";

const MIN_VISIBLE_BAR_PERCENT = 0.05;

export function isSituationPerspective(
  id: SurveillanceIntelligencePerspectiveId
): boolean {
  return id === "ecological-situation" || id === "surveillance-situation";
}

function membershipBarWidth(probability: number): string {
  const percent = probability * 100;
  if (!Number.isFinite(percent) || percent < MIN_VISIBLE_BAR_PERCENT) {
    return "0%";
  }
  if (percent > 100) {
    return "100%";
  }
  return `${percent}%`;
}

function TechnicalFields({ fields }: { fields: readonly IntelligenceField[] }) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <dl className="county-summary-technical">
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MembershipRow({
  membership,
}: {
  membership: SituationPlainMembership;
}) {
  const valueText = membership.assigned
    ? `${membership.text} — Assigned group`
    : membership.text;
  return (
    <li className="county-summary-membership">
      <p className="county-summary-membership-label">
        <span>{membership.label}</span>
        <span>{valueText}</span>
      </p>
      <div aria-hidden="true" className="county-summary-membership-track">
        <div style={{ width: membershipBarWidth(membership.probability) }} />
      </div>
    </li>
  );
}

export function SituationInformation({
  onRetry,
  perspective,
  retryLabel,
  showTitle,
}: {
  onRetry: () => void;
  perspective: IntelligencePerspectiveView;
  retryLabel?: string;
  showTitle: boolean;
}) {
  const plain = perspective.situationPlain;
  const ready = perspective.kind === "ready" && plain !== null;
  return (
    <div className="county-summary-situation-copy">
      {showTitle ? (
        <p className="county-summary-popup-title">{perspective.label}</p>
      ) : null}
      <p className="county-summary-popup-copy">
        {ready ? plain.modelDescription : perspective.overview}
      </p>
      {ready ? (
        <>
          <div>
            <p className="county-summary-popup-label">Assigned group</p>
            <p className="county-summary-popup-copy">{plain.assignedLabel}</p>
          </div>
          <div>
            <p className="county-summary-popup-label">What this group means</p>
            <p className="county-summary-popup-copy">{plain.groupMeaning}</p>
          </div>
          <p className="county-summary-popup-copy">
            {NO_RECORD_IS_NOT_ABSENCE}
          </p>
          {plain.memberships ? (
            <details className="county-summary-disclosure">
              <summary>Model grouping details</summary>
              <div>
                <p className="county-summary-popup-copy">
                  {MODEL_GROUPING_INTRO}
                </p>
                <ul className="county-summary-memberships">
                  {plain.memberships.map((membership) => (
                    <MembershipRow
                      key={membership.classId}
                      membership={membership}
                    />
                  ))}
                </ul>
                <p className="county-summary-popup-copy">
                  {MODEL_GROUPING_INTERPRETATION}
                </p>
              </div>
            </details>
          ) : (
            <p className="county-summary-popup-copy">
              Group membership percentages for this model version are in
              Technical details.
            </p>
          )}
          {plain.methods.length > 0 ? (
            <div>
              <p className="county-summary-popup-label">
                Methods and source details
              </p>
              {plain.methods.map((method) => (
                <p className="county-summary-popup-copy" key={method}>
                  {method}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {perspective.retryable ? (
        <Button
          className="min-h-11 w-fit"
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          {retryLabel ?? `Retry ${perspective.label}`}
        </Button>
      ) : null}
      {perspective.fields.length > 0 ||
      perspective.disclosure.length > 0 ||
      perspective.limitations.length > 0 ? (
        <details
          className="county-summary-disclosure"
          data-testid="surveillance-intelligence-disclosure"
        >
          <summary>Technical details</summary>
          <TechnicalFields fields={perspective.fields} />
          <TechnicalFields fields={perspective.disclosure} />
          {perspective.limitations.length > 0 ? (
            <ul className="county-summary-limitations">
              {perspective.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
