"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useProfileDefaultJurisdiction } from "@/features/ux-reset/review/use-profile-default-jurisdiction";
import { metadataV1AtlasMetadataGet } from "@/generated/atlas";
import { MetadataV1AtlasMetadataGetResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";
import {
  atlasStateOptionsFromMetadata,
  reviewScopeLabel,
} from "@/lib/atlas-state-geography";
import { useQuery } from "@tanstack/react-query";

export function DefaultJurisdictionReadout() {
  const profileQuery = useProfileDefaultJurisdiction();
  const metadataQuery = useQuery({
    queryFn: async () =>
      validateApiResponse(
        "Atlas metadata",
        MetadataV1AtlasMetadataGetResponse,
        (await metadataV1AtlasMetadataGet()).data
      ),
    queryKey: ["ux-reset-settings-metadata"],
  });

  const stateOptions = metadataQuery.data
    ? atlasStateOptionsFromMetadata(metadataQuery.data.states)
    : [];
  const code = profileQuery.data?.stateCode ?? null;
  const label = code
    ? reviewScopeLabel(code, stateOptions)
    : "No default state (national)";

  return (
    <Card data-testid="settings-default-jurisdiction">
      <CardHeader>
        <h2 className="type-card">Default jurisdiction</h2>
        <CardDescription>
          Starting Review scope when the URL omits{" "}
          <code>scope</code>. Changing scope on Review does not update this
          setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="type-body" data-default-jurisdiction={code ?? "ALL"}>
          {profileQuery.isPending ? "Loading profile…" : label}
        </p>
      </CardContent>
    </Card>
  );
}
