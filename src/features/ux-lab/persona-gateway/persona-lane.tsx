import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { AudienceSwitcher } from "@/features/ux-lab/persona-gateway/audience-switcher";
import {
  otherPersonaAudiences,
  personaAudiencePath,
  personaSampleNotice,
  personaTopicPath,
  type PersonaAudienceDefinition,
} from "@/features/ux-lab/persona-gateway/content";
import type { UxLabSampleTopic } from "@/features/ux-lab/prototype-contract";

export function PersonaLanePage({
  audience,
  topics,
}: {
  audience: PersonaAudienceDefinition;
  topics: readonly UxLabSampleTopic[];
}) {
  const others = otherPersonaAudiences(audience.id);

  return (
    <main className="persona-gateway" data-audience={audience.id}>
      <div className="persona-gateway-body">
        <AudienceSwitcher current={audience.id} />
        <header className="persona-lane-header">
          <p className="eyebrow">{audience.kicker}</p>
          <h1 className="type-page">{audience.title}</h1>
          <p className="type-body">{audience.intro}</p>
        </header>

        <aside className="persona-boundary" role="note">
          <h2 className="type-card">{audience.boundaryTitle}</h2>
          <p className="type-body">{audience.boundary}</p>
        </aside>

        <p className="persona-sample type-small">
          {personaSampleNotice(audience.id)}
        </p>

        <section aria-labelledby="persona-topics" className="persona-section">
          <h2 className="type-section" id="persona-topics">
            Sample topics in this lane
          </h2>
          <ul className="persona-topic-list">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Card>
                  <CardHeader>
                    <h3 className="type-card">
                      <Link href={personaTopicPath(audience.id, topic.id)}>
                        {topic.title}
                      </Link>
                    </h3>
                    <CardDescription>{topic.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="type-small">
                      Open this topic to confirm you are still in the{" "}
                      {audience.title} lane.
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="persona-lane-check"
          className="persona-section"
        >
          <h2 className="type-section" id="persona-lane-check">
            Check that this is your lane
          </h2>
          <p className="type-body">{audience.checkPrompt}</p>
          <div className="persona-lane-columns">
            <article>
              <h3 className="type-card">Included here</h3>
              <ul>
                {audience.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3 className="type-card">Left to other audiences</h3>
              <ul>
                {audience.leavesOut.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
          <p className="type-body">
            Switch audiences above without using the browser Back button. The
            other audiences are{" "}
            {others.map((other) => other.title).join(" and ")}.
          </p>
        </section>
      </div>
    </main>
  );
}

export function PersonaTopicPage({
  audience,
  topic,
}: {
  audience: PersonaAudienceDefinition;
  topic: UxLabSampleTopic;
}) {
  return (
    <main className="persona-gateway" data-audience={audience.id}>
      <div className="persona-gateway-body">
        <AudienceSwitcher current={audience.id} />
        <header className="persona-lane-header">
          <p className="eyebrow">{audience.title}</p>
          <h1 className="type-page">{topic.title}</h1>
          <p className="type-body">{topic.summary}</p>
        </header>

        <aside className="persona-boundary" role="note">
          <h2 className="type-card">{audience.boundaryTitle}</h2>
          <p className="type-body">{audience.boundary}</p>
        </aside>

        <p className="persona-sample type-small">
          {personaSampleNotice(audience.id)}
        </p>

        <section
          aria-labelledby="persona-topic-check"
          className="persona-section"
        >
          <h2 className="type-section" id="persona-topic-check">
            Does this match the audience you chose?
          </h2>
          <p className="type-body">
            You are in <strong>{audience.title}</strong>, looking at{" "}
            <strong>{topic.title}</strong>. {audience.checkPrompt}
          </p>
          <p className="type-body">
            <Link href={personaAudiencePath(audience.id)}>
              Yes — stay in {audience.title}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
