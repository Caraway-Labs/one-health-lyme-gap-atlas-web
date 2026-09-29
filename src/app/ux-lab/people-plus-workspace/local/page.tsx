import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { PEOPLE_SAMPLE_PLACE } from "@/features/ux-lab/people-plus-workspace/content";

export const metadata: Metadata = {
  title: "Local context",
};

export default function PeopleLocalContextPage() {
  const place = PEOPLE_SAMPLE_PLACE;

  return (
    <>
      <header>
        <p className="eyebrow">Local context</p>
        <h1 className="type-page">Place-shaped public information</h1>
        <p className="type-body people-plus-lead">
          Geography is available without dominating the front door. This sample
          page shows how a fictional county could anchor community-facing
          context separate from the professional workspace.
        </p>
      </header>
      <article
        aria-labelledby="people-local-place"
        className="people-plus-local-card"
      >
        <div>
          <p className="eyebrow">Sample geography</p>
          <h2 className="type-card" id="people-local-place">
            {place.name}
          </h2>
          <p className="type-body">
            {place.kind} in {place.region}
          </p>
        </div>
        <Badge variant="outline">Sample data</Badge>
        <p className="type-body">{place.summary}</p>
        <p className="type-small">
          Schematic place marker only. Not a surveillance map or incidence
          statement.
        </p>
      </article>
    </>
  );
}
