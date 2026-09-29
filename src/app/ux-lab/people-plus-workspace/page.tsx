import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  OPEN_ATLAS_LABEL,
  PEOPLE_CLINICIANS_PATH,
  PEOPLE_EDUCATION_PATH,
  PEOPLE_LIVING_PATH,
  PEOPLE_LOCAL_PATH,
  PEOPLE_WORKSPACE_PATH,
} from "@/features/ux-lab/people-plus-workspace/paths";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "People-first Atlas",
};

const pathLinkClassName = buttonVariants({ variant: "outline" });
const openAtlasClassName = cn(
  buttonVariants({ size: "lg" }),
  "people-plus-open-atlas"
);

export default function PeoplePlusHomePage() {
  return (
    <>
      <header className="people-plus-hero">
        <p className="eyebrow">Understandable first</p>
        <h1 className="type-page">
          Lyme information for everyday readers and clinicians
        </h1>
        <p className="type-body people-plus-lead">
          Start with plain-language education, lived-experience support, and
          local context in a calm Atlas environment. Clinician resource lists
          stay here too. Public-health investigation opens separately when you
          need that depth.
        </p>
      </header>

      <section aria-labelledby="people-plus-paths">
        <h2 className="type-section" id="people-plus-paths">
          Start here
        </h2>
        <div className="people-plus-path-grid">
          <Card className="people-plus-path-feature">
            <CardHeader>
              <h3 className="type-card">Living with Lyme</h3>
              <CardDescription>
                An explicit path for people already affected—ongoing concerns,
                credible next reads, and boundaries between community data and
                personal care.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className={pathLinkClassName} href={PEOPLE_LIVING_PATH}>
                Open lived-experience page
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="type-card">Education and prevention</h3>
              <CardDescription>
                Tick basics, prevention topic headings, and trusted outreach
                patterns—without entering an analytics workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className={pathLinkClassName} href={PEOPLE_EDUCATION_PATH}>
                Browse education topics
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="type-card">Local context</h3>
              <CardDescription>
                A fictional sample place shows how geography could appear as
                supporting context, not the only front door.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className={pathLinkClassName} href={PEOPLE_LOCAL_PATH}>
                View sample local context
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="type-card">Clinician resources</h3>
              <CardDescription>
                Fast discovery with source, freshness, and applicability cues on
                every listing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className={pathLinkClassName} href={PEOPLE_CLINICIANS_PATH}>
                Open clinician resources
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        aria-labelledby="people-plus-workspace"
        className="people-plus-secondary-callout"
      >
        <p className="eyebrow">Secondary, on purpose</p>
        <h2 className="type-section" id="people-plus-workspace">
          Public-health professionals use a separate workspace
        </h2>
        <p className="type-body">
          {OPEN_ATLAS_LABEL} is visible but not the default entrance. Opening it
          is a deliberate mode change into denser Atlas tooling. From there you
          can walk a sample evidence review into a reviewed outreach preview and
          back into these people-first pages without losing context.
        </p>
        <Link className={openAtlasClassName} href={PEOPLE_WORKSPACE_PATH}>
          {OPEN_ATLAS_LABEL}
        </Link>
      </section>
    </>
  );
}
