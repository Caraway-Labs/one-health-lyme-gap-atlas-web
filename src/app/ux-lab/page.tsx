import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  UX_LAB_AUDIENCES,
  UX_LAB_AUDIENCE_LABELS,
  UX_LAB_COMPARISON_CRITERIA,
  UX_LAB_CONCEPTS,
  UX_LAB_KNOWN_LIMITATIONS,
  UX_LAB_MOCKED_INTERACTIONS,
  UX_LAB_SAMPLE_NOTICE,
  UX_LAB_SESSION_ROUTES,
  UX_LAB_TESTING_LABEL,
  type UxLabConcept,
  uxLabConceptById,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";

const openConceptClassName = buttonVariants({
  className: "h-[var(--control-height)] bg-background px-4",
  size: "sm",
  variant: "outline",
});

function ConceptStatus({ concept }: { concept: UxLabConcept }) {
  switch (concept.status) {
    case "available": {
      return (
        <Link className={openConceptClassName} href={concept.href}>
          Open {concept.title}
        </Link>
      );
    }
    case "planned": {
      return <Badge variant="outline">Planned</Badge>;
    }
    default: {
      const exhaustive: never = concept.status;
      return exhaustive;
    }
  }
}

export function UxLabPage() {
  return (
    <main className="ux-lab-index">
      <header className="ux-lab-section">
        <p className="eyebrow">Product research</p>
        <h1 className="type-page">Atlas UX Lab</h1>
        <p className="type-body">
          Compare five information-architecture hypotheses for public visitors,
          clinicians, and public-health professionals. Open a concept, read what
          it is testing, and use the same questions for every variant. The live
          Atlas stays the production experience until a later product decision.
        </p>
      </header>

      <section aria-labelledby="ux-lab-comparison" className="ux-lab-section">
        <div>
          <h2 className="type-section" id="ux-lab-comparison">
            Comparison guide
          </h2>
          <p className="ux-lab-lead type-body">
            These prompts are for a facilitated session. They describe what to
            notice. They do not rank the concepts, and they do not recommend one
            architecture.
          </p>
        </div>
        <ul className="ux-lab-criteria">
          {UX_LAB_COMPARISON_CRITERIA.map((criterion) => (
            <li key={criterion.id}>
              <h3 className="type-card">{criterion.label}</h3>
              <p className="type-body">{criterion.prompt}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ux-lab-concepts" className="ux-lab-section">
        <div>
          <h2 className="type-section" id="ux-lab-concepts">
            Concepts
          </h2>
          <p className="ux-lab-lead type-body">
            Each concept keeps its own navigation. The five links below are the
            direct ways into the prototypes.
          </p>
        </div>
        <ul className="ux-lab-concept-list">
          {UX_LAB_CONCEPTS.map((concept) => (
            <li key={concept.id}>
              <Card>
                <CardHeader>
                  <h3 className="type-card">{concept.title}</h3>
                  <CardDescription>
                    <strong>{UX_LAB_TESTING_LABEL}.</strong>{" "}
                    {concept.hypothesis}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="type-body">
                    <strong>How this concept stays distinct.</strong>{" "}
                    {concept.difference}
                  </p>
                  <div className="ux-lab-concept-meta">
                    <ConceptStatus concept={concept} />
                    <code className="ux-lab-route">{concept.href}</code>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ux-lab-routes" className="ux-lab-section">
        <div>
          <h2 className="type-section" id="ux-lab-routes">
            Session routes
          </h2>
          <p className="ux-lab-lead type-body">
            Representative pages for a workshop. Inner pages stay inside the
            concept that owns them.
          </p>
        </div>
        <ul className="ux-lab-route-list">
          {UX_LAB_SESSION_ROUTES.map((route) => (
            <li key={route.href}>
              <Link href={route.href}>{route.label}</Link>
              <code className="ux-lab-route">{route.href}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ux-lab-limits" className="ux-lab-section">
        <div>
          <h2 className="type-section" id="ux-lab-limits">
            Prototype limits
          </h2>
          <p className="ux-lab-lead type-body">
            Treat every screen as a research prop. Mocked interactions show
            navigation and hierarchy only.
          </p>
        </div>
        <div className="ux-lab-limit-groups">
          <div>
            <h3 className="type-card">Known limitations</h3>
            <ul>
              {UX_LAB_KNOWN_LIMITATIONS.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="type-card">Intentionally mocked interactions</h3>
            <ul>
              {UX_LAB_MOCKED_INTERACTIONS.map((interaction) => (
                <li key={interaction.conceptId}>
                  <strong>
                    {uxLabConceptById(interaction.conceptId).title}.
                  </strong>{" "}
                  {interaction.detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="ux-lab-sample" className="ux-lab-section">
        <div>
          <h2 className="type-section" id="ux-lab-sample">
            Shared sample content
          </h2>
          <p className="ux-lab-lead type-body">{UX_LAB_SAMPLE_NOTICE}</p>
        </div>
        <div className="ux-lab-sample-groups">
          {UX_LAB_AUDIENCES.map((audience) => (
            <article key={audience}>
              <h3 className="type-card">{UX_LAB_AUDIENCE_LABELS[audience]}</h3>
              <ul>
                {uxLabSampleTopicsForAudience(audience).map((topic) => (
                  <li key={topic.id}>
                    <p className="type-body">
                      <strong>{topic.title}.</strong> {topic.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default UxLabPage;
