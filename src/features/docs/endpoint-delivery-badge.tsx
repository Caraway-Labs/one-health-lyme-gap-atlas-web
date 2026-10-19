"use client";

import { Badge } from "@/components/ui/badge";
import {
  PENDING_DELIVERY_BADGE_LABEL,
  PENDING_DELIVERY_NOTE,
} from "@/lib/endpoint-delivery";

export function EndpointDeliveryBadge() {
  return (
    <span className="my-3 inline-flex max-w-full flex-wrap items-center gap-2">
      <Badge className="h-auto whitespace-normal" variant="outline">
        {PENDING_DELIVERY_BADGE_LABEL}
      </Badge>
      <span>{PENDING_DELIVERY_NOTE}</span>
    </span>
  );
}
