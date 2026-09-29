import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EvidenceReviewDetails } from "@/features/ux-lab/people-plus-workspace/evidence-review-details";
import { PEOPLE_REVIEWED_HANDOFF } from "@/features/ux-lab/people-plus-workspace/handoff-content";
import { PEOPLE_OUTREACH_PREVIEW_PATH } from "@/features/ux-lab/people-plus-workspace/paths";

export const metadata: Metadata = {
  title: "Evidence review",
};

const previewClassName = buttonVariants({ variant: "default" });

export default function PeopleEvidenceReviewPage() {
  const review = PEOPLE_REVIEWED_HANDOFF;

  return (
    <>
      <header>
        <p className="eyebrow">Professional workspace</p>
        <h1>County evidence review</h1>
        <p className="type-body">
          Representative review state for {review.geography.name}. Labels,
          sources, and uncertainty cues are sample copy only—they do not
          classify places or report live findings.
        </p>
      </header>
      <EvidenceReviewDetails />
      <Card className="people-plus-human-review-card">
        <CardHeader>
          <Badge variant="secondary">{review.humanReview.statusLabel}</Badge>
          <h2 className="type-card">Before outreach is publishable</h2>
          <CardDescription>
            {review.humanReview.approverLabel}. {review.humanReview.approvedAt}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="type-body">{review.humanReview.approvalBoundary}</p>
          <Link className={previewClassName} href={PEOPLE_OUTREACH_PREVIEW_PATH}>
            Open reviewed outreach preview
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
