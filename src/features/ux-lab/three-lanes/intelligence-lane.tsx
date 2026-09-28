import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INTELLIGENCE_ENTRIES,
  otherThreeLaneItems,
  threeLaneItemPath,
  threeLanesSampleNotice,
  type IntelligenceEntry,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesFrame } from "@/features/ux-lab/three-lanes/lane-nav";
import { SharedLaneLinks } from "@/features/ux-lab/three-lanes/shared-links";

const workspaceLinkClassName = buttonVariants({
  className: "three-lanes-workspace-link h-[var(--control-height)] w-fit px-4",
  variant: "secondary",
});

export function IntelligenceLanePage() {
  return (
    <ThreeLanesFrame current="intelligence">
      <main className="three-lanes-main three-lanes-main-pro">
        <header className="three-lanes-pro-band">
          <p className="eyebrow light">Public Health & Intelligence</p>
          <h1 className="type-page">
            Review evidence and open the investigation workspace
          </h1>
          <p className="type-body">
            This lane keeps the professional Atlas close: an evidence desk, a
            shared-materials row, and a direct reference to the live Action
            Center workspace.
          </p>
          <Link className={workspaceLinkClassName} href="/investigate">
            Live investigation workspace
          </Link>
        </header>
        <p className="three-lanes-sample type-small">
          {threeLanesSampleNotice("intelligence")}
        </p>
        <section aria-labelledby="intelligence-entries">
          <h2 className="type-section" id="intelligence-entries">
            Professional entries
          </h2>
          <IntelligenceTable entries={INTELLIGENCE_ENTRIES} />
        </section>
      </main>
    </ThreeLanesFrame>
  );
}

export function IntelligenceTopicPage({ entry }: { entry: IntelligenceEntry }) {
  const others = otherThreeLaneItems("intelligence", entry.id).filter(
    (item) => item.kind === "intelligence"
  );

  return (
    <ThreeLanesFrame current="intelligence">
      <main className="three-lanes-main three-lanes-main-pro">
        <header className="three-lanes-pro-band">
          <p className="eyebrow light">Public Health & Intelligence</p>
          <h1 className="type-page">{entry.title}</h1>
          <p className="type-body">{entry.summary}</p>
          {entry.id === "action-center" ? (
            <Link className={workspaceLinkClassName} href="/investigate">
              Live investigation workspace
            </Link>
          ) : null}
        </header>
        {entry.shared ? (
          <Badge variant="secondary">Shared across lanes</Badge>
        ) : null}
        <p className="three-lanes-sample type-small">
          {threeLanesSampleNotice("intelligence")}
        </p>
        <section aria-labelledby="intelligence-detail-table">
          <h2 className="type-section" id="intelligence-detail-table">
            Desk notes
          </h2>
          <div className="three-lanes-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Label</TableHead>
                  <TableHead scope="col">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium whitespace-normal">
                      {row.label}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {row.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
        <SharedLaneLinks current="intelligence" links={entry.related} />
        {others.length > 0 ? (
          <nav
            aria-label="More public health entries"
            className="three-lanes-more"
          >
            <h2 className="type-card">More in Public Health & Intelligence</h2>
            <ul>
              {others.map((item) => (
                <li key={item.id}>
                  <Link
                    className="three-lanes-text-link"
                    href={threeLaneItemPath("intelligence", item.id)}
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

function IntelligenceTable({
  entries,
}: {
  entries: readonly IntelligenceEntry[];
}) {
  return (
    <div className="three-lanes-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Entry</TableHead>
            <TableHead scope="col">What this desk holds</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-normal">
                <Link
                  className="three-lanes-text-link"
                  href={threeLaneItemPath("intelligence", entry.id)}
                >
                  {entry.title}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal">
                {entry.summary}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
