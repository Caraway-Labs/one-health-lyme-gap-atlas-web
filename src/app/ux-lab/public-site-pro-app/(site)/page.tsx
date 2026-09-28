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
  PRO_APP_PATH,
  PUBLIC_CLINICIANS_PATH,
  PUBLIC_EDUCATION_PATH,
} from "@/features/ux-lab/public-site-pro-app/paths";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Public site",
};

const pathLinkClassName = buttonVariants({ variant: "outline" });
const openAtlasClassName = cn(
  buttonVariants({ size: "lg" }),
  "ux-lab-open-atlas"
);

export default function PublicSiteHomePage() {
  return (
    <>
      <header className="ux-lab-public-hero">
        <p className="eyebrow">Information and resources</p>
        <h1 className="type-page">
          A public site for learning and clinician resources
        </h1>
        <p className="type-body ux-lab-public-lead">
          General visitors and clinicians use this simpler site. Education
          topics and clinician resource lists stay here. The denser workspace
          for public-health users is a separate application, opened on purpose.
        </p>
      </header>

      <section aria-labelledby="public-site-paths">
        <h2 className="type-section" id="public-site-paths">
          On this site
        </h2>
        <div className="ux-lab-public-paths">
          <Card>
            <CardHeader>
              <h3 className="type-card">Education and local context</h3>
              <CardDescription>
                Tick awareness, prevention topics, outreach, and a fictional
                sample place.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className={pathLinkClassName} href={PUBLIC_EDUCATION_PATH}>
                Open education topics
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="type-card">Clinician resources</h3>
              <CardDescription>
                Sample resource cards and reporting links. This is not a care
                pathway.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className={pathLinkClassName} href={PUBLIC_CLINICIANS_PATH}>
                Open clinician resources
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        aria-labelledby="open-professional-app"
        className="ux-lab-mode-callout"
      >
        <p className="eyebrow">Separate application</p>
        <h2 className="type-section" id="open-professional-app">
          Public-health users work in Atlas for Public Health
        </h2>
        <p className="type-body">
          Opening the professional application leaves this public site. Its
          navigation, density, and labeling belong to the workspace. You can
          return here from that application.
        </p>
        <Link className={openAtlasClassName} href={PRO_APP_PATH}>
          {OPEN_ATLAS_LABEL}
        </Link>
      </section>
    </>
  );
}
