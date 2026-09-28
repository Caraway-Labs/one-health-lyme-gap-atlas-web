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
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import {
  CLINICAL_RESOURCES,
  INTELLIGENCE_ENTRIES,
  LEARN_TOPICS,
  THREE_LANES,
  threeLaneItemPath,
  threeLanePath,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesFrame } from "@/features/ux-lab/three-lanes/lane-nav";

const laneLinkClassName = buttonVariants({
  className: "three-lanes-lane-link h-[var(--control-height)] w-fit px-4",
});

export function ThreeLanesFrontDoor() {
  const leadArticle = LEARN_TOPICS[0];
  const leadResource = CLINICAL_RESOURCES[0];
  if (!(leadArticle && leadResource)) {
    throw new Error("Three Lanes prototype is missing its lead sample items");
  }

  return (
    <ThreeLanesFrame current="front">
      <main className="three-lanes-main">
        <header className="three-lanes-intro">
          <p className="eyebrow">One Health Lyme Gap Atlas</p>
          <h1 className="type-page">One Atlas, three peer lanes</h1>
          <p className="type-body">
            Learn, Clinical Resources, and Public Health & Intelligence are peer
            destinations in the same Atlas. Each lane is open from the
            navigation. Shared topics move with you, and each lane keeps its own
            level of detail.
          </p>
          <p className="three-lanes-sample type-small">
            {UX_LAB_SAMPLE_NOTICE}
          </p>
        </header>

        <section
          aria-labelledby="three-lanes-learn"
          className="three-lanes-front-learn"
        >
          <div className="three-lanes-reading-section">
            <p className="eyebrow">{THREE_LANES.learn.kicker}</p>
            <h2 className="type-section" id="three-lanes-learn">
              {THREE_LANES.learn.navLabel}
            </h2>
            <p className="type-body">{THREE_LANES.learn.summary}</p>
            <p className="type-body">
              <Link
                className="three-lanes-text-link"
                href={threeLaneItemPath("learn", leadArticle.id)}
              >
                {leadArticle.title}
              </Link>{" "}
              opens a plain-language page. {leadArticle.lede}
            </p>
            <Link className={laneLinkClassName} href={threeLanePath("learn")}>
              Open Learn
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="three-lanes-clinical"
          className="three-lanes-front-clinical"
        >
          <p className="eyebrow">{THREE_LANES.clinical.kicker}</p>
          <h2 className="type-section" id="three-lanes-clinical">
            {THREE_LANES.clinical.navLabel}
          </h2>
          <p className="type-body">{THREE_LANES.clinical.summary}</p>
          <Card>
            <CardHeader>
              <h3 className="type-card">
                <Link
                  className="three-lanes-text-link"
                  href={threeLaneItemPath("clinical", leadResource.id)}
                >
                  {leadResource.title}
                </Link>
              </h3>
              <CardDescription>{leadResource.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="three-lanes-meta">
                <div>
                  <dt>Source</dt>
                  <dd>{leadResource.source}</dd>
                </div>
                <div>
                  <dt>Freshness</dt>
                  <dd>{leadResource.freshness}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Link className={laneLinkClassName} href={threeLanePath("clinical")}>
            Open Clinical Resources
          </Link>
        </section>

        <section
          aria-labelledby="three-lanes-intelligence"
          className="three-lanes-front-intel"
        >
          <div className="three-lanes-pro-band">
            <p className="eyebrow light">{THREE_LANES.intelligence.kicker}</p>
            <h2 className="type-section" id="three-lanes-intelligence">
              {THREE_LANES.intelligence.navLabel}
            </h2>
            <p className="type-body">{THREE_LANES.intelligence.summary}</p>
          </div>
          <div className="three-lanes-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Entry</TableHead>
                  <TableHead scope="col">Professional role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INTELLIGENCE_ENTRIES.map((entry) => (
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
          <Link
            className={laneLinkClassName}
            href={threeLanePath("intelligence")}
          >
            Open Public Health & Intelligence
          </Link>
        </section>

        <section
          aria-labelledby="three-lanes-shared-topic"
          className="three-lanes-shared"
        >
          <h2 className="type-section" id="three-lanes-shared-topic">
            One topic, three presentations
          </h2>
          <p className="type-body">
            Tick awareness is a shared Atlas topic. Learn explains it in plain
            language, Clinical Resources lists a handout with source and
            freshness labels, and Public Health & Intelligence keeps a
            shared-materials row for professional reuse.
          </p>
          <ul>
            <li>
              <Link
                className="three-lanes-text-link"
                href={threeLaneItemPath("learn", "tick-awareness")}
              >
                Learn: Tick awareness
              </Link>
            </li>
            <li>
              <Link
                className="three-lanes-text-link"
                href={threeLaneItemPath("clinical", "tick-awareness-handout")}
              >
                Clinical Resources: Tick awareness handout
              </Link>
            </li>
            <li>
              <Link
                className="three-lanes-text-link"
                href={threeLaneItemPath("intelligence", "shared-outreach")}
              >
                Public Health & Intelligence: Shared outreach
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </ThreeLanesFrame>
  );
}
