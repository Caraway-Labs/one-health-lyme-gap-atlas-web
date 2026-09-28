import Link from "next/link";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  CLINICAL_RESOURCES,
  otherThreeLaneItems,
  threeLaneItemPath,
  threeLanesSampleNotice,
  type ClinicalResource,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesFrame } from "@/features/ux-lab/three-lanes/lane-nav";
import { SharedLaneLinks } from "@/features/ux-lab/three-lanes/shared-links";

export function ClinicalLanePage() {
  return (
    <ThreeLanesFrame current="clinical">
      <main className="three-lanes-main">
        <header className="three-lanes-catalog-header">
          <p className="eyebrow">Clinical Resources</p>
          <h1 className="type-page">Find professional resources</h1>
          <p className="type-body">
            Browse sample listings. Source and freshness labels sit on every
            card so a reader can see who published the placeholder and how
            current the label is.
          </p>
          <AtlasDataStamp label="Sample catalog cue">
            {threeLanesSampleNotice("clinical")}
          </AtlasDataStamp>
        </header>
        <aside className="three-lanes-boundary">
          <h2 className="type-card">Listings, not patient-specific advice</h2>
          <p className="type-body">
            These cards describe where professional materials could be found.
            They are not instructions for a specific patient.
          </p>
        </aside>
        <ul className="three-lanes-catalog">
          {CLINICAL_RESOURCES.map((resource) => (
            <li key={resource.id}>
              <ClinicalResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      </main>
    </ThreeLanesFrame>
  );
}

export function ClinicalResourcePage({
  resource,
}: {
  resource: ClinicalResource;
}) {
  const others = otherThreeLaneItems("clinical", resource.id).filter(
    (item) => item.kind === "clinical"
  );

  return (
    <ThreeLanesFrame current="clinical">
      <main className="three-lanes-main three-lanes-main-catalog">
        <header className="three-lanes-catalog-header">
          <p className="eyebrow">Clinical Resources</p>
          <h1 className="type-page">{resource.title}</h1>
          <p className="type-body">{resource.summary}</p>
          {resource.shared ? (
            <Badge variant="secondary">Shared across lanes</Badge>
          ) : null}
        </header>
        <Card>
          <CardHeader>
            <h2 className="type-card">Source and freshness</h2>
            <CardDescription>
              Trust cues for this listing. Both labels are sample text for the
              prototype layout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="three-lanes-meta">
              <div>
                <dt>Source</dt>
                <dd>{resource.source}</dd>
              </div>
              <div>
                <dt>Freshness</dt>
                <dd>{resource.freshness}</dd>
              </div>
            </dl>
            <AtlasDataStamp label="Sample source and freshness">
              {resource.source}. {resource.freshness}
            </AtlasDataStamp>
          </CardContent>
        </Card>
        <aside className="three-lanes-boundary">
          <h2 className="type-card">How to read this listing</h2>
          <p className="type-body">{resource.boundary}</p>
        </aside>
        <SharedLaneLinks current="clinical" links={resource.related} />
        {others.length > 0 ? (
          <nav
            aria-label="More clinical resources"
            className="three-lanes-more"
          >
            <h2 className="type-card">More in Clinical Resources</h2>
            <ul>
              {others.map((item) => (
                <li key={item.id}>
                  <Link
                    className="three-lanes-text-link"
                    href={threeLaneItemPath("clinical", item.id)}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </main>
    </ThreeLanesFrame>
  );
}

function ClinicalResourceCard({ resource }: { resource: ClinicalResource }) {
  return (
    <Card className="three-lanes-resource-card">
      <CardHeader>
        {resource.shared ? (
          <Badge variant="secondary">Shared across lanes</Badge>
        ) : null}
        <h2 className="type-card">
          <Link
            className="three-lanes-text-link"
            href={threeLaneItemPath("clinical", resource.id)}
          >
            {resource.title}
          </Link>
        </h2>
        <CardDescription>{resource.summary}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="three-lanes-meta">
          <div>
            <dt>Source</dt>
            <dd>{resource.source}</dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>{resource.freshness}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
