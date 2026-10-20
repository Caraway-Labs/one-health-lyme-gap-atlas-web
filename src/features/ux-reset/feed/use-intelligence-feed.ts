"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";

import {
  getListIntelligenceFeedQueryKey,
  listIntelligenceFeed,
} from "@/generated/atlas";
import type { ListIntelligenceFeedParams } from "@/generated/models/listIntelligenceFeedParams";
import {
  MetadataFeed,
  type MetadataFeedOutput,
} from "@/generated/zod/metadataFeed.zod";
import { validateApiResponse } from "@/lib/api-response-validation";

type IntelligenceFeedQueryKey = ReturnType<
  typeof getListIntelligenceFeedQueryKey
>;

export function useIntelligenceFeed() {
  return useInfiniteQuery<
    MetadataFeedOutput,
    Error,
    InfiniteData<MetadataFeedOutput>,
    IntelligenceFeedQueryKey,
    string | undefined
  >({
    getNextPageParam: (page) => page.meta.next_page_token ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const params: ListIntelligenceFeedParams | undefined = pageParam
        ? { page_token: pageParam }
        : undefined;
      const response = await listIntelligenceFeed(params, { signal });
      const parsed: MetadataFeedOutput = validateApiResponse(
        "Intelligence feed",
        MetadataFeed,
        response.data
      );
      return parsed;
    },
    queryKey: getListIntelligenceFeedQueryKey(),
    retry: false,
  });
}
