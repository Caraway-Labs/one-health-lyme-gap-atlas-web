import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EvidenceReviewDetails } from "@/features/ux-lab/people-plus-workspace/evidence-review-details";
import { PEOPLE_REVIEWED_HANDOFF } from "@/features/ux-lab/people-plus-workspace/handoff-content";
import {
  PEOPLE_PRO_EVIDENCE_PATH,
  PEOPLE_WORKSPACE_PATH,
  peopleHandoffClinicianHref,
  peopleHandoffPublicEducationHref,
} from "@/features/ux-lab/people-plus-workspace/paths";

export const metadata: Metadata = {
  title: "Outreach resource preview",
};

const publicClassName = buttonVariants({ variant: "default" });
const clinicianClassName = buttonVariants({ variant: "outline" });
const workspaceClassName = buttonVariants({ variant: "outline" });

export default function PeopleOutreachPreviewPage() {
  const handoff = PEOPLE_REVIEWED_HANDOFF;

  return (
    <>
      <header>
        <p className="eyebrow">Reviewed handoff preview</p>
        <h1 className="type-page">Outreach and resource package preview</h1>
        <p className="type-body people-plus-lead">
          This page stands in for what an epidemiology team would review before
          any public explanation or clinician package is treated as publishable.
          It is mock content only—no automated publishing runs here.
        </p>
      </header>

      <aside className="people-plus-handoff-banner people-plus-handoff-banner-public">
        <Badge variant="secondary">{handoff.humanReview.statusLabel}</Badge>
        <p className="type-body">{handoff.humanReview.approvalBoundary}</p>
        <p className="type-small">
          {handoff.humanReview.approverLabel}. {handoff.humanReview.approvedAt}
        </p>
      </aside>

      <section aria-labelledby="people-outreach-artifacts">
        <h2 className="type-section" id="people-outreach-artifacts">
          Reviewed artifacts (sample)
        </h2>
        <div className="people-plus-path-grid">
          <Card>
            <CardHeader>
              <h3 className="type-card">
                {handoff.publicExplanation.headline}
              </h3>
              <CardDescription>{handoff.evidencePeriod}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="type-body">{handoff.publicExplanation.summary}</p>
              <Link
                className={publicClassName}
                href={peopleHandoffPublicEducationHref(handoff.id)}
              >
                Continue to public education view
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="type-card">{handoff.clinicianPackage.headline}</h3>
              <CardDescription>
                {handoff.clinicianPackage.resourceShelfNote}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="type-body">{handoff.clinicianPackage.summary}</p>
              <Link
                className={clinicianClassName}
                href={peopleHandoffClinicianHref(handoff.id)}
              >
                Continue to clinician resource view
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="people-outreach-context">
        <h2 className="type-section" id="people-outreach-context">
          Context that must survive the handoff
        </h2>
        <EvidenceReviewDetails />
      </section>

      <nav aria-label="Workspace trace" className="people-plus-handoff-trace">
        <Link className={workspaceClassName} href={PEOPLE_PRO_EVIDENCE_PATH}>
          Back to evidence review
        </Link>
        <Link className={workspaceClassName} href={PEOPLE_WORKSPACE_PATH}>
          Workspace overview
        </Link>
      </nav>
    </>
  );
}
