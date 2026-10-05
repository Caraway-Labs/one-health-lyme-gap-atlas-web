"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  reviewStartForSelection,
  type DefaultJurisdiction,
} from "@/features/ux-reset/profile/default-jurisdiction-contract";
import { useSavedProfile } from "@/features/ux-reset/profile/use-saved-profile";
import { useSettingsStateOptions } from "@/features/ux-reset/settings/use-settings-state-options";
import { reviewScopeLabel } from "@/lib/atlas-state-geography";

function jurisdictionAttribute(selection: DefaultJurisdiction): string {
  switch (selection.kind) {
    case "national": {
      return "ALL";
    }
    case "state": {
      return selection.stateCode;
    }
    case "unrecognized": {
      return "unrecognized";
    }
    case "unselected": {
      return "unselected";
    }
    default: {
      const exhaustive: never = selection;
      return exhaustive;
    }
  }
}

function confirmedCopy(
  selection: DefaultJurisdiction,
  stateOptions: readonly { code: string; name: string }[]
): string {
  switch (selection.kind) {
    case "national": {
      return "United States";
    }
    case "state": {
      return reviewScopeLabel(selection.stateCode, stateOptions);
    }
    case "unrecognized": {
      return `Saved state code ${selection.stateCode} is not a current Atlas state. Choose United States or a listed state and save.`;
    }
    case "unselected": {
      return "No saved default. New Review sessions start with the United States until you save one.";
    }
    default: {
      const exhaustive: never = selection;
      return exhaustive;
    }
  }
}

export function DefaultJurisdictionReadout() {
  const profileQuery = useSavedProfile();
  const metadataQuery = useSettingsStateOptions();
  const stateOptions = metadataQuery.stateOptions;
  const selection = profileQuery.data?.selection;

  let body: string;
  let dataAttribute: string;
  let completion = "unavailable";
  let reviewStartScope = "";
  let reviewStartSource = "";
  if (profileQuery.isPending) {
    body = "Loading profile…";
    dataAttribute = "pending";
  } else if (profileQuery.isError || !selection || !profileQuery.data) {
    body =
      "Unable to load your default jurisdiction. Try again later before relying on this setting.";
    dataAttribute = "error";
  } else {
    const start = reviewStartForSelection(
      selection,
      metadataQuery.isSuccess ? stateOptions : null
    );
    body = confirmedCopy(selection, stateOptions);
    dataAttribute = jurisdictionAttribute(selection);
    completion = profileQuery.data.completion.status;
    reviewStartScope = start.scope;
    reviewStartSource = start.source;
  }

  return (
    <Card data-testid="settings-default-jurisdiction">
      <CardHeader>
        <h2 className="type-card">Default jurisdiction</h2>
        <CardDescription>
          This is the last confirmed default for a future Review start. Changing
          scope on Review does not update it, and it does not limit which
          geographies you can open.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p
          className="type-body"
          data-default-jurisdiction={dataAttribute}
          data-jurisdiction-completion={completion}
          data-profile-readout-state={
            profileQuery.isError
              ? "error"
              : profileQuery.isSuccess
                ? "ready"
                : "pending"
          }
          data-review-start-scope={reviewStartScope || undefined}
          data-review-start-source={reviewStartSource || undefined}
        >
          {body}
        </p>
        {profileQuery.isError ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void profileQuery.refetch();
            }}
          >
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
