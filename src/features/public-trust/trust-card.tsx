import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function TrustCard({
  children,
  id,
  kicker,
  title,
}: {
  children: ReactNode;
  id?: string;
  kicker?: ReactNode;
  title: string;
}) {
  return (
    <article id={id}>
      <Card className="overflow-visible">
        <CardHeader>
          {typeof kicker === "string" ? (
            <p className="eyebrow">{kicker}</p>
          ) : (
            kicker
          )}
          <h3>{title}</h3>
        </CardHeader>
        <CardContent className="grid gap-(--space-3)">{children}</CardContent>
      </Card>
    </article>
  );
}
