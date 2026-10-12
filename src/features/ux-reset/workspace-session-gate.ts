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

export const WORKSPACE_SHELL_ACTIONS = [
  "reveal",
  "reload",
  "sign-in",
  "hold",
] as const;

export type WorkspaceShellAction = (typeof WORKSPACE_SHELL_ACTIONS)[number];

/**
 * A confirmed session keeps this document only for the account that opened
 * it. A different confirmed account reloads the document so the previous
 * account's in-memory state is dropped. Previously logging out in this
 * document denies every read that does not confirm the session is present.
 * That flag lives with the page and therefore survives a back-forward cache
 * restore. A page that has not logged out leaves only when a successful read
 * confirms the session is absent; an error, a throw, or an unconfigured
 * client keeps the page. Fresh loads and bfcache restores follow this same
 * rule. Whether protected content may be shown is decided separately by
 * `workspaceShellAction`.
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

/**
 * Protected content stays concealed until a read confirms the same account
 * that opened the page. A different account, an unknown account on a restored
 * or already concealed page, and an indeterminate read of concealed content
 * reload that page. An absent session, or an indeterminate read after logout,
 * redirects to sign-in. Any other keep leaves a visible page alone.
 */
export function workspaceShellAction(input: {
  concealed: boolean;
  documentUserId: string | null;
  loggedOutInPageLifetime: boolean;
  navigation: WorkspaceSessionNavigation;
  read: WorkspaceSessionRead;
  sessionUserId: string | null;
}): WorkspaceShellAction {
  const decision = workspaceSessionDecision(input);
  if (
    input.read === "present" &&
    input.documentUserId !== null &&
    input.sessionUserId !== null &&
    input.documentUserId === input.sessionUserId
  ) {
    return "reveal";
  }
  switch (decision) {
    case "sign-in":
    case "reload": {
      return decision;
    }
    case "keep": {
      return concealedKeepAction(input);
    }
    default: {
      const exhaustive: never = decision;
      throw new Error(
        `Unsupported workspace session decision: ${String(exhaustive)}`
      );
    }
  }
}

function concealedKeepAction(input: {
  concealed: boolean;
  documentUserId: string | null;
  navigation: WorkspaceSessionNavigation;
  read: WorkspaceSessionRead;
  sessionUserId: string | null;
}): WorkspaceShellAction {
  const unknownAccount =
    input.read === "present" &&
    input.sessionUserId !== null &&
    input.documentUserId === null &&
    (input.navigation === "bfcache" || input.concealed);
  if (unknownAccount || (input.concealed && input.read !== "present")) {
    return "reload";
  }
  return "hold";
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
