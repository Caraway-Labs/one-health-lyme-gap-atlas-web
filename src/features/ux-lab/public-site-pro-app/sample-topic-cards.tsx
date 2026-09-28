import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  type UxLabAudience,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";

export function SampleTopicCards({ audience }: { audience: UxLabAudience }) {
  return (
    <ul className="ux-lab-topic-list">
      {uxLabSampleTopicsForAudience(audience).map((topic) => (
        <li key={topic.id}>
          <Card>
            <CardHeader>
              <h2 className="type-card">{topic.title}</h2>
              <CardDescription>Sample layout label</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="type-body">{topic.summary}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
