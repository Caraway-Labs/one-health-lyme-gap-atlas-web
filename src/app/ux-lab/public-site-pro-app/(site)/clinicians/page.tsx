import type { Metadata } from "next";

import { SampleTopicCards } from "@/features/ux-lab/public-site-pro-app/sample-topic-cards";

export const metadata: Metadata = {
  title: "Clinician resources",
};

export default function ClinicianResourcesPage() {
  return (
    <>
      <header>
        <p className="eyebrow">Public site</p>
        <h1 className="type-page">Clinician resources</h1>
        <p className="type-body ux-lab-public-lead">
          Clinicians find resource lists on this public site, in the same
          simpler shell as education topics. These cards are sample labels for
          layout only. They are not clinical guidance and do not start a
          reporting workflow.
        </p>
      </header>
      <SampleTopicCards audience="clinician" />
    </>
  );
}
