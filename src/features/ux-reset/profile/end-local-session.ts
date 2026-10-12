import type { QueryClient } from "@tanstack/react-query";

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

/**
 * A failed sign-out is finished only when getSession succeeds and reports
 * no user. Thrown reads and returned errors stay indeterminate — including
 * the unconfigured outcome from a configured client — so local credentials
 * are not treated as removed.
 */
async function sessionReadConfirmsAbsence(): Promise<boolean> {
  try {
    const { data, error } = await createClient().auth.getSession();
    if (error) {
      return false;
    }
    return !data?.session?.user.id;
  } catch {
    return false;
  }
}

async function finishAfterSignOutError(
  queryClient: QueryClient | null
): Promise<LocalSignOutResult> {
  if (!(await sessionReadConfirmsAbsence())) {
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
