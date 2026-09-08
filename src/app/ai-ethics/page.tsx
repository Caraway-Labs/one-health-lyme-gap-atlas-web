import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import {
  aiEthicsContent,
  type AiEthicsStatementStatus,
} from "@/lib/ai-ethics-content";

export const metadata: Metadata = {
  title: "AI Ethics | One Health Lyme Gap Atlas",
  description:
    "How One Health Lyme Gap Atlas uses AI today, the evidence boundaries it follows, and the commitments still being decided.",
};

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
    <main className="ethics-page">
      <section className="ethics-hero">
        <p className="eyebrow light">Trust, evidence, and accountability</p>
        <h1>{aiEthicsContent.introduction.title}</h1>
        <p>{aiEthicsContent.introduction.summary}</p>
        <p className="ethics-audience-note">
          {aiEthicsContent.introduction.audienceNote}
        </p>
        <Link className="button ghost" href="/#atlas">
          Return to the Atlas
        </Link>
      </section>

      <section
        className="ethics-content section"
        aria-labelledby="ethics-status"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clear about the status of our work</p>
            <h2 id="ethics-status">
              What is true today, planned, and undecided
            </h2>
          </div>
        </div>

        <div className="ethics-statements">
          {aiEthicsContent.statements.map((statement) => (
            <article key={statement.title} className="ethics-statement">
              <p className={`ethics-status ethics-status-${statement.status}`}>
                {statusLabels[statement.status]}
              </p>
              <h3>{statement.title}</h3>
              <p>{statement.summary}</p>
              <details>
                <summary>Technical detail and source</summary>
                <p>{statement.detail}</p>
                <p className="ethics-evidence">
                  <strong>Basis:</strong> {statement.evidence}
                </p>
              </details>
            </article>
          ))}
        </div>

        <section className="ethics-section" aria-labelledby="ethics-boundaries">
          <h2 id="ethics-boundaries">What Atlas AI is not for</h2>
          <ul>
            {aiEthicsContent.boundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </section>

        <section
          className="ethics-section"
          aria-labelledby="ethics-open-questions"
        >
          <div className="ethics-section-heading">
            <div>
              <p className="eyebrow">Open questions</p>
              <h2 id="ethics-open-questions">Commitments in development</h2>
            </div>
            <p>
              These questions are public on purpose. They are not policies or
              promises until product decisions are reviewed and recorded.
            </p>
          </div>
          <dl className="ethics-questions">
            {aiEthicsContent.openCommitments.map((commitment) => (
              <div key={commitment.topic}>
                <dt>{commitment.topic}</dt>
                <dd>{commitment.question}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="ethics-section ethics-related"
          aria-labelledby="ethics-related-work"
        >
          <h2 id="ethics-related-work">Related trust work</h2>
          <div>
            {aiEthicsContent.relatedWork.map((work) => (
              <article key={work.topic}>
                <h3>{work.topic}</h3>
                <p>{work.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <footer
          className="ethics-version"
          aria-label="AI Ethics document version"
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
        </footer>
      </section>
      <SiteFooter />
    </main>
  );
}

export default AiEthicsPage;
