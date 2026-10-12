import { createClient } from "@/lib/supabase/client";

export const WORKSPACE_SESSION_READS = [
  "present",
  "absent",
  "error",
  "throws",
  "unconfigured",
] as const;

export type WorkspaceSessionRead = (typeof WORKSPACE_SESSION_READS)[number];

export type WorkspaceSessionNavigation = "bfcache" | "fresh";

export type WorkspaceSessionSnapshot = {
  read: WorkspaceSessionRead;
  userId: string | null;
};

export type WorkspaceSessionAction = "keep" | "reload" | "sign-in";

/**
 * A confirmed session keeps this document only for the account that opened
 * it. A different confirmed account reloads the document so the previous
 * account's in-memory state is dropped. Previously logging out in this
 * document denies every read that does not confirm the session is present.
 * That flag lives with the page and therefore survives a back-forward cache
 * restore. A page that has not logged out leaves only when a successful read
 * confirms the session is absent; an error, a throw, or an unconfigured
 * client keeps the page. Fresh loads and bfcache restores follow this same
 * rule.
 */
export function workspaceSessionDecision(input: {
  documentUserId?: string | null;
  loggedOutInPageLifetime: boolean;
  navigation: WorkspaceSessionNavigation;
  read: WorkspaceSessionRead;
  sessionUserId?: string | null;
}): WorkspaceSessionAction {
  switch (input.navigation) {
    case "bfcache":
    case "fresh": {
      break;
    }
    default: {
      const exhaustive: never = input.navigation;
      throw new Error(
        `Unsupported workspace navigation: ${String(exhaustive)}`
      );
    }
  }
  switch (input.read) {
    case "present": {
      if (
        input.documentUserId != null &&
        input.sessionUserId != null &&
        input.documentUserId !== input.sessionUserId
      ) {
        return "reload";
      }
      return "keep";
    }
    case "absent": {
      return "sign-in";
    }
    case "error":
    case "throws":
    case "unconfigured": {
      return input.loggedOutInPageLifetime ? "sign-in" : "keep";
    }
    default: {
      const exhaustive: never = input.read;
      throw new Error(`Unsupported session read: ${String(exhaustive)}`);
    }
  }
}

/** Distinguishes a confirmed session from a failed read. */
export async function readWorkspaceSession(): Promise<WorkspaceSessionSnapshot> {
  let client: ReturnType<typeof createClient>;
  try {
    client = createClient();
  } catch {
    return { read: "unconfigured", userId: null };
  }
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      return { read: "error", userId: null };
    }
    const userId = data?.session?.user.id;
    return userId
      ? { read: "present", userId }
      : { read: "absent", userId: null };
  } catch {
    return { read: "throws", userId: null };
  }
}
