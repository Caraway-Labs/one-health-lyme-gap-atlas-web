"use client";

import { Badge } from "@/components/ui/badge";
import { pendingDeliveryLabel } from "@/lib/endpoint-delivery";

export function EndpointDeliveryBadge({
  originStatus,
}: {
  originStatus: number;
}) {
  const label = pendingDeliveryLabel(originStatus);
  if (label === null) return null;
  return <Badge variant="outline">{label}</Badge>;
}
