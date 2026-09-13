import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CountyDetail } from "@/generated/models";
import { uncertaintyCuesFor } from "@/lib/atlas-ui";

type EvidenceState = "observed" | "missing" | "unavailable";

function statusText(value: string | null | undefined) {
  return value?.replaceAll("_", " ") || "Unavailable";
}

function humanValue(detail: CountyDetail) {
  if (detail.human_status !== "published_count_floor") {
    return "No county-linked published record";
  }
  if (detail.case_count_floor_2023 === 0) {
    return "0 published county-linked cases";
  }
  if (detail.case_count_floor_2023 != null) {
    return `${detail.case_count_floor_2023.toLocaleString()} published county-linked cases`;
  }
  return "Published count floor unavailable";
}

function humanNote(detail: CountyDetail) {
  if (detail.human_status === "published_count_floor") {
    return `${detail.incidence_floor_2023?.toFixed(1) ?? "Unavailable"} cases per 100,000 minimum rate in the 2023 published data.`;
  }
  return "Missing, suppressed, or unallocated records are not converted to zero.";
}

function tickNote(detail: CountyDetail) {
  return [
    `Ixodes status: ${statusText(detail.scapularis_status)}`,
    `western blacklegged tick status: ${statusText(detail.pacificus_status)}`,
  ].join(" · ");
}

function EvidenceItem({
  label,
  note,
  state,
  value,
}: {
  label: string;
  note: string;
  state: EvidenceState;
  value: string;
}) {
  const stateLabel =
    state === "observed"
      ? "Observed or published"
      : state === "missing"
        ? "No county record"
        : "Unavailable";
  return (
    <article className="county-evidence-item" data-evidence-state={state}>
      <div className="county-evidence-item-heading">
        <h4>{label}</h4>
        <Badge variant="outline">{stateLabel}</Badge>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

export function CountyEvidencePanel({
  compact = false,
  detail,
}: {
  compact?: boolean;
  detail: CountyDetail;
}) {
  const headingId = `county-evidence-heading-${detail.fips}`;
  const humanState =
    detail.human_status === "published_count_floor" ? "observed" : "missing";
  const tickState =
    detail.tick_status === "No records" ? "missing" : "observed";
  const pathogenState =
    detail.burgdorferi_status === "No records" ? "missing" : "observed";

  return (
    <Card
      aria-labelledby={headingId}
      className={`county-evidence-panel${compact ? " county-evidence-panel-compact gap-0 bg-transparent py-0 ring-0" : ""}`}
      role="region"
    >
      <div className="county-evidence-panel-header">
        <span className="eyebrow">Observed evidence</span>
        <h3 id={headingId}>Evidence and data used for this county</h3>
        <p>
          These are the published inputs available to the governed county
          result. They are separate from the score interpretation and suggested
          follow-up.
        </p>
      </div>
      <div className="county-evidence-grid">
        <EvidenceItem
          label="Published 2023 Lyme case data"
          note={humanNote(detail)}
          state={humanState}
          value={humanValue(detail)}
        />
        <EvidenceItem
          label="Tick evidence"
          note={tickNote(detail)}
          state={tickState}
          value={statusText(detail.tick_status)}
        />
        <EvidenceItem
          label="Lyme bacterium in ticks"
          note="Present means detection in at least one sampled host-seeking Ixodes tick."
          state={pathogenState}
          value={statusText(detail.burgdorferi_status)}
        />
      </div>
      <details className="county-evidence-context">
        <summary>Show community context and completeness</summary>
        <dl>
          <div>
            <dt>Scored inputs available</dt>
            <dd>{detail.evidence_completeness}%</dd>
          </div>
          <div>
            <dt>Social Vulnerability Index</dt>
            <dd>
              {detail.svi_percentile == null
                ? "Unavailable"
                : `${Math.round(detail.svi_percentile * 100)}th percentile`}
            </dd>
          </div>
          <div>
            <dt>Uninsured rate</dt>
            <dd>
              {detail.uninsured_percent == null
                ? "Unavailable"
                : `${detail.uninsured_percent}%`}
            </dd>
          </div>
          <div>
            <dt>Rural–urban classification (2023)</dt>
            <dd>{detail.rucc_2023 ?? "Unavailable"}</dd>
          </div>
        </dl>
      </details>
      {detail.release && (
        <details className="county-evidence-provenance">
          <summary>Show source, release, and methodology context</summary>
          <p>
            Release {detail.release.release_id} · methodology{" "}
            {detail.release.methodology_version} · generated{" "}
            {detail.release.generated_at} · loaded {detail.release.loaded_at}
          </p>
          <ul>
            {detail.release.sources.map((source) => (
              <li key={source.key}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.label} ({source.vintage})
                  <span aria-hidden="true"> ↗</span>
                </a>
                <span>{source.note}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function CountyUncertaintyPanel({ detail }: { detail: CountyDetail }) {
  const headingId = `county-uncertainty-heading-${detail.fips}`;
  return (
    <section
      aria-labelledby={headingId}
      className="county-uncertainty-panel"
      role="note"
    >
      <span className="eyebrow">Uncertainty and limits</span>
      <h3 id={headingId}>What to keep in mind</h3>
      <ul>
        {uncertaintyCuesFor(detail).map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ul>
      <p>
        <strong>Guardrail:</strong> {detail.release.limitations}
      </p>
    </section>
  );
}
