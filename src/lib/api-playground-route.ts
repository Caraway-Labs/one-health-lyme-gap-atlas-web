import type { OpenApiDocument } from "@/lib/api-playground-allowlist";
import {
  createRateLimiter,
  proxyPlaygroundRequest,
} from "@/lib/api-playground-proxy";
import { getPublishedApiOrigin } from "@/lib/public-origins";

import pinnedContract from "../../contracts/public-openapi.json";

const document = pinnedContract as unknown as OpenApiDocument;
const limiter = createRateLimiter();

export function handlePlaygroundGet(request: Request): Promise<Response> {
  return proxyPlaygroundRequest(request, {
    document,
    limiter,
    upstreamOrigin: getPublishedApiOrigin(),
  });
}
