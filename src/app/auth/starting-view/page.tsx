"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  destinationAfterStartingView,
  isStartingViewComplete,
  STARTING_VIEW_PATH,
} from "@/features/ux-reset/onboarding/starting-view-completion";
import { EntranceStatus } from "@/features/ux-reset/onboarding/starting-view-continuation";
import { StartingViewScreen } from "@/features/ux-reset/onboarding/starting-view-screen";
import { useSavedProfile } from "@/features/ux-reset/profile/use-saved-profile";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

export default function StartingViewPage() {
  const router = useRouter();
  const profile = useSavedProfile();

  useEffect(() => {
    if (profile.identity?.kind === "signed-out") {
      router.replace(signInHrefForReturnPath(STARTING_VIEW_PATH));
      return;
    }
    if (profile.data && isStartingViewComplete(profile.data)) {
      router.replace(destinationAfterStartingView(profile.data, null));
    }
  }, [profile.data, profile.identity, router]);

  if (profile.isError && !profile.sessionRejected) {
    return (
      <EntranceStatus
        action={
          <Button
            className="auth-entrance-primary"
            onClick={() => {
              void profile.refetch();
            }}
            type="button"
          >
            Try again
          </Button>
        }
        message="We couldn’t load your starting view. Nothing was changed. Try again."
        tone="alert"
      />
    );
  }

  if (
    !profile.isFetched ||
    profile.identity?.kind === "signed-out" ||
    (profile.data && isStartingViewComplete(profile.data))
  ) {
    return <EntranceStatus message="Checking your starting view…" />;
  }

  return <StartingViewScreen profile={profile.data ?? null} />;
}
