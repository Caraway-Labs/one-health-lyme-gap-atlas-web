import type { Metadata } from "next";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { PEOPLE_CLINICIAN_RESOURCES } from "@/features/ux-lab/people-plus-workspace/content";

export const metadata: Metadata = {
  title: "Clinician resources",
};

export default function PeopleCliniciansPage() {
  return (
    <>
      <header>
        <p className="eyebrow">Clinician resources</p>
        <h1 className="type-page">
          Professional materials without the workspace
        </h1>
        <p className="type-body people-plus-lead">
          Clinicians can scan sample listings in the same lighter shell as
          public education. Every card carries source, freshness, and
          applicability cues so readers can judge whether a placeholder resource
          fits their setting.
        </p>
        <AtlasDataStamp label="Sample catalog cue">
          Listings are layout samples. They are not clinical guidance and do not
          start a reporting workflow.
        </AtlasDataStamp>
      </header>

      <aside className="people-plus-boundary">
        <h2 className="type-card">Surveillance context is not patient care</h2>
        <p className="type-body">
          Materials here describe where professional resources could live.
          Community surveillance and individual clinical decisions stay in
          separate lanes in this concept.
        </p>
      </aside>

      <ul className="people-plus-resource-list">
        {PEOPLE_CLINICIAN_RESOURCES.map((resource) => (
          <li key={resource.id}>
            <Card>
              <CardHeader>
                <Badge variant="secondary">Sample listing</Badge>
                <h2 className="type-card">{resource.title}</h2>
                <CardDescription>{resource.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="people-plus-meta">
                  <div>
                    <dt>Source</dt>
                    <dd>{resource.source}</dd>
                  </div>
                  <div>
                    <dt>Freshness</dt>
                    <dd>{resource.freshness}</dd>
                  </div>
                  <div>
                    <dt>Applicability</dt>
                    <dd>{resource.applicability}</dd>
                  </div>
                </dl>
                <p className="type-small">{resource.boundary}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
