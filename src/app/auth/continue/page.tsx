import { Suspense } from "react";

import { explicitInternalDestination } from "@/features/ux-reset/onboarding/starting-view-completion";
import { StartingViewContinuation } from "@/features/ux-reset/onboarding/starting-view-continuation";
import { WorkspaceConnectingScreen } from "@/features/ux-reset/workspace-connecting-screen";

export default async function StartingViewContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const requested = explicitInternalDestination(raw ?? null);

  return (
    <Suspense fallback={<WorkspaceConnectingScreen />}>
      <StartingViewContinuation requested={requested} />
    </Suspense>
  );
}
