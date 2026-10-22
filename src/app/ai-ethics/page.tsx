import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import {
  PublicTrustActions,
  PublicTrustIntro,
  PublicTrustPage,
} from "@/features/public-trust/public-trust-page";
import { TrustCard } from "@/features/public-trust/trust-card";

import "@/features/ux-reset/trust-footer.css";
import { aiEthicsContent } from "@/lib/ai-ethics-content";
import { ATLAS_OVERVIEW_PATH, pageMetadataForRoute } from "@/lib/navigation";

export const metadata = pageMetadataForRoute("/ai-ethics");

function humanDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function FeedbackParagraph() {
  const { before, between, emphasis, links } = aiEthicsContent.feedback;
  const [methods, access, privacy] = links;

  return (
    <p>
      {before}
      <strong>{emphasis}</strong>
      {between}
      <Link href={methods.href}>{methods.label}</Link>
      {", "}
      <Link href={access.href}>{access.label}</Link>
      {", and "}
      <Link href={privacy.href}>{privacy.label}</Link>.
    </p>
  );
}

export function AiEthicsPage() {
  return (
    <PublicTrustPage>
      <PublicTrustIntro
        eyebrow={aiEthicsContent.hero.eyebrow}
        title={aiEthicsContent.hero.title}
      >
        <p>{aiEthicsContent.hero.lead}</p>
        <p className="public-trust-note">{aiEthicsContent.hero.note}</p>
      </PublicTrustIntro>

      <section
        aria-labelledby="ethics-approach"
        className="public-trust-section"
      >
        <AtlasSectionHeader
          className="public-trust-section-heading"
          description={aiEthicsContent.approach.intro}
          eyebrow={aiEthicsContent.approach.eyebrow}
          title={aiEthicsContent.approach.title}
          titleId="ethics-approach"
        />
        <div className="public-trust-cards public-trust-cards--trio">
          {aiEthicsContent.pillars.map((pillar) => (
            <TrustCard
              key={pillar.title}
              kicker={pillar.name}
              title={pillar.title}
            >
              <p>{pillar.does}</p>
              <p>{pillar.matters}</p>
            </TrustCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="ethics-other" className="public-trust-section">
        <div className="public-trust-prose">
          <h2 id="ethics-other">
            {aiEthicsContent.otherCapabilitiesIntro.title}
          </h2>
          <p>{aiEthicsContent.otherCapabilitiesIntro.intro}</p>
          <ul>
            {aiEthicsContent.otherCapabilities.map((capability) => (
              <li key={capability.term}>
                <strong>{capability.term}</strong> {capability.description}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="ethics-layers" className="public-trust-section">
        <div className="public-trust-prose">
          <h2 id="ethics-layers">{aiEthicsContent.architecture.title}</h2>
          <p>{aiEthicsContent.architecture.intro}</p>
          <ol>
            {aiEthicsContent.architectureLayers.map((layer) => (
              <li key={layer.term}>
                <strong>{layer.term}</strong> {layer.description}
              </li>
            ))}
          </ol>
          <p>{aiEthicsContent.architecture.closing}</p>
        </div>
      </section>

      <section
        aria-labelledby="ethics-commitments"
        className="public-trust-section"
      >
        <AtlasSectionHeader
          className="public-trust-section-heading"
          eyebrow={aiEthicsContent.commitmentsIntro.eyebrow}
          title={aiEthicsContent.commitmentsIntro.title}
          titleId="ethics-commitments"
        />
        <div className="public-trust-cards public-trust-cards--pair">
          {aiEthicsContent.commitments.map((commitment) => (
            <TrustCard key={commitment.title} title={commitment.title}>
              <p>{commitment.text}</p>
            </TrustCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="ethics-limits" className="public-trust-section">
        <div className="public-trust-prose">
          <h2 id="ethics-limits">{aiEthicsContent.limitationsIntro.title}</h2>
          <p>{aiEthicsContent.limitationsIntro.intro}</p>
          <ul>
            {aiEthicsContent.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="ethics-feedback"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="ethics-feedback">{aiEthicsContent.feedback.title}</h2>
          <FeedbackParagraph />
        </div>
      </section>

      <div
        aria-label="AI Ethics document version"
        className="public-trust-version"
        role="group"
      >
        <p>
          <strong>Version {aiEthicsContent.version}</strong>
          <span aria-hidden="true"> · </span>
          <time dateTime={aiEthicsContent.lastUpdated}>
            Last updated {humanDate(aiEthicsContent.lastUpdated)}
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

export default AiEthicsPage;
