import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import type { ExplorerMapPaint } from "@/features/ux-reset/review/explorer-map-layers";

export function ExplorerMapLegend({ paint }: { paint: ExplorerMapPaint }) {
  const unit = paint.unit ? ` · ${paint.unit}` : "";
  return (
    <section
      aria-label={`${paint.title} map legend`}
      className="ux-reset-explorer-legend"
      data-legend-kind={paint.kind}
      data-legend-layer={paint.layerId}
      data-testid="explorer-map-legend"
      data-unit={paint.unit ?? ""}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable map legend inside the fixed map card
      tabIndex={0}
    >
      <p className="type-small">
        <strong>{paint.title}</strong>
        {unit}
      </p>
      {paint.selection ? <p className="type-small">{paint.selection}</p> : null}
      {paint.selectionEvidence ? (
        <EvidenceObject
          claimHeadingLevel="h4"
          model={paint.selectionEvidence}
          showReason
        />
      ) : null}
      {paint.entries.length > 0 ? (
        <ul aria-label={`${paint.title} colors`}>
          {paint.entries.map((entry) => (
            <li key={`${entry.color}|${entry.label}|${entry.detail ?? ""}`}>
              <span aria-hidden="true" style={{ background: entry.color }} />
              <span>
                {entry.label}
                {entry.detail ? ` · ${entry.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="type-small">{paint.period}</p>
      <p className="type-small">{paint.note}</p>
    </section>
  );
}
