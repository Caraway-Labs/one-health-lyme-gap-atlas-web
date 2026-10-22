"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrustCard } from "@/features/public-trust/trust-card";
import {
  dataProvenanceContent,
  dataProvenanceEvidenceLabel,
  dataProvenanceFilterCount,
  dataProvenanceVisibleCountLabel,
  type DataProvenanceFilterId,
} from "@/lib/data-provenance-content";

const FILTER_GROUP_LABEL = "Filter sources by evidence type";

export function DataProvenanceCatalog() {
  const [selected, setSelected] = useState<DataProvenanceFilterId>("all");
  const { datasets } = dataProvenanceContent;
  const total = datasets.length;
  const visible = datasets.filter(
    (item) => selected === "all" || item.evidenceType === selected
  );
  const showBulletinNote = selected === "all" || selected === "bulletin";

  return (
    <>
      <div
        aria-label={FILTER_GROUP_LABEL}
        className="flex min-w-0 flex-wrap gap-2"
        role="group"
      >
        {dataProvenanceContent.filters.map((filter) => {
          const pressed = selected === filter.id;
          const count = dataProvenanceFilterCount(filter.id, datasets);
          return (
            <Button
              aria-pressed={pressed}
              key={filter.id}
              onClick={() => {
                setSelected(filter.id);
              }}
              type="button"
              variant={pressed ? "secondary" : "outline"}
            >
              {filter.label} ({count})
            </Button>
          );
        })}
      </div>
      <p aria-live="polite">
        {dataProvenanceVisibleCountLabel(visible.length, total)}
      </p>
      <div className="public-trust-cards public-trust-cards--trio">
        {visible.map((item) => (
          <TrustCard
            id={item.anchorId}
            key={item.id}
            kicker={
              <Badge variant="secondary">
                {dataProvenanceEvidenceLabel(item.evidenceType)}
              </Badge>
            }
            title={item.name}
          >
            <p>Published by {item.publisher}</p>
            <p>
              <strong>What Atlas uses it for.</strong> {item.uses}
            </p>
            <dl className="public-trust-facts public-trust-facts--stacked">
              <div>
                <dt>Edition in Atlas</dt>
                <dd>{item.edition}</dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>{item.coverage}</dd>
              </div>
              <div>
                <dt>Publisher updates</dt>
                <dd>{item.cadence}</dd>
              </div>
              <div>
                <dt>How Atlas gets it</dt>
                <dd>{item.ingest}</dd>
              </div>
            </dl>
            <p>
              <strong>Keep in mind.</strong> {item.keepInMind}
            </p>
            <p>
              <a
                href={item.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Visit the source, {item.sourceLabel}
                <span className="sr-only"> for {item.name}</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </TrustCard>
        ))}
      </div>
      {showBulletinNote ? <p>{dataProvenanceContent.bulletinNote}</p> : null}
      <details>
        <summary>Compare all sources in a table</summary>
        <Table>
          <TableCaption>Every source Atlas uses</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Dataset</TableHead>
              <TableHead scope="col">Publisher</TableHead>
              <TableHead scope="col">Evidence type</TableHead>
              <TableHead scope="col">Edition</TableHead>
              <TableHead scope="col">Coverage</TableHead>
              <TableHead scope="col">Updates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datasets.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.publisher}</TableCell>
                <TableCell>
                  {dataProvenanceEvidenceLabel(item.evidenceType)}
                </TableCell>
                <TableCell>{item.edition}</TableCell>
                <TableCell>{item.coverage}</TableCell>
                <TableCell>{item.cadence}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </>
  );
}
