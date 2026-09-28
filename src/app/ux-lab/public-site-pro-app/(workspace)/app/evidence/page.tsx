import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { UX_LAB_SAMPLE_TOPICS } from "@/features/ux-lab/prototype-contract";

export const metadata: Metadata = {
  title: "Evidence review",
};

export default function EvidenceReviewPage() {
  const evidence = UX_LAB_SAMPLE_TOPICS.find(
    (topic) => topic.id === "evidence-summary"
  );

  return (
    <>
      <header>
        <p className="eyebrow">Professional application</p>
        <h1>Evidence review</h1>
        <p className="type-body">
          A denser review layout for public-health users. The summary below is a
          sample label. It does not classify places or report findings.
        </p>
      </header>
      <Card>
        <CardHeader>
          <h2 className="type-card">{evidence?.title}</h2>
          <CardDescription>Sample layout only</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="type-body">{evidence?.summary}</p>
        </CardContent>
      </Card>
    </>
  );
}
