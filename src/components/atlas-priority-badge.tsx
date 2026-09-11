import { Badge } from "@/components/ui/badge";
import { plainPriority, type PriorityTone, priorityTone } from "@/lib/atlas-ui";
import { cn } from "@/lib/utils";

export function AtlasPriorityBadge({
  className,
  priority,
}: {
  className?: string;
  priority: string;
}) {
  const tone = priorityTone(priority);
  return (
    <Badge className={cn("priority-pill h-auto", toneClass(tone), className)}>
      {plainPriority(priority)}
    </Badge>
  );
}

function toneClass(tone: PriorityTone): string {
  switch (tone) {
    case "urgent": {
      return "urgent";
    }
    case "review": {
      return "review";
    }
    case "watch": {
      return "watch";
    }
    case "lower": {
      return "lower";
    }
    default: {
      const exhaustive: never = tone;
      throw new Error(`Unhandled priority tone: ${exhaustive}`);
    }
  }
}
