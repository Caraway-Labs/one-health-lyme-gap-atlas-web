import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeadingLevel = "h2" | "h3" | "h4";

/**
 * Section label for the county evidence view (UX audit A5). A small
 * semibold sans label with a decorative Lucide icon. The serif display
 * heading is reserved for the county name.
 */
export function ExplorerSectionHeading({
  className,
  description,
  icon: Icon,
  level = "h2",
  note,
  title,
  titleId,
}: {
  className?: string;
  description?: ReactNode;
  icon: LucideIcon;
  level?: SectionHeadingLevel;
  /** Short muted qualifier beside the label (for example the evidence class). */
  note?: string;
  title: ReactNode;
  titleId?: string;
}) {
  const Heading = level;
  return (
    <div
      className={cn("grid gap-1", className)}
      data-testid="explorer-section-heading"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Heading
          className="m-0 flex items-center gap-2 font-sans text-sm font-semibold"
          id={titleId}
        >
          <Icon aria-hidden="true" className="text-muted-foreground size-4" />
          {title}
        </Heading>
        {note ? (
          <span className="text-muted-foreground text-xs">{note}</span>
        ) : null}
      </div>
      {description ? (
        <p className="text-muted-foreground m-0 max-w-prose text-xs">
          {description}
        </p>
      ) : null}
    </div>
  );
}
