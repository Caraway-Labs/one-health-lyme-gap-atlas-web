import type { Metadata } from "next";
import Link from "next/link";

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
  PRO_EVIDENCE_PATH,
  PRO_INVESTIGATION_PATH,
  PUBLIC_EDUCATION_PATH,
} from "@/features/ux-lab/public-site-pro-app/paths";

export const metadata: Metadata = {
  title: "Atlas for Public Health",
};

const WORKSPACE_ROWS = [
  {
    area: "Evidence review",
    connection: "Not connected",
    href: PRO_EVIDENCE_PATH,
    shows: "Sample description of an evidence-review summary",
  },
  {
    area: "Investigation reference",
    connection: "Live workspace unchanged",
    href: PRO_INVESTIGATION_PATH,
    shows: "Sample reference to the professional investigation workspace",
  },
  {
    area: "Public outreach",
    connection: "Opens the public site",
    href: PUBLIC_EDUCATION_PATH,
    shows: "Education topics remain on the public site",
  },
] as const;

export default function ProfessionalOverviewPage() {
  return (
    <>
      <header className="ux-lab-pro-switch">
        <p className="eyebrow">You left the public site</p>
        <h1>Workspace overview</h1>
        <p className="type-body">
          This is Atlas for Public Health, the professional application.
          Navigation, tables, and workspace labels are denser than the public
          site. Use Return to public site in the header or sidebar to go back.
        </p>
      </header>
      <div className="ux-lab-pro-grid">
        <Card>
          <CardHeader>
            <h2 className="type-card">Sample workspace register</h2>
            <CardDescription>
              Labels for stakeholder walkthroughs. No surveillance values are
              shown.
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
            <h2 className="type-card">Application boundary</h2>
          </CardHeader>
          <CardContent>
            <p className="type-body">
              Education and clinician resources are not sections of this
              workspace. They live on the public site and are linked from Leave
              this application.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
