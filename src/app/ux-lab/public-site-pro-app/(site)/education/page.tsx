import type { Metadata } from "next";

import { SampleTopicCards } from "@/features/ux-lab/public-site-pro-app/sample-topic-cards";

export const metadata: Metadata = {
  title: "Education and local context",
};

export default function PublicEducationPage() {
  return (
    <>
      <header>
        <p className="eyebrow">Public site</p>
        <h1 className="type-page">Education and local context</h1>
        <p className="type-body ux-lab-public-lead">
          These headings show how public education could be organized. They stay
          on the public site. Sample County is a fictional stand-in for a
          location-shaped layout.
        </p>
      </header>
      <SampleTopicCards audience="public" />
    </>
  );
}
