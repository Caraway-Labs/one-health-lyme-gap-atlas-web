import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { DataProvenanceCatalog } from "@/features/public-trust/data-provenance-catalog";
import { humanDate } from "@/features/public-trust/human-date";
import {
  PublicTrustActions,
  PublicTrustIntro,
  PublicTrustPage,
} from "@/features/public-trust/public-trust-page";
import { TrustCard } from "@/features/public-trust/trust-card";

import "@/features/ux-reset/trust-footer.css";
import { dataProvenanceContent } from "@/lib/data-provenance-content";
import { ATLAS_OVERVIEW_PATH } from "@/lib/navigation";

export function DataProvenancePage() {
  const content = dataProvenanceContent;

  return (
    <PublicTrustPage>
      <PublicTrustIntro
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
      >
        <p>{content.hero.lead}</p>
        <p className="public-trust-note">{content.hero.note}</p>
      </PublicTrustIntro>

      <section
        aria-labelledby="provenance-glance"
        className="public-trust-section"
      >
        <h2 id="provenance-glance">{content.glance.title}</h2>
        <dl className="public-trust-facts">
          {content.glance.facts.map((fact) => (
            <div key={fact.term}>
              <dt>{fact.term}</dt>
              <dd>{fact.definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="provenance-steps"
        className="public-trust-section"
      >
        <AtlasSectionHeader
          className="public-trust-section-heading"
          description={content.stepsIntro.description}
          eyebrow={content.stepsIntro.eyebrow}
          title={content.stepsIntro.title}
          titleId="provenance-steps"
        />
        <ol className="public-trust-cards public-trust-cards--flow">
          {content.steps.map((step, index) => (
            <li key={step.title}>
              <TrustCard kicker={`Step ${index + 1}`} title={step.title}>
                <p>{step.text}</p>
              </TrustCard>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="provenance-sources"
        className="public-trust-section"
      >
        <AtlasSectionHeader
          className="public-trust-section-heading"
          description={content.catalog.description}
          eyebrow={content.catalog.eyebrow}
          title={content.catalog.title}
          titleId="provenance-sources"
        />
        <DataProvenanceCatalog />
        <p className="public-trust-callout">{content.attribution}</p>
      </section>

      <section
        aria-labelledby="provenance-reading"
        className="public-trust-section"
      >
        <AtlasSectionHeader
          className="public-trust-section-heading"
          eyebrow={content.readingIntro.eyebrow}
          title={content.readingIntro.title}
          titleId="provenance-reading"
        />
        <div className="public-trust-cards public-trust-cards--pair">
          {content.readingCards.map((card) => (
            <TrustCard key={card.title} title={card.title}>
              <p>{card.text}</p>
            </TrustCard>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="provenance-limits"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="provenance-limits">{content.limitsIntro.title}</h2>
          <p>{content.limitsIntro.intro}</p>
          <ul>
            {content.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="provenance-learn"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="provenance-learn">{content.learnMore.title}</h2>
          <ul>
            {content.learnMore.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
          <p>
            {content.feedback.before}
            <strong>{content.feedback.emphasis}</strong>
            {content.feedback.after}
          </p>
        </div>
      </section>

      <div
        aria-label="Data Provenance document version"
        className="public-trust-version"
        role="group"
      >
        <p>
          <strong>Version {content.version}</strong>
          <span aria-hidden="true"> · </span>
          <time dateTime={content.lastUpdated}>
            Last updated {humanDate(content.lastUpdated)}
          </time>
        </p>
      </div>

      <PublicTrustActions>
        <Link
          className="public-trust-return"
          href={`${ATLAS_OVERVIEW_PATH}#atlas`}
        >
          Return to the Atlas
        </Link>
      </PublicTrustActions>
    </PublicTrustPage>
  );
}
