"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import {
  metadataV1AtlasMetadataGet,
  scoresV1AtlasScoresGet,
} from "@/generated/atlas";
import {
  MetadataV1AtlasMetadataGetResponse,
  ScoresV1AtlasScoresGetResponse,
} from "@/generated/zod/atlas";
import { parseAssistantCountyUrlContext } from "@/lib/assistant-context-handoff";
import { validateApiResponse } from "@/lib/api-response-validation";
import { describeReleaseAssembly } from "@/lib/atlas-evidence-metadata";

export function AssistantCountyContextNotice() {
  const searchParams = useSearchParams();
  const parsed = parseAssistantCountyUrlContext(searchParams);

  if (parsed.kind === "absent") {
    return null;
  }

  if (parsed.kind === "invalid") {
    return (
      <div
        className="chat-county-context chat-county-context-invalid"
        data-assistant-county-state="invalid"
        role="alert"
      >
        <p>
          <strong>County context not applied.</strong> &ldquo;{parsed.raw}&rdquo;
          is not a valid five-digit county FIPS code. Atlas Assistant will not
          attach literature to an unrelated county.
        </p>
      </div>
    );
  }

  return (
    <ResolvedCountyContext
      countyFips={parsed.countyFips}
      requestedDataset={parsed.dataset}
    />
  );
}

function ResolvedCountyContext({
  countyFips,
  requestedDataset,
}: {
  countyFips: string;
  requestedDataset: string | null;
}) {
  const metadataQuery = useQuery({
    queryFn: async () =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        (await metadataV1AtlasMetadataGet()).data
      ),
    queryKey: ["assistant-county-context-metadata"],
  });

  const activeReleaseId = metadataQuery.data?.release_id;
  const datasetVersion = requestedDataset ?? activeReleaseId;

  const scoresQuery = useQuery({
    enabled: Boolean(datasetVersion),
    queryFn: async () =>
      validateApiResponse(
        "Atlas scores",
        ScoresV1AtlasScoresGetResponse,
        (
          await scoresV1AtlasScoresGet({
            dataset_version: datasetVersion!,
          })
        ).data
      ),
    queryKey: ["assistant-county-context-scores", datasetVersion],
  });

  if (metadataQuery.isPending || scoresQuery.isPending) {
    return (
      <p className="chat-county-context chat-county-context-loading" role="status">
        Loading county context…
      </p>
    );
  }

  if (metadataQuery.isError || scoresQuery.isError) {
    return (
      <div
        className="chat-county-context chat-county-context-unavailable"
        data-assistant-county-state="service_unavailable"
        role="alert"
      >
        <p>
          <strong>County context could not be verified.</strong> FIPS{" "}
          {countyFips} was kept from your Atlas session, but the public API did
          not confirm this county in the active release. You can still ask
          literature questions without county-specific Atlas evidence.
        </p>
      </div>
    );
  }

  const county = scoresQuery.data?.counties.find(
    (entry) => entry.fips === countyFips
  );

  if (!county) {
    return (
      <div
        className="chat-county-context chat-county-context-unavailable"
        data-assistant-county-state="unavailable_in_release"
        role="alert"
      >
        <p>
          <strong>County unavailable in this release.</strong> FIPS {countyFips}{" "}
          is not available in{" "}
          {datasetVersion
            ? describeReleaseAssembly(datasetVersion)
            : "the active governed release"}
          . The URL was kept so this handoff is not mistaken for a different
          county. Atlas Assistant answers remain literature-only and are not
          county surveillance evidence.
        </p>
      </div>
    );
  }

  const releaseLabel = datasetVersion
    ? describeReleaseAssembly(datasetVersion)
    : null;

  return (
    <div
      className="chat-county-context chat-county-context-identified"
      data-assistant-county-state="identified"
      aria-label="County context"
    >
      <p>
        <strong>County context:</strong> {county.county}, {county.state_name}{" "}
        (FIPS {county.fips})
      </p>
      {releaseLabel ? (
        <p className="chat-county-context-release">
          Governed release: {releaseLabel}. Literature answers are separate from
          county surveillance scores.
        </p>
      ) : null}
    </div>
  );
}
