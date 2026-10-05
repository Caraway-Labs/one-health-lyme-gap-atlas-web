"use client";

import { useQuery } from "@tanstack/react-query";

import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import { MetadataV1AtlasMetadataGetResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import { atlasStateOptionsFromMetadata } from "@/lib/atlas-state-geography";

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
  return {
    ...query,
    stateOptions: query.data
      ? atlasStateOptionsFromMetadata(query.data.states)
      : [],
  };
}
