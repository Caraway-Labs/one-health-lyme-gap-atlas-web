import { Suspense } from "react";

import { explicitInternalDestination } from "@/features/ux-reset/onboarding/starting-view-completion";
import { StartingViewContinuation } from "@/features/ux-reset/onboarding/starting-view-continuation";

export default async function StartingViewContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const requested = explicitInternalDestination(raw ?? null);

  return (
    <Suspense
      fallback={
        <main>
          <p>Checking your starting view…</p>
        </main>
      }
    >
      <StartingViewContinuation requested={requested} />
    </Suspense>
  );
}
