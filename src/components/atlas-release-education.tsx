import Link from "next/link";

import { atlasReleaseEducationContent } from "@/lib/atlas-release-education-content";

export function AtlasReleaseEducation() {
  const { introduction, methodologyExplainer, releaseSemantics } =
    atlasReleaseEducationContent;

  return (
    <div className="atlas-release-education" id="release-education">
      <p className="atlas-release-education-intro">{introduction}</p>
      <details className="atlas-evidence-disclosure">
        <summary>What these release labels mean</summary>
        <dl className="atlas-release-semantics">
          {releaseSemantics.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="atlas-evidence-disclosure">
        <summary>{methodologyExplainer.title}</summary>
        <div className="atlas-method-explainer">
          {methodologyExplainer.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
        <p className="atlas-evidence-methods-link">
          <a href="#methods">
            Review data sources and limitations on this page
          </a>
          {" · "}
          <Link href="/docs/releases-and-methodology">
            Read the full release and methodology guide
          </Link>
        </p>
      </details>
    </div>
  );
}
