"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  assessSavedProfile,
  type ProfileAssessment,
} from "@/features/ux-reset/profile/default-jurisdiction-contract";
import { useSavedProfile } from "@/features/ux-reset/profile/use-saved-profile";
import { useSettingsStateOptions } from "@/features/ux-reset/settings/use-settings-state-options";
import { reviewScopeLabel } from "@/lib/atlas-state-geography";

function confirmedCopy(
  assessment: ProfileAssessment,
  stateOptions: readonly { code: string; name: string }[]
): string {
  switch (assessment.summary) {
    case "confirmed": {
      return assessment.selection.kind === "state"
        ? reviewScopeLabel(assessment.selection.stateCode, stateOptions)
        : "United States";
    }
    case "unsupported": {
      const code =
        assessment.selection.kind === "unrecognized" ||
        assessment.selection.kind === "state"
          ? assessment.selection.stateCode
          : "that code";
      return `Saved state code ${code} is not a current Atlas state. Choose United States or a listed state and save.`;
    }
    case "loading": {
      return "Checking whether the saved state is in the current Atlas list.";
    }
    case "metadata-unavailable": {
      return "The state list is unavailable, so this saved state cannot be confirmed. New Review sessions start with the United States until the list loads.";
    }
    case "unselected":
    case "fallback": {
      return "No saved default. New Review sessions start with the United States until you save one.";
    }
    default: {
      const exhaustive: never = assessment.summary;
      return exhaustive;
    }
  }
}

export function DefaultJurisdictionReadout() {
  const profileQuery = useSavedProfile();
  const metadataQuery = useSettingsStateOptions();
  const stateOptions = metadataQuery.stateOptions;
  const profile = profileQuery.data;

  let body: string;
  let dataAttribute: string;
  let completion = "unavailable";
  let reviewStartScope = "";
  let reviewStartSource = "";
  if (profileQuery.sessionRejected) {
    body =
      "Your session expired. Sign in again before relying on this setting.";
    dataAttribute = "error";
  } else if (profileQuery.isPending) {
    body = "Loading profile…";
    dataAttribute = "pending";
  } else if (profileQuery.isError || !profile) {
    body =
      "Unable to load your default jurisdiction. Try again later before relying on this setting.";
    dataAttribute = "error";
  } else {
    const assessment = assessSavedProfile(profile, metadataQuery.stateList);
    body = confirmedCopy(assessment, stateOptions);
    dataAttribute = assessment.dataAttribute;
    completion = assessment.completion;
    reviewStartScope = assessment.reviewStart.scope;
    reviewStartSource = assessment.reviewStart.source;
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
