"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  formatAtlasTimestamp,
  parseAtlasDateTime,
} from "@/lib/atlas-evidence-metadata";

import {
  sourceIdFromProvenanceHash,
  type CollectionRead,
  type DataProvenanceCatalog,
  type ProvenanceFamilyGroup,
  type ProvenanceSourceCard,
} from "./catalog";
import {
  DATA_PROVENANCE_SUBTITLE,
  DATA_PROVENANCE_TITLE,
  PROVENANCE_DOC_LINKS,
  PROVENANCE_LIMITATIONS,
  PROVENANCE_PIPELINE,
} from "./content";
import { loadDataProvenanceCatalog } from "./load-catalog";

import "./data-provenance.css";

const NOT_PROVIDED = "Not provided";

type LoadState = "error" | "loading" | "ready";

function timestampText(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = parseAtlasDateTime(value);
  if (!parsed) {
    return "Unavailable";
  }
  return formatAtlasTimestamp(parsed);
}

function ProvenanceTimestamp({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const parsed = value ? parseAtlasDateTime(value) : null;
  const text = timestampText(value);
  if (!text) {
    return null;
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd>{parsed ? <time dateTime={parsed}>{text}</time> : text}</dd>
    </div>
  );
}

function TextField({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function domainText(
  card: ProvenanceSourceCard,
  indicatorsRead: CollectionRead,
  measuresRead: CollectionRead
): string {
  if (card.domains.length > 0) {
    return card.domains.join(", ");
  }
  if (measuresRead !== "complete" || indicatorsRead !== "complete") {
    return "Unavailable";
  }
  return NOT_PROVIDED;
}

function measureAbsenceCopy(measuresRead: CollectionRead): string {
  switch (measuresRead) {
    case "unavailable": {
      return "Related measure metadata could not be loaded.";
    }
    case "incomplete": {
      return "Related measure metadata is incomplete, so this source's measures may be missing.";
    }
    case "complete": {
      return "No governed measure in this release lists this source.";
    }
    default: {
      const unreachable: never = measuresRead;
      return unreachable;
    }
  }
}

function otherSourcesCopy(catalog: DataProvenanceCatalog): string {
  switch (catalog.measuresRead) {
    case "unavailable": {
      return "Related measure metadata could not be loaded, so evidence domains are not assigned. These sources are still in the current release.";
    }
    case "incomplete": {
      return "Related measure metadata is incomplete, so a missing evidence domain is not proof that this source has none.";
    }
    case "complete": {
      break;
    }
    default: {
      const unreachable: never = catalog.measuresRead;
      return unreachable;
    }
  }
  switch (catalog.indicatorsRead) {
    case "unavailable": {
      return "Indicator metadata could not be loaded, so evidence domains are not assigned. These sources are still in the current release.";
    }
    case "incomplete": {
      return "Indicator metadata is incomplete, so a missing evidence domain is not proof that this source has none.";
    }
    case "complete": {
      return "These sources are in the current release. No governed indicator domain places them in human surveillance, ticks and pathogens, environment, or population context.";
    }
    default: {
      const unreachable: never = catalog.indicatorsRead;
      return unreachable;
    }
  }
}

function SourceCardDetails({
  card,
  indicatorsRead,
  measuresRead,
}: {
  card: ProvenanceSourceCard;
  indicatorsRead: CollectionRead;
  measuresRead: CollectionRead;
}) {
  return (
    <details
      className="ux-reset-provenance-source"
      data-source-id={card.sourceId}
      data-testid="data-provenance-source"
      id={card.anchorId}
      onToggle={(event) => {
        if (!event.currentTarget.open) {
          return;
        }
        const nextHash = `#${card.anchorId}`;
        if (window.location.hash === nextHash) {
          return;
        }
        window.history.pushState(null, "", nextHash);
      }}
    >
      <summary>
        <span className="ux-reset-provenance-source-name">{card.label}</span>
        <span className="type-small">
          Publisher: {card.publisher ?? NOT_PROVIDED}
        </span>
        <span className="type-small">
          Evidence domain: {domainText(card, indicatorsRead, measuresRead)}
        </span>
        <span className="type-small">Source type: {NOT_PROVIDED}</span>
        <span className="type-small">Description: {NOT_PROVIDED}</span>
      </summary>
      <div className="ux-reset-provenance-source-body">
        <dl className="ux-reset-provenance-fields">
          <TextField label="Dataset" value={card.datasetId} />
          <TextField label="Lineage source" value={card.lineageSourceId} />
          <TextField label="Source vintage" value={card.sourceVintage} />
          <TextField label="Source version" value={card.sourceVersion} />
          <ProvenanceTimestamp
            label="Publication time"
            value={card.publishedAt}
          />
          <ProvenanceTimestamp
            label="Publisher update"
            value={card.upstreamUpdatedAt}
          />
          <ProvenanceTimestamp
            label="Source retrieval"
            value={card.sourceRetrievedAt}
          />
          <ProvenanceTimestamp
            label="Atlas acquisition"
            value={card.atlasAcquiredAt}
          />
          <TextField
            label="Semantic contract version"
            value={card.semanticVersion}
          />
          <TextField
            label="Release relationship version"
            value={card.releaseVersion}
          />
          {card.sourceUrl ? (
            <div>
              <dt>Canonical source</dt>
              <dd>
                <a
                  href={card.sourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open publisher source
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        <div>
          <h4 className="type-card">Limitations</h4>
          {card.limitations.length > 0 ? (
            <ul>
              {card.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : (
            <p>No governed limitations were returned for this source.</p>
          )}
        </div>
        <div>
          <h4 className="type-card">Related measures</h4>
          {card.measures.length > 0 ? (
            card.measures.map((measure) => (
              <dl
                className="ux-reset-provenance-measure"
                key={measure.measureId}
              >
                <div>
                  <dt>Measure</dt>
                  <dd>{measure.label}</dd>
                </div>
                <TextField label="Definition" value={measure.definition} />
                <TextField label="Measure type" value={measure.measureType} />
                <TextField
                  label="Geography"
                  value={
                    measure.geographySemantics ??
                    (measure.geographyTypes.length > 0
                      ? measure.geographyTypes.join(", ")
                      : null)
                  }
                />
                <TextField
                  label="Observed period semantics"
                  value={
                    measure.temporalSemantics ??
                    (measure.temporalGrains.length > 0
                      ? measure.temporalGrains.join(", ")
                      : null)
                  }
                />
                <TextField
                  label="Missingness and suppression"
                  value={measure.missingnessSemantics}
                />
                <TextField label="Methodology" value={measure.methodology} />
                <TextField
                  label="Methodology id"
                  value={measure.methodologyId}
                />
                {measure.limitations.length > 0 ? (
                  <div>
                    <dt>Measure limitations</dt>
                    <dd>{measure.limitations.join(" ")}</dd>
                  </div>
                ) : null}
              </dl>
            ))
          ) : (
            <p>{measureAbsenceCopy(measuresRead)}</p>
          )}
        </div>
      </div>
    </details>
  );
}

function FamilyList({
  family,
  indicatorsRead,
  measuresRead,
}: {
  family: ProvenanceFamilyGroup;
  indicatorsRead: CollectionRead;
  measuresRead: CollectionRead;
}) {
  return (
    <section aria-labelledby={`provenance-family-${family.id}`}>
      <h3 className="type-card" id={`provenance-family-${family.id}`}>
        {family.label}
      </h3>
      <ul className="ux-reset-provenance-family">
        {family.entries.map((entry) => (
          <li key={`${family.id}-${entry.card.sourceId}`}>
            {entry.kind === "card" ? (
              <SourceCardDetails
                card={entry.card}
                indicatorsRead={indicatorsRead}
                measuresRead={measuresRead}
              />
            ) : (
              <p>
                <a href={`#${entry.card.anchorId}`}>{entry.card.label}</a> is
                listed under {entry.primaryLabel}. The same source is not given
                a second record.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MetadataStatus({ catalog }: { catalog: DataProvenanceCatalog }) {
  return (
    <>
      {catalog.measuresRead === "unavailable" ? (
        <p>Related measure metadata could not be loaded.</p>
      ) : null}
      {catalog.measuresRead === "incomplete" ? (
        <p>
          Related measure metadata is incomplete, so some source relationships
          may be missing.
        </p>
      ) : null}
      {catalog.indicatorsRead === "unavailable" ? (
        <p>
          Indicator metadata could not be loaded, so evidence domains are not
          assigned.
        </p>
      ) : null}
      {catalog.indicatorsRead === "incomplete" ? (
        <p>
          Indicator metadata is incomplete, so some evidence domains may be
          missing.
        </p>
      ) : null}
    </>
  );
}

function CatalogRegion({
  catalog,
  loadState,
  unmatchedSource,
}: {
  catalog: DataProvenanceCatalog | null;
  loadState: LoadState;
  unmatchedSource: boolean;
}) {
  if (loadState === "loading") {
    return (
      <p className="ux-reset-provenance-status" role="status">
        Loading the current release source catalog.
      </p>
    );
  }
  if (loadState === "error" || !catalog) {
    return (
      <p className="ux-reset-provenance-status" role="alert">
        The source catalog could not be loaded. This is a request failure, not a
        statement that the release has no sources.
      </p>
    );
  }
  return (
    <>
      {unmatchedSource ? (
        <p data-testid="data-provenance-unmatched" role="status">
          This address does not match a source in the current release catalog.
          The list below is the general provenance page.
        </p>
      ) : null}
      {catalog.sourcesIncomplete ? (
        <p>
          The source list stopped before every page was read. It is not a
          complete inventory of the release.
        </p>
      ) : null}
      <MetadataStatus catalog={catalog} />
      {catalog.sources.length === 0 ? (
        <p>The current release returned no sources.</p>
      ) : (
        <>
          {catalog.families.map((family) => (
            <FamilyList
              family={family}
              indicatorsRead={catalog.indicatorsRead}
              key={family.id}
              measuresRead={catalog.measuresRead}
            />
          ))}
          {catalog.other.length > 0 ? (
            <section aria-labelledby="provenance-family-other">
              <h3 className="type-card" id="provenance-family-other">
                Other released sources
              </h3>
              <p className="type-body">{otherSourcesCopy(catalog)}</p>
              <ul className="ux-reset-provenance-sources">
                {catalog.other.map((card) => (
                  <li key={card.sourceId}>
                    <SourceCardDetails
                      card={card}
                      indicatorsRead={catalog.indicatorsRead}
                      measuresRead={catalog.measuresRead}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      <section aria-labelledby="provenance-planned-families">
        <h3 className="type-card" id="provenance-planned-families">
          Source families that are not in this catalog
        </h3>
        <ul className="ux-reset-provenance-family">
          <li>
            <Badge variant="outline">Planned</Badge>
            <h4 className="type-card">Literature</h4>
            <p>
              Literature is not a source family in the current release catalog.
              Ask Atlas can request reviewed literature when that service is
              enabled. That is separate from these source cards. Feed does not
              yet list items.
            </p>
          </li>
          <li>
            <Badge variant="outline">Not a source family</Badge>
            <h4 className="type-card">Models and methods</h4>
            <p>
              No released source in this catalog is a model. Scoring methodology
              is the rules that combine released inputs into the county review
              score. That score is a derived follow-up priority, not predicted
              Lyme risk.
            </p>
          </li>
        </ul>
      </section>
    </>
  );
}

export function DataProvenanceView({
  catalog,
  loadState,
}: {
  catalog: DataProvenanceCatalog | null;
  loadState: LoadState;
}) {
  const [unmatchedSource, setUnmatchedSource] = useState(false);

  useEffect(() => {
    if (loadState !== "ready" || !catalog) {
      return;
    }
    const known = new Set(catalog.sources.map((source) => source.sourceId));
    const applyHash = () => {
      const sourceId = sourceIdFromProvenanceHash(window.location.hash);
      if (!sourceId) {
        setUnmatchedSource(false);
        return;
      }
      if (!known.has(sourceId)) {
        setUnmatchedSource(true);
        for (const element of document.querySelectorAll(
          "details.ux-reset-provenance-source"
        )) {
          if (element instanceof HTMLDetailsElement) {
            element.open = false;
          }
        }
        return;
      }
      setUnmatchedSource(false);
      const anchorId = catalog.sources.find(
        (source) => source.sourceId === sourceId
      )?.anchorId;
      const card = anchorId
        ? document.querySelector(`#${CSS.escape(anchorId)}`)
        : null;
      if (card instanceof HTMLDetailsElement) {
        card.open = true;
        card.scrollIntoView({ block: "start" });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
    };
  }, [catalog, loadState]);

  return (
    <article className="ux-reset-provenance-page">
      <header className="ux-reset-page-header">
        <h1>{DATA_PROVENANCE_TITLE}</h1>
        <p className="type-body">{DATA_PROVENANCE_SUBTITLE}</p>
      </header>

      <section aria-labelledby="provenance-where">
        <h2 className="type-card" id="provenance-where">
          Where our data comes from
        </h2>
        <p>
          The current release reads open public evidence through the product and
          the public API. A shared evidence model keeps the source attached. It
          does not make two sources the same measurement.
        </p>
        <p>
          An observed or published value is what a source reported for a
          geography and period. A derived measure, including the county review
          score, is calculated from released inputs. Contextual evidence, such
          as population or environment, keeps its own source and limitations. A
          modeled outbreak or individual-risk output is not a promise of this
          release. Ask Atlas, when it is enabled, answers from reviewed
          literature and is not this source catalog.
        </p>
        <p>
          The public source resource does not include a separate source-type or
          description field. Cards say Not provided for those rows.
        </p>
      </section>

      <section aria-labelledby="provenance-sources">
        <h2 className="type-card" id="provenance-sources">
          Explore data sources
        </h2>
        <p>
          Families appear only when a governed indicator domain in this release
          uses that source. Opening a card stays on this page.
        </p>
        <CatalogRegion
          catalog={catalog}
          loadState={loadState}
          unmatchedSource={unmatchedSource}
        />
      </section>

      <section aria-labelledby="provenance-pipeline">
        <h2 className="type-card" id="provenance-pipeline">
          How Atlas handles evidence
        </h2>
        <p>
          These five stages are a conceptual picture. They are not an execution
          log, and they are not a claim that every stage is separately
          observable in this release.
        </p>
        <p className="sr-only">
          Conceptual order: Source, then Validate, then Transform, then Release,
          then Explore.
        </p>
        <ol
          aria-label="Conceptual evidence pipeline"
          className="ux-reset-provenance-pipeline"
        >
          {PROVENANCE_PIPELINE.map((stage, index) => (
            <li key={stage.id}>
              <h3 className="type-card">
                <span className="sr-only">
                  Stage {index + 1} of {PROVENANCE_PIPELINE.length}.{" "}
                </span>
                {stage.label}
              </h3>
              <p>{stage.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="provenance-limitations">
        <h2 className="type-card" id="provenance-limitations">
          Interpretation and limitations
        </h2>
        <ul>
          {PROVENANCE_LIMITATIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <nav aria-label="Methodology documentation">
          <ul className="ux-reset-doc-links">
            {PROVENANCE_DOC_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </article>
  );
}

export function DataProvenanceExperience() {
  const query = useQuery({
    queryFn: ({ signal }) => loadDataProvenanceCatalog(signal),
    queryKey: ["data-provenance-catalog"],
  });
  const loadState: LoadState = query.isPending
    ? "loading"
    : query.isError
      ? "error"
      : "ready";
  return (
    <DataProvenanceView catalog={query.data ?? null} loadState={loadState} />
  );
}
