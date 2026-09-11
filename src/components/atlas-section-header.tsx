import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";

export function AtlasSectionHeader({
  aside,
  className,
  description,
  eyebrow,
  eyebrowClassName,
  headingLevel = "h2",
  title,
  titleId,
}: {
  aside?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  eyebrowClassName?: string;
  headingLevel?: HeadingLevel;
  title: ReactNode;
  titleId?: string;
}) {
  const Heading = headingLevel;
  return (
    <div className={cn(className ?? "section-heading")}>
      <div>
        {eyebrow ? (
          <span className={cn("eyebrow", eyebrowClassName)}>{eyebrow}</span>
        ) : null}
        <Heading id={titleId}>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}
