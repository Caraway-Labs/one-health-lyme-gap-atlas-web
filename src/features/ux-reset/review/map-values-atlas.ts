import { apiMutator } from "@/lib/api-mutator";

export type MapValuesV1AtlasMapValuesGetParams = {
  dataset_version?: string;
};

export type MapValuesV1AtlasMapValuesGetResponse200 = {
  data: unknown;
  headers: Headers;
  status: 200;
};

export const getMapValuesV1AtlasMapValuesGetUrl = (
  params?: MapValuesV1AtlasMapValuesGetParams
): string => {
  const normalizedParams = new URLSearchParams();
  if (params?.dataset_version !== undefined) {
    normalizedParams.append("dataset_version", params.dataset_version);
  }
  const stringifiedParams = normalizedParams.toString();
  return stringifiedParams.length > 0
    ? `/v1/atlas/map-values?${stringifiedParams}`
    : "/v1/atlas/map-values";
};

/**
 * Published county map values for the current atlas snapshot.
 * Not generated from OpenAPI; regenerate the client when map-values is added.
 */
export const mapValuesV1AtlasMapValuesGet = async (
  params?: MapValuesV1AtlasMapValuesGetParams,
  options?: Parameters<typeof apiMutator>[1]
): Promise<MapValuesV1AtlasMapValuesGetResponse200> => {
  return apiMutator<MapValuesV1AtlasMapValuesGetResponse200>(
    getMapValuesV1AtlasMapValuesGetUrl(params),
    {
      ...options,
      method: "GET",
    }
  );
};
