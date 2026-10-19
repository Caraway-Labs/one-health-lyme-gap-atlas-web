import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import type { CountyDetail } from "@/generated/models";
import type { FollowUpReviewContext } from "@/lib/follow-up-workflows";
import {
  RESPONSE_TIER_HELP,
  RESPONSE_TIER_UNAVAILABLE_HELP,
  responseTierForCounty,
} from "@/lib/response-tier";
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
  const helpId = useId();
  const tier = responseTierForCounty(detail, context);
  const help =
    tier.status === "assigned"
      ? RESPONSE_TIER_HELP
      : RESPONSE_TIER_UNAVAILABLE_HELP;
  return (
    <>
      <Badge
        aria-describedby={helpId}
        className={cn(
          "response-tier-pill h-auto max-w-full overflow-visible px-2 py-1 text-left font-semibold whitespace-normal",
          className
        )}
        data-action={tier.status === "assigned" ? tier.action : undefined}
        data-ramp={tier.status === "assigned" ? tier.ramp : "unavailable"}
        data-status={tier.status}
        data-testid="selected-county-response-tier"
        data-tier={tier.status === "assigned" ? tier.tier : undefined}
      >
        {tier.label}
      </Badge>
      <p
        className="type-small ux-reset-response-tier-help"
        data-testid="selected-county-response-tier-help"
        id={helpId}
      >
        {help}
      </p>
    </>
  );
}
