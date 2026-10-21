"use client";

import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useState } from "react";

import {
  getListIntelligenceFeedQueryKey,
  listIntelligenceFeed,
} from "@/generated/atlas";
import {
  MetadataFeed,
  type MetadataFeedOutput,
} from "@/generated/zod/metadataFeed.zod";
import { validateApiResponse } from "@/lib/api-response-validation";

import {
  buildFeedListParams,
  isStaleFeedPageToken,
  withFeedPageToken,
  type FeedFilterState,
} from "./feed-filters";

type IntelligenceFeedQueryKey = ReturnType<
  typeof getListIntelligenceFeedQueryKey
>;

async function readFeedPage(
  filters: FeedFilterState,
  pageToken?: string,
  signal?: AbortSignal
): Promise<MetadataFeedOutput> {
  const params = withFeedPageToken(
    buildFeedListParams(filters, new Date()),
    pageToken
  );
  const response = await listIntelligenceFeed(params, { signal });
  return validateApiResponse("Intelligence feed", MetadataFeed, response.data);
}

export function useIntelligenceFeed(filters: FeedFilterState, enabled = true) {
  const queryClient = useQueryClient();
  const [isRestartingPage, setRestartingPage] = useState(false);
  const listParams = buildFeedListParams(filters, new Date());
  const queryKey = getListIntelligenceFeedQueryKey(listParams);
  const query = useInfiniteQuery<
    MetadataFeedOutput,
    Error,
    InfiniteData<MetadataFeedOutput>,
    IntelligenceFeedQueryKey,
    string | undefined
  >({
    enabled,
    getNextPageParam: (page) => page.meta.next_page_token ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      readFeedPage(filters, pageParam, signal),
    queryKey,
    retry: false,
  });

  const fetchNextPage = async () => {
    const result = await query.fetchNextPage();
    if (!result.isError || !isStaleFeedPageToken(result.error)) {
      return;
    }
    setRestartingPage(true);
    try {
      const page = await readFeedPage(filters);
      const cached = queryClient
        .getQueryCache()
        .find({ exact: true, queryKey });
      cached?.setState({
        data: { pageParams: [undefined], pages: [page] },
        error: null,
        fetchStatus: "idle",
        status: "success",
      });
    } catch {
      // The failed Show more stays visible after this one silent restart.
    } finally {
      setRestartingPage(false);
    }
  };

  return { ...query, fetchNextPage, isRestartingPage };
}
