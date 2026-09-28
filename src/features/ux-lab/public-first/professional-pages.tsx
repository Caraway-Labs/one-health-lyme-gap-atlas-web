import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  PUBLIC_FIRST_CLINICAL_CARDS,
  PUBLIC_FIRST_SAMPLE_NOTICE,
  PUBLIC_FIRST_SURVEILLANCE_MODULES,
  publicFirstHref,
  type PublicFirstSelection,
} from "@/features/ux-lab/public-first/content";
import { PublicFirstSectionNav } from "@/features/ux-lab/public-first/section-nav";

const textLinkClassName = buttonVariants({
  className: "public-first-pathway-link",
  variant: "outline",
});

const primaryLinkClassName = buttonVariants({
  className: "public-first-pathway-link",
});

export function PublicFirstClinicalPage({
  selection,
}: {
  selection: PublicFirstSelection;
}) {
  const { place } = selection;

  return (
    <main className="public-first">
      <PublicFirstSectionNav placeId={place.id} section="clinical" />
      <header className="public-first-pro-intro">
        <p className="eyebrow">Secondary path</p>
        <h1>Clinical Resources</h1>
        <p>
          Professional resource discovery for {place.name}. This page continues
          the public snapshot. It is not a clinical care pathway, and it does
          not give medical direction.
        </p>
        <Badge variant="outline">Sample data</Badge>
      </header>

      {selection.unrecognizedPlace ? (
        <p className="public-first-status" role="status">
          That sample place is not in this prototype. Showing {place.name}.
        </p>
      ) : null}

      <ul className="public-first-module-list">
        {PUBLIC_FIRST_CLINICAL_CARDS.map((card) => (
          <li key={card.id}>
            <Card>
              <CardHeader>
                <h2 className="type-card">{card.title}</h2>
                <CardDescription>{place.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{card.summary}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="clinical-continue"
        className="public-first-continue"
      >
        <h2 id="clinical-continue">Continue into Atlas</h2>
        <p>
          Surveillance structure for {place.name} lives in the professional
          workspace. That workspace is the differentiated Atlas product in this
          prototype.
        </p>
        <Link
          className={primaryLinkClassName}
          href={publicFirstHref(place.id, "surveillance")}
        >
          Open Public Health & Surveillance
        </Link>
        <Link className={textLinkClassName} href={publicFirstHref(place.id)}>
          Return to the {place.name} snapshot
        </Link>
      </section>

      <p className="public-first-notice">{PUBLIC_FIRST_SAMPLE_NOTICE}</p>
    </main>
  );
}

export function PublicFirstSurveillancePage({
  selection,
}: {
  selection: PublicFirstSelection;
}) {
  const { place } = selection;

  return (
    <main className="public-first public-first-workspace">
      <PublicFirstSectionNav placeId={place.id} section="surveillance" />
      <header className="public-first-workspace-mast">
        <p className="eyebrow">Atlas professional workspace</p>
        <h1>Public Health & Surveillance</h1>
        <p>
          This is the professional continuation of the {place.name} public
          snapshot. It organizes evidence structure, methods, and an
          investigation entry. It does not turn the public snapshot into a
          county score, and it does not claim that local transmission is
          occurring.
        </p>
        <p className="public-first-workspace-place">
          Place context: {place.name}, {place.region}
        </p>
        <Badge className="public-first-workspace-badge" variant="outline">
          Sample workspace
        </Badge>
      </header>

      {selection.unrecognizedPlace ? (
        <p className="public-first-status" role="status">
          That sample place is not in this prototype. Showing {place.name}.
        </p>
      ) : null}

      <section aria-labelledby="surveillance-from-public">
        <h2 id="surveillance-from-public">From the public snapshot</h2>
        <p>
          A public visitor can read {place.name} without entering this
          workspace. Opening it is how a public-health user reaches the Atlas
          tools that sit behind that snapshot.
        </p>
        <Link className={textLinkClassName} href={publicFirstHref(place.id)}>
          Return to the {place.name} snapshot
        </Link>
      </section>

      <ul className="public-first-module-list">
        {PUBLIC_FIRST_SURVEILLANCE_MODULES.map((module) => (
          <li key={module.id}>
            <Card>
              <CardHeader>
                <h2 className="type-card">{module.title}</h2>
                <CardDescription>
                  Sample module for {place.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>{module.summary}</p>
                {module.id === "action-center" ? (
                  <p>
                    In the live Atlas, investigation work continues in the
                    Action Center. This prototype does not change that
                    workspace.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <p className="public-first-notice">{PUBLIC_FIRST_SAMPLE_NOTICE}</p>
    </main>
  );
}
