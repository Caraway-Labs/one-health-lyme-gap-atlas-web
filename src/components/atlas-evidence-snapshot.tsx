import type { AtlasMetadata } from "@/generated/models";
import {
  describeMethodologyVersion,
  describeReleaseAssembly,
  formatAtlasTimestamp,
  formatEvidenceScope,
  formatEvidenceSnapshotSummary,
  summarizeSourceVintages,
} from "@/lib/atlas-evidence-metadata";
import { getDocsHref } from "@/lib/docs-config";
import { cn } from "@/lib/utils";

export function AtlasEvidenceSnapshot({
  className,
  layout = "card",
  metadata,
  methodsHref = "#methods",
}: {
  className?: string;
  layout?: "banner" | "card";
  metadata: AtlasMetadata;
  methodsHref?: string;
}) {
  const summary = formatEvidenceSnapshotSummary(metadata);

  const technicalDetails = (
    <details className="atlas-evidence-disclosure">
      <summary>Technical release and methodology identifiers</summary>
      <dl className="atlas-evidence-technical">
        <div>
          <dt>Release ID</dt>
          <dd>{metadata.release_id || "Unavailable"}</dd>
        </div>
        <div>
          <dt>Methodology version</dt>
          <dd>{metadata.methodology_version || "Unavailable"}</dd>
        </div>
        <div>
          <dt>Release generated</dt>
          <dd>{formatAtlasTimestamp(metadata.generated_at)}</dd>
        </div>
        <div>
          <dt>Release loaded</dt>
          <dd>{formatAtlasTimestamp(metadata.loaded_at)}</dd>
        </div>
        <div>
          <dt>Source periods</dt>
          <dd>
            {metadata.sources.length === 0
              ? "Unavailable"
              : metadata.sources.map((source) => (
                  <span className="atlas-evidence-source" key={source.key}>
                    {source.label}: {source.vintage || "Unavailable"}
                  </span>
                ))}
          </dd>
        </div>
        <div>
          <dt>Release limitation</dt>
          <dd>{metadata.limitations?.trim() || "Unavailable"}</dd>
        </div>
      </dl>
      <p className="atlas-evidence-methods-link">
        <a href={methodsHref}>
          Review methodology and limitations on this page
        </a>
        {" · "}
        <a
          href={getDocsHref("read-the-evidence-carefully")}
          rel="noopener noreferrer"
          target="_blank"
        >
          Read the documentation guide ↗
        </a>
      </p>
    </details>
  );

  if (layout === "banner") {
    return (
      <section
        aria-labelledby="atlas-evidence-snapshot-heading"
        className={cn(
          "atlas-evidence-snapshot atlas-evidence-snapshot--banner",
          className
        )}
      >
        <h2 className="eyebrow" id="atlas-evidence-snapshot-heading">
          Evidence snapshot
        </h2>
        <p className="atlas-evidence-summary">{summary}</p>
        <dl className="atlas-evidence-highlights">
          <div>
            <dt>Selected release</dt>
            <dd>{describeReleaseAssembly(metadata.release_id)}</dd>
          </div>
          <div>
            <dt>Evidence scope</dt>
            <dd>{formatEvidenceScope(metadata.scope)}</dd>
          </div>
          <div>
            <dt>Source periods</dt>
            <dd>{summarizeSourceVintages(metadata.sources)}</dd>
          </div>
          <div>
            <dt>Scoring methodology</dt>
            <dd>{describeMethodologyVersion(metadata.methodology_version)}</dd>
          </div>
        </dl>
        {technicalDetails}
      </section>
    );
  }

  return (
    <div
      className={cn(
        "atlas-evidence-snapshot atlas-evidence-snapshot--card",
        className
      )}
    >
      <div className="data-stamp">
        <span>
          <i className="pulse" />
          Evidence snapshot
        </span>
        <small className="atlas-evidence-summary">{summary}</small>
      </div>
      {technicalDetails}
    </div>
  );
}
