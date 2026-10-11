import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  PublicTrustActions,
  PublicTrustIntro,
  PublicTrustPage,
} from "@/features/public-trust/public-trust-page";

import "@/features/ux-reset/trust-footer.css";
import {
  aiEthicsContent,
  type AiEthicsStatementStatus,
} from "@/lib/ai-ethics-content";
import { ATLAS_OVERVIEW_PATH, pageMetadataForRoute } from "@/lib/navigation";

export const metadata = pageMetadataForRoute("/ai-ethics");

const statusLabels: Record<AiEthicsStatementStatus, string> = {
  current: "What Atlas does today",
  "approved-architecture": "Approved direction; release pending",
  "pending-decision": "Commitment in development",
};

function humanDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function AiEthicsPage() {
  return (
    <PublicTrustPage>
      <PublicTrustIntro
        eyebrow="Trust, evidence, and accountability"
        title={aiEthicsContent.introduction.title}
      >
        <p>{aiEthicsContent.introduction.summary}</p>
        <p className="public-trust-note">
          {aiEthicsContent.introduction.audienceNote}
        </p>
      </PublicTrustIntro>

      <section aria-labelledby="ethics-status" className="public-trust-section">
        <AtlasSectionHeader
          className="public-trust-section-heading"
          eyebrow="Clear about the status of our work"
          title="What is true today, planned, and undecided"
          titleId="ethics-status"
        />

        <div className="public-trust-cards public-trust-cards--trio">
          {aiEthicsContent.statements.map((statement) => (
            <article key={statement.title}>
              <Card className="overflow-visible">
                <CardHeader>
                  <Badge
                    className="public-trust-status h-auto max-w-full whitespace-normal"
                    data-status={statement.status}
                    variant="outline"
                  >
                    {statusLabels[statement.status]}
                  </Badge>
                  <h3>{statement.title}</h3>
                </CardHeader>
                <CardContent>
                  <p>{statement.summary}</p>
                  <details>
                    <summary>Technical detail and source</summary>
                    <p>{statement.detail}</p>
                    <p className="public-trust-evidence">
                      <strong>Basis:</strong> {statement.evidence}
                    </p>
                  </details>
                </CardContent>
              </Card>
            </article>
          ))}
        </div>

        <section
          aria-labelledby="ethics-boundaries"
          className="public-trust-section"
        >
          <div className="public-trust-prose">
            <h2 id="ethics-boundaries">What Atlas AI is not for</h2>
            <ul>
              {aiEthicsContent.boundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="ethics-open-questions"
          className="public-trust-section"
        >
          <div className="public-trust-split">
            <div>
              <p className="eyebrow">Open questions</p>
              <h2 id="ethics-open-questions">Commitments in development</h2>
            </div>
            <p>
              These questions are public on purpose. They are not policies or
              promises until product decisions are reviewed and recorded.
            </p>
          </div>
          <dl className="public-trust-cards public-trust-cards--pair public-trust-definitions">
            {aiEthicsContent.openCommitments.map((commitment) => (
              <Card className="overflow-visible" key={commitment.topic}>
                <dt>{commitment.topic}</dt>
                <dd>{commitment.question}</dd>
              </Card>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="ethics-related-work"
          className="public-trust-section"
        >
          <h2 id="ethics-related-work">Related trust work</h2>
          <div className="public-trust-cards public-trust-cards--pair">
            {aiEthicsContent.relatedWork.map((work) => (
              <article key={work.topic}>
                <Card className="overflow-visible">
                  <CardHeader>
                    <h3>{work.topic}</h3>
                  </CardHeader>
                  <CardContent>
                    <p>{work.detail}</p>
                  </CardContent>
                </Card>
              </article>
            ))}
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
          <p>{aiEthicsContent.maintenance.review}</p>
          <p>{aiEthicsContent.maintenance.updateRule}</p>
        </div>
      </section>

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
