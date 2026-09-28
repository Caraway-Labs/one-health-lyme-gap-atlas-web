import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  UX_LAB_AUDIENCES,
  UX_LAB_AUDIENCE_LABELS,
  UX_LAB_CONCEPTS,
  UX_LAB_SAMPLE_NOTICE,
  type UxLabConcept,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";

function ConceptStatus({ concept }: { concept: UxLabConcept }) {
  switch (concept.status) {
    case "available": {
      return <Link href={concept.href}>Open {concept.title}</Link>;
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
          Compare information-architecture hypotheses for public visitors,
          clinicians, and public-health professionals inside the Atlas web
          application. This lab supports facilitated product research. The live
          Atlas remains the production experience until a later product
          decision.
        </p>
      </header>

      <section aria-labelledby="ux-lab-concepts" className="ux-lab-section">
        <div>
          <h2 className="type-section" id="ux-lab-concepts">
            Concepts
          </h2>
          <p className="ux-lab-lead type-body">
            Each concept keeps its own navigation. This index is the shared
            comparison entry point. A concept link appears here when that
            prototype page exists.
          </p>
        </div>
        <ul className="ux-lab-concept-list">
          {UX_LAB_CONCEPTS.map((concept) => (
            <li key={concept.id}>
              <Card>
                <CardHeader>
                  <h3 className="type-card">{concept.title}</h3>
                  <CardDescription>{concept.hypothesis}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="type-body">{concept.difference}</p>
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
