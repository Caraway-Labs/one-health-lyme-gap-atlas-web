import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  LEARN_TOPICS,
  otherThreeLaneItems,
  threeLaneItemPath,
  threeLanesSampleNotice,
  type LearnTopic,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesFrame } from "@/features/ux-lab/three-lanes/lane-nav";
import { SharedLaneLinks } from "@/features/ux-lab/three-lanes/shared-links";

export function LearnLanePage() {
  return (
    <ThreeLanesFrame current="learn">
      <main className="three-lanes-main three-lanes-main-learn">
        <header className="three-lanes-reading-header">
          <p className="eyebrow">Learn</p>
          <h1 className="type-page">Learn about ticks and Lyme disease</h1>
          <p className="type-body">
            Short reading pages for a general audience. Prevention headings and
            a fictional local page sit beside the tick overview.
          </p>
          <p className="three-lanes-sample type-small">
            {threeLanesSampleNotice("learn")}
          </p>
        </header>
        <ol className="three-lanes-reading-list">
          {LEARN_TOPICS.map((topic) => (
            <li key={topic.id}>
              <article className="three-lanes-reading-section">
                {topic.shared ? (
                  <Badge variant="secondary">Shared across lanes</Badge>
                ) : null}
                <h2 className="type-card">
                  <Link
                    className="three-lanes-text-link"
                    href={threeLaneItemPath("learn", topic.id)}
                  >
                    {topic.title}
                  </Link>
                </h2>
                <p className="type-body">{topic.lede}</p>
              </article>
            </li>
          ))}
        </ol>
      </main>
    </ThreeLanesFrame>
  );
}

export function LearnArticle({ topic }: { topic: LearnTopic }) {
  const others = otherThreeLaneItems("learn", topic.id).filter(
    (item) => item.kind === "learn"
  );

  return (
    <ThreeLanesFrame current="learn">
      <main className="three-lanes-main three-lanes-main-learn">
        <header className="three-lanes-reading-header">
          <p className="eyebrow">Learn</p>
          <h1 className="type-page">{topic.title}</h1>
          <p className="type-body">{topic.lede}</p>
          <p className="three-lanes-sample type-small">
            {threeLanesSampleNotice("learn")}
          </p>
        </header>
        {topic.sections.map((section) => (
          <section
            className="three-lanes-reading-section"
            key={section.heading}
          >
            <h2 className="type-section">{section.heading}</h2>
            <p className="type-body">{section.body}</p>
          </section>
        ))}
        <SharedLaneLinks current="learn" links={topic.related} />
        {others.length > 0 ? (
          <nav aria-label="More in Learn" className="three-lanes-more">
            <h2 className="type-card">More in Learn</h2>
            <ul>
              {others.map((item) => (
                <li key={item.id}>
                  <Link
                    className="three-lanes-text-link"
                    href={threeLaneItemPath("learn", item.id)}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </main>
    </ThreeLanesFrame>
  );
}
