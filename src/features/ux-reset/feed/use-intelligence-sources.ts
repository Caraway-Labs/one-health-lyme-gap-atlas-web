"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getListIntelligenceSourcesQueryKey,
  listIntelligenceSources,
} from "@/generated/atlas";
import { FeedSources } from "@/generated/zod/feedSources.zod";
import { validateApiResponse } from "@/lib/api-response-validation";

import {
  collectIntelligenceSourcePages,
  type FeedSourceCatalogRow,
} from "./feed-filters";

export function useIntelligenceSources() {
  return useQuery({
    queryFn: async ({ signal }) =>
      collectIntelligenceSourcePages(async (pageToken) => {
        const params = pageToken ? { page_token: pageToken } : undefined;
        const response = await listIntelligenceSources(params, { signal });
        const parsed = validateApiResponse(
          "Intelligence sources",
          FeedSources,
          response.data
        );
        const rows: FeedSourceCatalogRow[] = parsed.data.map((row) => ({
          organization: row.organization,
          registry_version: row.registry_version,
          source_id: row.source_id,
        }));
        return {
          nextPageToken: parsed.meta.next_page_token,
          rows,
        };
      }),
    queryKey: getListIntelligenceSourcesQueryKey(),
    retry: false,
  });
}
