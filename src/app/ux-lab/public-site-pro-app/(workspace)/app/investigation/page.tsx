import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { UX_LAB_SAMPLE_TOPICS } from "@/features/ux-lab/prototype-contract";
import {
  PUBLIC_SITE_HOME,
  RETURN_TO_PUBLIC_SITE_LABEL,
} from "@/features/ux-lab/public-site-pro-app/paths";

export const metadata: Metadata = {
  title: "Investigation reference",
};

const returnClassName = buttonVariants({ variant: "outline" });

export default function InvestigationReferencePage() {
  const reference = UX_LAB_SAMPLE_TOPICS.find(
    (topic) => topic.id === "action-center"
  );

  return (
    <>
      <header>
        <p className="eyebrow">Professional application</p>
        <h1>Investigation reference</h1>
        <p className="type-body">
          This page stands in for a professional investigation workspace. The
          live Atlas workspace is unchanged, and this prototype does not open
          it.
        </p>
      </header>
      <Card>
        <CardHeader>
          <h2 className="type-card">{reference?.title}</h2>
          <CardDescription>Sample layout only</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="type-body">{reference?.summary}</p>
          <Link className={returnClassName} href={PUBLIC_SITE_HOME}>
            {RETURN_TO_PUBLIC_SITE_LABEL}
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
