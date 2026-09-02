export function AtlasHero() {
  return (
    <header className="hero">
      <div className="hero-content">
        <div>
          <span className="eyebrow light">
            For public health surveillance planning
          </span>
          <h1>Find counties that may deserve a closer look.</h1>
          <p>
            The Atlas compares published Lyme case data with tick, pathogen,
            rurality, and healthcare-access information to identify counties
            that may warrant review.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#atlas">
              Explore counties
            </a>
            <a className="button ghost" href="#methods">
              Understand the limitations
            </a>
          </div>
        </div>
        <aside className="hero-note">
          <span className="note-icon">i</span>
          <div>
            <strong>
              A starting point for review—not a Lyme risk estimate
            </strong>
            <p>
              The Atlas highlights patterns for epidemiologists to review. It
              does not show individual risk, prove where infection occurred, or
              confirm that Lyme is underreported.
            </p>
          </div>
        </aside>
      </div>
    </header>
  );
}
