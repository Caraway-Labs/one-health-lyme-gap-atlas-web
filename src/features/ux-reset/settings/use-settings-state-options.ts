"use client";

import { useQuery } from "@tanstack/react-query";

import type { StateListStatus } from "@/features/ux-reset/profile/default-jurisdiction-contract";
import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import { MetadataV1AtlasMetadataGetResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import {
  type AtlasStateOption,
  atlasStateOptionsFromMetadata,
} from "@/lib/atlas-state-geography";

export const settingsMetadataQueryKey = ["ux-reset-settings-metadata"] as const;

export function useSettingsStateOptions() {
  const query = useQuery({
    queryFn: async () =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        (await metadataV1AtlasMetadataGet()).data
      ),
    queryKey: settingsMetadataQueryKey,
    retry: false,
  });
  const stateOptions = query.data
    ? atlasStateOptionsFromMetadata(query.data.states)
    : [];
  return {
    ...query,
    stateList: stateListFromMetadataQuery({
      isError: query.isError,
      isSuccess: query.isSuccess,
      stateOptions,
    }),
    stateOptions,
  };
}

export function stateListFromMetadataQuery(query: {
  isError: boolean;
  isSuccess: boolean;
  stateOptions: readonly AtlasStateOption[];
}): StateListStatus {
  if (query.isError) {
    return { status: "unavailable" };
  }
  if (!query.isSuccess) {
    return { status: "loading" };
  }
  return { options: query.stateOptions, status: "ready" };
}
