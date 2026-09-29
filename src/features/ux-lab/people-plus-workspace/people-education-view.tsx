import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { PEOPLE_EDUCATION_TOPICS } from "@/features/ux-lab/people-plus-workspace/content";
import type { PeopleReviewedHandoff } from "@/features/ux-lab/people-plus-workspace/handoff-content";
import { HandoffContextBanner } from "@/features/ux-lab/people-plus-workspace/handoff-context-banner";

export function PeopleEducationPageContent({
  handoff,
}: {
  handoff?: PeopleReviewedHandoff;
}) {
  return (
    <>
      {handoff ? (
        <HandoffContextBanner handoff={handoff} variant="education" />
      ) : null}
      <header>
        <p className="eyebrow">Education and prevention</p>
        <h1 className="type-page">Learn about ticks and Lyme disease</h1>
        <p className="type-body people-plus-lead">
          Sample topic groupings show how prevention and awareness material
          could read in plain language. Nothing here is personal medical advice
          or a statement about risk where you live.
        </p>
      </header>
      <ul className="people-plus-topic-list">
        {PEOPLE_EDUCATION_TOPICS.map((topic) => (
          <li key={topic.id}>
            <Card>
              <CardHeader>
                <h2 className="type-card">{topic.title}</h2>
                <CardDescription>{topic.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="type-small">
                  Prototype topic stub. Full articles are not connected.
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
