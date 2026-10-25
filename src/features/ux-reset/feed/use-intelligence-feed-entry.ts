"use client";

import { useQuery } from "@tanstack/react-query";

import { getIntelligenceFeedEntry } from "@/generated/atlas";
import type { FeedEntry } from "@/generated/models/feedEntry";
import { FeedEntryRead } from "@/generated/zod/feedEntryRead.zod";
import { validateApiResponse } from "@/lib/api-response-validation";

import { retainSourceFamilyLabel } from "./feed-presentation";

export function useIntelligenceFeedEntry(
  itemId: string | null,
  enabled: boolean
) {
  return useQuery({
    enabled: itemId !== null && enabled,
    queryFn: async ({ signal }) => {
      if (itemId === null) {
        throw new Error("Missing feed item id.");
      }
      const response = await getIntelligenceFeedEntry(
        encodeURIComponent(itemId),
        { signal }
      );
      return retainSourceFamilyLabel(
        validateApiResponse(
          "Intelligence feed item",
          FeedEntryRead,
          response.data
        ),
        response.data
      ).data;
    },
    queryKey: ["intelligence-feed-item", itemId],
    retry: false,
  });
}

export type IntelligenceFeedEntryData = FeedEntry;
