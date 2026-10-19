import { Badge } from "@/components/ui/badge";
import type { CountyDetail } from "@/generated/models";
import type { FollowUpReviewContext } from "@/lib/follow-up-workflows";
import { responseTierForCounty } from "@/lib/response-tier";
import { cn } from "@/lib/utils";

export function ResponseTierPill({
  className,
  context,
  detail,
}: {
  className?: string;
  context?: FollowUpReviewContext;
  detail: CountyDetail;
}) {
  const tier = responseTierForCounty(detail, context);
  if (tier.status !== "assigned") {
    return (
      <Badge
        className={cn(
          "response-tier-pill h-auto max-w-full overflow-visible px-3 py-1.5 text-left font-semibold whitespace-normal",
          className
        )}
        data-ramp="unavailable"
        data-status={tier.status}
        data-testid="selected-county-response-tier"
      >
        {tier.label}
      </Badge>
    );
  }
  return (
    <Badge
      aria-label={`${tier.title}. ${tier.detail}`}
      className={cn(
        "response-tier-pill h-auto max-w-full overflow-visible px-3 py-1.5 text-left font-normal whitespace-normal",
        className
      )}
      data-action={tier.action}
      data-ramp={tier.ramp}
      data-status={tier.status}
      data-testid="selected-county-response-tier"
      data-tier={tier.title}
    >
      <span className="response-tier-pill-title">{tier.title}</span>
      <span className="response-tier-pill-detail">{tier.detail}</span>
    </Badge>
  );
}
