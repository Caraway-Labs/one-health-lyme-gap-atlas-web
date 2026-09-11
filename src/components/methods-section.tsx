"use client";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AtlasMetadata } from "@/generated/models";
import {
  analyticsControlAttributes,
  trackProvenanceOpened,
} from "@/lib/atlas-analytics";

export function MethodsSection({ metadata }: { metadata: AtlasMetadata }) {
  return (
    <section className="methods-section section" id="methods">
      <AtlasSectionHeader
        aside={
          <AtlasDataStamp variant="inline">
            Generated {new Date(metadata.generated_at).toLocaleDateString()} ·
            Loaded {new Date(metadata.loaded_at).toLocaleDateString()}
          </AtlasDataStamp>
        }
        description="County data are combined using standard FIPS codes. Each source retains its year, source, and known limitations."
        eyebrow="Data sources and limitations"
        title="How to interpret the Atlas"
      />
      <div className="source-grid">
        {metadata.sources.map((source, index) => (
          <a
            className="source-card"
            key={source.key}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            {...analyticsControlAttributes("methods_source_open")}
            onClick={() =>
              trackProvenanceOpened(window.location.pathname, "source_card")
            }
          >
            <span>0{index + 1}</span>
            <h3>{source.label}</h3>
            <Badge className="source-vintage h-auto" variant="secondary">
              {source.vintage}
            </Badge>
            <p>{source.note}</p>
            <small>View source ↗</small>
          </a>
        ))}
      </div>
      <div className="guardrail-grid">
        <Guardrail icon="!" title="Not a diagnosis">
          County rankings do not measure individual risk.
        </Guardrail>
        <Guardrail icon="↗" title="Exposure may be elsewhere">
          Published cases are generally assigned to the patient’s county of
          residence, which may differ from where exposure occurred.
        </Guardrail>
        <Guardrail icon="∅" title="No record does not mean none exists">
          The absence of a published county count does not necessarily mean zero
          cases.
        </Guardrail>
        <Guardrail icon="≈" title="Data come from different years">
          Inputs are public snapshots with different release dates, not
          real-time surveillance.
        </Guardrail>
      </div>
      <div className="mvp-boundary">
        <div>
          <span className="eyebrow">Current prototype</span>
          <h3>Useful for prioritizing questions—not answering them alone.</h3>
        </div>
        <div className="boundary-columns">
          <div>
            <strong>Available now</strong>
            <ul>
              <li>Published Lyme case data</li>
              <li>Tick and pathogen evidence</li>
              <li>Social vulnerability, insurance access, and rurality</li>
            </ul>
          </div>
          <div>
            <strong>Being evaluated next</strong>
            <ul>
              <li>Land cover and habitat suitability</li>
              <li>State and local information</li>
              <li>Provider and laboratory capacity</li>
            </ul>
          </div>
        </div>
      </div>
      <p className="limitations">
        <strong>Release limitation:</strong> {metadata.limitations}
      </p>
    </section>
  );
}

function Guardrail({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="guardrail-card gap-0 rounded-none bg-[var(--pale)] py-0 ring-0">
      <span className="guardrail-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </Card>
  );
}
