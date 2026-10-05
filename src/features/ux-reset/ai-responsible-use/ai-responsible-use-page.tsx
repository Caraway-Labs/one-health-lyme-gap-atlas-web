import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

import {
  aiResponsibleUseContent,
  capabilityClaims,
  documentationLinks,
  governanceBoundaries,
  maturityDefinitions,
  maturityLabel,
  workKinds,
  type CapabilityMaturity,
} from "./content";

function humanDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function MaturityBadge({ maturity }: { maturity: CapabilityMaturity }) {
  return (
    <Badge
      className="ux-reset-capability-maturity"
      data-maturity={maturity}
      variant="outline"
    >
      {maturityLabel(maturity)}
    </Badge>
  );
}

function DocumentationAnchor({
  href,
  label,
  opensNewTab,
}: {
  href: string;
  label: string;
  opensNewTab: boolean;
}) {
  return (
    <Link
      href={href}
      rel={opensNewTab ? "noopener noreferrer" : undefined}
      target={opensNewTab ? "_blank" : undefined}
    >
      {label}
      {opensNewTab ? (
        <span className="sr-only"> (opens in a new tab)</span>
      ) : null}
    </Link>
  );
}

export function AiResponsibleUsePage() {
  return (
    <>
      <header className="ux-reset-page-header">
        <p className="eyebrow">Trust</p>
        <h1>{aiResponsibleUseContent.title}</h1>
        <p className="type-body">{aiResponsibleUseContent.summary}</p>
      </header>

      <section
        aria-labelledby="ai-maturity-legend"
        className="ux-reset-trust-section"
      >
        <h2 className="type-card" id="ai-maturity-legend">
          Capability maturity
        </h2>
        <p className="type-body">{aiResponsibleUseContent.maturityNote}</p>
        <ul className="ux-reset-maturity-legend">
          {maturityDefinitions.map((item) => (
            <li key={item.maturity}>
              <MaturityBadge maturity={item.maturity} />
              <p className="type-body">{item.definition}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="ai-work-kinds"
        className="ux-reset-trust-section"
      >
        <h2 className="type-card" id="ai-work-kinds">
          Kinds of work
        </h2>
        <p className="type-body">
          Read each output as one of these kinds of work. The kind of work is
          separate from both capability maturity and evidence availability.
        </p>
        <dl className="ux-reset-work-kinds">
          {workKinds.map((kind) => (
            <div key={kind.id}>
              <dt className="type-card">{kind.term}</dt>
              <dd className="type-body">{kind.definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="ai-capabilities"
        className="ux-reset-trust-section"
      >
        <h2 className="type-card" id="ai-capabilities">
          How Atlas uses analysis and AI
        </h2>
        <ul className="ux-reset-capability-list">
          {capabilityClaims.map((claim) => (
            <li key={claim.id}>
              <Card>
                <CardHeader>
                  <MaturityBadge maturity={claim.maturity} />
                  <h3 className="type-card">{claim.title}</h3>
                  <CardDescription>{claim.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="type-body">{claim.boundary}</p>
                  <p className="type-small">
                    <strong>Status basis: </strong>
                    {claim.statusBasis}
                  </p>
                  <p className="type-body">
                    <DocumentationAnchor
                      href={claim.docHref}
                      label={claim.docLabel}
                      opensNewTab
                    />
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ai-boundaries">
        <Card>
          <CardHeader>
            <MaturityBadge maturity={governanceBoundaries.maturity} />
            <h2 className="type-card" id="ai-boundaries">
              {governanceBoundaries.title}
            </h2>
            <CardDescription>{governanceBoundaries.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul>
              {governanceBoundaries.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="ai-docs" className="ux-reset-trust-section">
        <h2 className="type-card" id="ai-docs">
          Deeper documentation
        </h2>
        <p className="type-body">
          Docs remain the reference for methods, evidence interpretation, and
          API access. The public AI Ethics page stays available for readers who
          are not in this workspace.
        </p>
        <nav aria-label="Deeper documentation">
          <ul className="ux-reset-doc-links">
            {documentationLinks.map((link) => (
              <li key={link.href}>
                <DocumentationAnchor
                  href={link.href}
                  label={link.label}
                  opensNewTab={link.opensNewTab}
                />
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <footer aria-label="AI / Responsible Use document version">
        <p className="type-small">
          <strong>Version {aiResponsibleUseContent.version}</strong>
          <span aria-hidden="true"> · </span>
          <time dateTime={aiResponsibleUseContent.lastUpdated}>
            Last updated {humanDate(aiResponsibleUseContent.lastUpdated)}
          </time>
        </p>
      </footer>
    </>
  );
}
