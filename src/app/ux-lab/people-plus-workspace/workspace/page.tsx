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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PEOPLE_OUTREACH_PREVIEW_PATH,
  PEOPLE_PRO_EVIDENCE_PATH,
  RETURN_TO_PEOPLE_ENV_LABEL,
} from "@/features/ux-lab/people-plus-workspace/paths";

export const metadata: Metadata = {
  title: "Atlas for Public Health",
};

const WORKSPACE_ROWS = [
  {
    area: "Evidence review",
    connection: "Sample county review with provenance cues",
    href: PEOPLE_PRO_EVIDENCE_PATH,
    shows: "State/county investigation entry with uncertainty and limitations",
  },
  {
    area: "Outreach resource preview",
    connection: "Human-reviewed handoff (mock)",
    href: PEOPLE_OUTREACH_PREVIEW_PATH,
    shows: "Bridge from professional findings to public/clinician artifacts",
  },
] as const;

const returnClassName = buttonVariants({ variant: "outline" });

export default function PeopleProfessionalOverviewPage() {
  return (
    <>
      <header className="ux-lab-pro-switch">
        <p className="eyebrow">You left the people-first environment</p>
        <h1>Professional workspace overview</h1>
        <p className="type-body">
          This shell is intentionally denser than the public experience: sidebar
          navigation, tables, and workspace labels stand in for epidemiology
          tooling. Use {RETURN_TO_PEOPLE_ENV_LABEL} when you want the lighter
          people-first shell again.
        </p>
      </header>
      <div className="ux-lab-pro-grid">
        <Card>
          <CardHeader>
            <h2 className="type-card">Sample workspace register</h2>
            <CardDescription>
              Stakeholder walkthrough for Story 2. No live scores or incidence
              values appear.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>What this sample shows</TableHead>
                  <TableHead>Connection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WORKSPACE_ROWS.map((row) => (
                  <TableRow key={row.area}>
                    <TableCell>
                      <Link href={row.href}>{row.area}</Link>
                    </TableCell>
                    <TableCell>{row.shows}</TableCell>
                    <TableCell>{row.connection}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="type-card">Evidence-to-education path</h2>
          </CardHeader>
          <CardContent>
            <p className="type-body">
              Start in evidence review, open the outreach preview, then continue
              into the people-first education or clinician pages. Context and
              human review stay visible at each step.
            </p>
            <Link className={returnClassName} href={PEOPLE_PRO_EVIDENCE_PATH}>
              Open evidence review
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
