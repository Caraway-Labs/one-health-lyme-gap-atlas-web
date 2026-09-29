import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import type { PeopleReviewedHandoff } from "@/features/ux-lab/people-plus-workspace/handoff-content";
import {
  PEOPLE_OUTREACH_PREVIEW_PATH,
  PEOPLE_PRO_EVIDENCE_PATH,
  peopleHandoffClinicianHref,
  peopleHandoffPublicEducationHref,
} from "@/features/ux-lab/people-plus-workspace/paths";

type HandoffContextBannerProps = {
  handoff: PeopleReviewedHandoff;
  variant: "education" | "clinicians";
};

export function HandoffContextBanner({
  handoff,
  variant,
}: HandoffContextBannerProps) {
  const artifactLabel =
    variant === "education"
      ? handoff.publicExplanation.headline
      : handoff.clinicianPackage.headline;

  return (
    <aside
      aria-labelledby="people-handoff-context-title"
      className="people-plus-handoff-banner"
    >
      <div className="people-plus-handoff-banner-head">
        <Badge variant="secondary">{handoff.humanReview.statusLabel}</Badge>
        <h2 className="type-card" id="people-handoff-context-title">
          Reviewed outreach context travels with this page
        </h2>
      </div>
      <p className="type-body">
        You opened a {variant === "education" ? "public" : "clinician"}{" "}
        destination from the outreach preview. Geography, evidence period,
        sources, limitations, and the human-approval boundary stay visible so
        this does not feel like a separate website.
      </p>
      <dl className="people-plus-meta">
        <div>
          <dt>Geography</dt>
          <dd>
            {handoff.geography.name}, {handoff.geography.region} (
            {handoff.geography.kind})
          </dd>
        </div>
        <div>
          <dt>Evidence period</dt>
          <dd>{handoff.evidencePeriod}</dd>
        </div>
        <div>
          <dt>Human review</dt>
          <dd>
            {handoff.humanReview.approverLabel}. {handoff.humanReview.approvedAt}
          </dd>
        </div>
        <div>
          <dt>Publishable boundary</dt>
          <dd>{handoff.humanReview.approvalBoundary}</dd>
        </div>
      </dl>
      <p className="type-small">{handoff.limitations}</p>
      <Card>
        <CardHeader>
          <h3 className="type-card">{artifactLabel}</h3>
          <CardDescription>
            Sample reviewed artifact body for this destination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="type-body">
            {variant === "education"
              ? handoff.publicExplanation.summary
              : handoff.clinicianPackage.summary}
          </p>
          {variant === "clinicians" ? (
            <p className="type-small">{handoff.clinicianPackage.resourceShelfNote}</p>
          ) : null}
        </CardContent>
      </Card>
      <nav aria-label="Handoff trace" className="people-plus-handoff-trace">
        <Link href={PEOPLE_PRO_EVIDENCE_PATH}>Back to evidence review</Link>
        <Link href={PEOPLE_OUTREACH_PREVIEW_PATH}>Back to outreach preview</Link>
        {variant === "education" ? (
          <Link href={peopleHandoffClinicianHref(handoff.id)}>
            Open clinician package with the same context
          </Link>
        ) : (
          <Link href={peopleHandoffPublicEducationHref(handoff.id)}>
            Open public explanation with the same context
          </Link>
        )}
      </nav>
    </aside>
  );
}
