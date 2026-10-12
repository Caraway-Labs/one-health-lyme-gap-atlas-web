import type { QueryClient } from "@tanstack/react-query";

import { readProfileSessionIdentity } from "@/features/ux-reset/profile/profile-session";
import { savedProfileQueryRoot } from "@/features/ux-reset/profile/use-saved-profile";
import { createClient } from "@/lib/supabase/client";

export const SIGN_OUT_STILL_ACTIVE =
  "Sign-out did not finish. This session is still active, and your saved profile was not changed.";

export const SIGN_OUT_UNAVAILABLE =
  "Sign-out is unavailable in this session. Your saved profile was not changed.";

export type LocalSignOutResult = { notice: string; ok: false } | { ok: true };

function clearAccountQueries(queryClient: QueryClient | null): void {
  queryClient?.removeQueries({ queryKey: savedProfileQueryRoot() });
}

async function finishAfterSignOutError(
  queryClient: QueryClient | null
): Promise<LocalSignOutResult> {
  const identity = await readProfileSessionIdentity();
  if (identity.kind === "user") {
    return { notice: SIGN_OUT_STILL_ACTIVE, ok: false };
  }
  clearAccountQueries(queryClient);
  return { ok: true };
}

/** Ends the local Supabase session and drops account-scoped profile cache. */
export async function endLocalAtlasSession(
  queryClient: QueryClient | null
): Promise<LocalSignOutResult> {
  try {
    const { error } = await createClient().auth.signOut({ scope: "local" });
    if (error) {
      return await finishAfterSignOutError(queryClient);
    }
    clearAccountQueries(queryClient);
    return { ok: true };
  } catch {
    try {
      return await finishAfterSignOutError(queryClient);
    } catch {
      return { notice: SIGN_OUT_UNAVAILABLE, ok: false };
    }
  }
}
