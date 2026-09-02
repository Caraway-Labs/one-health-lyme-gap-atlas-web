import type { AtlasMetadata } from "@/generated/models";

export function MethodsSection({ metadata }: { metadata: AtlasMetadata }) {
  return (
    <section className="methods-section section" id="methods">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Data sources and limitations</span>
          <h2>How to interpret the Atlas</h2>
          <p>
            County data are combined using standard FIPS codes. Each source
            retains its year, source, and known limitations.
          </p>
        </div>
        <span className="version-stamp">
          Generated {new Date(metadata.generated_at).toLocaleDateString()} ·
          Loaded {new Date(metadata.loaded_at).toLocaleDateString()}
        </span>
      </div>
      <div className="source-grid">
        {metadata.sources.map((source, index) => (
          <a
            className="source-card"
            key={source.key}
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            <span>0{index + 1}</span>
            <h3>{source.label}</h3>
            <strong>{source.vintage}</strong>
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
    <article>
      <span className="guardrail-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
