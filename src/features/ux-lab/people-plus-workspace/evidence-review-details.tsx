import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { PEOPLE_REVIEWED_HANDOFF } from "@/features/ux-lab/people-plus-workspace/handoff-content";

export function EvidenceReviewDetails() {
  const review = PEOPLE_REVIEWED_HANDOFF;

  return (
    <div className="ux-lab-pro-grid">
      <Card>
        <CardHeader>
          <div className="people-plus-evidence-heading">
            <Badge variant="outline">Sample geography</Badge>
            <h2 className="type-card">
              {review.geography.name}, {review.geography.region}
            </h2>
          </div>
          <CardDescription>{review.geography.summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="type-body">{review.professionalFindings}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="type-card">Provenance and uncertainty</h2>
          <CardDescription>{review.evidencePeriod}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="people-plus-topic-list">
            {review.sources.map((source) => (
              <li key={source.id}>
                <p className="type-body">{source.label}</p>
                <p className="type-small">{source.note}</p>
              </li>
            ))}
          </ul>
          <p className="type-body people-plus-evidence-uncertainty">
            <strong>Uncertainty.</strong> {review.uncertainty}
          </p>
          <p className="type-small people-plus-evidence-limitations">
            <strong>Limitations.</strong> {review.limitations}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
