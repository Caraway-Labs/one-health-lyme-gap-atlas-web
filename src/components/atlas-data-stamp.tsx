import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AtlasDataStamp({
  children,
  className,
  label = "Current governed snapshot",
  variant = "card",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  variant?: "card" | "inline";
}) {
  if (variant === "inline") {
    return <span className={cn("version-stamp", className)}>{children}</span>;
  }
  return (
    <div className={cn("data-stamp", className)}>
      <span>
        <i className="pulse" />
        {label}
      </span>
      <small>{children}</small>
    </div>
  );
}
