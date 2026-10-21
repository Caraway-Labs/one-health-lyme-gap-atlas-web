import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function TrustCard({
  children,
  kicker,
  title,
}: {
  children: ReactNode;
  kicker?: string;
  title: string;
}) {
  return (
    <article>
      <Card className="overflow-visible">
        <CardHeader>
          {kicker ? <p className="eyebrow">{kicker}</p> : null}
          <h3>{title}</h3>
        </CardHeader>
        <CardContent className="grid gap-(--space-3)">{children}</CardContent>
      </Card>
    </article>
  );
}
