"use client";

import { useQuery } from "@tanstack/react-query";

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

  let body: string;
  let dataAttribute: string;
  if (profileQuery.isPending) {
    body = "Loading profile…";
    dataAttribute = "pending";
  } else if (profileQuery.isError) {
    body =
      "Unable to load your default jurisdiction. Try again later before relying on this setting.";
    dataAttribute = "error";
  } else if (code) {
    body = reviewScopeLabel(code, stateOptions);
    dataAttribute = code;
  } else {
    body = "No default state (national)";
    dataAttribute = "ALL";
  }

  return (
    <Card data-testid="settings-default-jurisdiction">
      <CardHeader>
        <h2 className="type-card">Default jurisdiction</h2>
        <CardDescription>
          Starting Review scope when the URL omits <code>scope</code>. Changing
          scope on Review does not update this setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p
          className="type-body"
          data-default-jurisdiction={dataAttribute}
          data-profile-readout-state={
            profileQuery.isError
              ? "error"
              : profileQuery.isSuccess
                ? "ready"
                : "pending"
          }
        >
          {body}
        </p>
      </CardContent>
    </Card>
  );
}
