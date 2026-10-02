import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
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
  GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID,
  GEOGRAPHY_FIRST_V2_PROFESSIONAL_HANDOFFS,
  GEOGRAPHY_FIRST_V2_STATE_REVIEW,
  geographyFirstV2EvidenceTopics,
  type GeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";

const handoffLinkClassName = buttonVariants({
  className:
    "geography-first-v2-handoff-link h-auto min-h-[var(--control-height)] justify-start px-4 py-2 text-left whitespace-normal",
  variant: "default",
});

export function GeographyFirstV2EvidenceExperience({
  place,
}: {
  place: GeographyFirstV2Place;
}) {
  const representative = place.id === GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID;
  const topics = geographyFirstV2EvidenceTopics(place.name);

  return (
    <article className="geography-first-v2-place-view geography-first-v2-evidence-view">
      <header className="geography-first-v2-evidence-band">
        <p className="eyebrow light">
          Geography-first v2 · public-health evidence
        </p>
        <div className="geography-first-v2-title-row">
          <h1 className="type-page">{place.name}</h1>
          <Badge variant="outline">
            {representative ? "Representative sample" : "Sample place"}
          </Badge>
        </div>
        <p className="type-body">{place.setting}</p>
        <p className="geography-first-v2-lead type-body">
          Deeper evidence and provenance for epidemiologists reviewing{" "}
          {place.name}. Uncertainty stays adjacent to each claim; methodology
          can expand without hiding essential missingness.
        </p>
      </header>

      <section
        aria-labelledby="state-review-entry"
        className="geography-first-v2-section geography-first-v2-state-review"
        id="state-review-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description={GEOGRAPHY_FIRST_V2_STATE_REVIEW.description}
          eyebrow="Public health"
          title={GEOGRAPHY_FIRST_V2_STATE_REVIEW.label}
          titleId="state-review-entry"
        />
        <p className="type-body">{GEOGRAPHY_FIRST_V2_STATE_REVIEW.note}</p>
        <p className="geography-first-v2-notice type-small">
          {UX_LAB_SAMPLE_NOTICE}
        </p>
      </section>

      {topics.map((topic) => (
        <section
          aria-labelledby={`evidence-${topic.id}`}
          className="geography-first-v2-section geography-first-v2-evidence-topic"
          id={`evidence-${topic.id}-section`}
          key={topic.id}
        >
          <AtlasSectionHeader
            className="geography-first-v2-heading"
            description={topic.summary}
            eyebrow="Evidence desk"
            title={topic.title}
            titleId={`evidence-${topic.id}`}
          />
          <p className="type-body">{topic.body}</p>
          <p className="geography-first-v2-limitation type-body" role="note">
            <strong>Uncertainty.</strong> {topic.uncertainty}
          </p>
          <div className="geography-first-v2-evidence-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Field</TableHead>
                  <TableHead scope="col">Sample provenance note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topic.rows.map((row) => (
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
          {topic.id === "methodology" ? (
            <details className="geography-first-v2-disclosure">
              <summary>Sample extended methodology notes</summary>
              <p className="type-body">
                Progressive disclosure can hold longer coding notes. Essential
                missingness still appears in the summary and uncertainty lines
                above so readers are not required to open this block.
              </p>
            </details>
          ) : null}
        </section>
      ))}

      <section
        aria-labelledby="professional-handoff"
        className="geography-first-v2-section geography-first-v2-handoff"
        id="professional-handoff-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description={`${place.name} remains the conceptual subject. Because this place is fictional, handoffs open the live Atlas without a county identifier or sample finding.`}
          eyebrow="Public health"
          title="Continue in the professional Atlas"
          titleId="professional-handoff"
        />
        <ul className="geography-first-v2-handoff-list">
          {GEOGRAPHY_FIRST_V2_PROFESSIONAL_HANDOFFS.map((link) => (
            <li key={link.id}>
              <Link className={handoffLinkClassName} href={link.href}>
                {link.label}
              </Link>
              <p className="type-small">
                Continues {place.name}. {link.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
