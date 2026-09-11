import type { ReactNode } from "react";

type StatusTone = "loading" | "error" | "empty";

export function AtlasStatusMessage({
  action,
  children,
  className,
  title,
  titleAs: Heading = "h1",
  tone = "empty",
}: {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  title?: string;
  titleAs?: "h1" | "h2" | "h3" | "p";
  tone?: StatusTone;
}) {
  const role = statusRole(tone);
  return (
    <div className={className} data-atlas-status={tone} role={role}>
      {title ? <Heading>{title}</Heading> : null}
      {children}
      {action}
    </div>
  );
}

function statusRole(tone: StatusTone): "status" | "alert" | undefined {
  switch (tone) {
    case "loading": {
      return "status";
    }
    case "error": {
      return "alert";
    }
    case "empty": {
      return undefined;
    }
    default: {
      const exhaustive: never = tone;
      throw new Error(`Unhandled status tone: ${exhaustive}`);
    }
  }
}
