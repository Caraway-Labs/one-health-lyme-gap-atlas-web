import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { humanDate } from "@/features/public-trust/human-date";
import {
  PublicTrustActions,
  PublicTrustIntro,
  PublicTrustPage,
} from "@/features/public-trust/public-trust-page";
import { TrustCard } from "@/features/public-trust/trust-card";

import "@/features/ux-reset/trust-footer.css";
import { ATLAS_OVERVIEW_PATH, pageMetadataForRoute } from "@/lib/navigation";
import { privacyContent } from "@/lib/privacy-content";

export const metadata = pageMetadataForRoute("/privacy");

function EmphasisParagraph({
  after,
  before,
  emphasis,
}: {
  readonly after: string;
  readonly before: string;
  readonly emphasis: string;
}) {
  return (
    <p>
      {before}
      <strong>{emphasis}</strong>
      {after}
    </p>
  );
}

function FactList<
  Fact extends { readonly term: string; readonly text: string },
>({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="public-trust-facts">
      {facts.map((fact) => (
        <div key={fact.term}>
          <dt>{fact.term}</dt>
          <dd>{fact.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function QuestionsParagraph() {
  const { before, between, closing, conjunction, emphasis, links } =
    privacyContent.questions;
  const [ethics, about] = links;

  return (
    <p>
      {before}
      <strong>{emphasis}</strong>
      {between}
      <Link href={ethics.href}>{ethics.label}</Link>
      {conjunction}
      <Link href={about.href}>{about.label}</Link>
      {closing}
    </p>
  );
}

export default function PrivacyPage() {
  const { account, request } = privacyContent.rights;

  return (
    <PublicTrustPage>
      <PublicTrustIntro
        eyebrow={privacyContent.hero.eyebrow}
        title={privacyContent.hero.title}
      >
        <p>{privacyContent.hero.lead}</p>
        <p className="public-trust-note">{privacyContent.hero.note}</p>
      </PublicTrustIntro>

      <section
        aria-labelledby="privacy-commitments"
        className="public-trust-section"
      >
        <AtlasSectionHeader
          className="public-trust-section-heading"
          eyebrow={privacyContent.commitmentsIntro.eyebrow}
          title={privacyContent.commitmentsIntro.title}
          titleId="privacy-commitments"
        />
        <div className="public-trust-cards public-trust-cards--trio">
          {privacyContent.commitments.map((commitment) => (
            <TrustCard key={commitment.title} title={commitment.title}>
              <p>{commitment.text}</p>
            </TrustCard>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="privacy-collection"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-collection">{privacyContent.collection.title}</h2>
          <p>{privacyContent.collection.intro}</p>
        </div>
        <FactList facts={privacyContent.collection.facts} />
      </section>

      <section
        aria-labelledby="privacy-questions-asked"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-questions-asked">
            {privacyContent.questionsAsked.title}
          </h2>
          {privacyContent.questionsAsked.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="privacy-analytics"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-analytics">{privacyContent.analytics.title}</h2>
          <EmphasisParagraph {...privacyContent.analytics.choice} />
          <p>{privacyContent.analytics.follow}</p>
          <h3 id="privacy-analytics-exclusions">
            {privacyContent.analytics.exclusionsTitle}
          </h3>
          <ul>
            {privacyContent.analytics.exclusions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="privacy-providers"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-providers">{privacyContent.providers.title}</h2>
          <p>{privacyContent.providers.intro}</p>
        </div>
        <FactList facts={privacyContent.providers.facts} />
      </section>

      <section
        aria-labelledby="privacy-retention"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-retention">{privacyContent.retention.title}</h2>
        </div>
        <FactList facts={privacyContent.retention.facts} />
      </section>

      <section
        aria-labelledby="privacy-rights"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-rights">{privacyContent.rights.title}</h2>
          <p>
            {account.before}
            <strong>{account.first}</strong>
            {account.between}
            <strong>{account.second}</strong>
            {account.after}
          </p>
          <p>{privacyContent.rights.completion}</p>
          <p>{privacyContent.rights.unlinked}</p>
          <EmphasisParagraph {...request} />
        </div>
      </section>

      <section
        aria-labelledby="privacy-security"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-security">{privacyContent.security.title}</h2>
          {privacyContent.security.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="privacy-children"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-children">{privacyContent.children.title}</h2>
          <EmphasisParagraph
            after={privacyContent.children.after}
            before={privacyContent.children.before}
            emphasis={privacyContent.children.emphasis}
          />
        </div>
      </section>

      <section
        aria-labelledby="privacy-international"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-international">
            {privacyContent.international.title}
          </h2>
          <p>{privacyContent.international.text}</p>
        </div>
      </section>

      <section
        aria-labelledby="privacy-changes"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-changes">{privacyContent.changes.title}</h2>
          <p>{privacyContent.changes.text}</p>
        </div>
      </section>

      <section
        aria-labelledby="privacy-requests"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="privacy-requests">{privacyContent.questions.title}</h2>
          <QuestionsParagraph />
        </div>
      </section>

      <div
        aria-label={privacyContent.versionLabel}
        className="public-trust-version"
        role="group"
      >
        <p>
          <strong>
            {privacyContent.versionPrefix} {privacyContent.version}
          </strong>
          <span aria-hidden="true"> · </span>
          <time dateTime={privacyContent.lastUpdated}>
            {privacyContent.updatedPrefix}{" "}
            {humanDate(privacyContent.lastUpdated)}
          </time>
        </p>
      </div>

      <PublicTrustActions>
        <Link
          className="public-trust-return"
          href={`${ATLAS_OVERVIEW_PATH}#atlas`}
        >
          {privacyContent.actions.returnLabel}
        </Link>
      </PublicTrustActions>
    </PublicTrustPage>
  );
}
