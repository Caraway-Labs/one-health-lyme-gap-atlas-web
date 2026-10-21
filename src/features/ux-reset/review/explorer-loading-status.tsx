import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Request-in-flight status. A neutral inline spinner stands beside the words;
 * it never takes the place of a value, and it is not an evidence state.
 * Motion stops under `prefers-reduced-motion` (Spinner handles it).
 */
export function ExplorerLoadingStatus({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm",
        className
      )}
      data-atlas-status="loading"
      data-testid={testId}
      role="status"
    >
      <Spinner aria-hidden="true" role="presentation" />
      <span>{children}</span>
    </div>
  );
}
