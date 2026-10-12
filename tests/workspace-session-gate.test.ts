import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readWorkspaceSession,
  WORKSPACE_SESSION_READS,
  workspaceSessionDecision,
  type WorkspaceSessionNavigation,
  type WorkspaceSessionRead,
} from "@/features/ux-reset/workspace-session-gate";

type Session = { user: { id: string } } | null;

const auth = vi.hoisted(() => ({
  configured: true,
  getSession: vi.fn<
    () => Promise<{
      data: { session: Session };
      error: { message: string } | null;
    }>
  >(),
}));

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => {
    if (!auth.configured) {
      throw new Error("Account sign-in is not configured.");
    }
    return { auth: { getSession: () => auth.getSession() } };
  },
}));

const retainedSession = { user: { id: "user-a" } };

describe("workspace session gate", () => {
  beforeEach(() => {
    auth.configured = true;
    auth.getSession.mockReset();
  });

  it("keeps a page that has not logged out unless the session is confirmed absent", () => {
    const rows: {
      action: "keep" | "sign-in";
      loggedOutInPageLifetime: boolean;
      navigation: WorkspaceSessionNavigation;
      read: WorkspaceSessionRead;
    }[] = [
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "fresh",
        read: "present",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: false,
        navigation: "fresh",
        read: "absent",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "fresh",
        read: "error",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "fresh",
        read: "throws",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "fresh",
        read: "unconfigured",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "bfcache",
        read: "present",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: false,
        navigation: "bfcache",
        read: "absent",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "bfcache",
        read: "error",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "bfcache",
        read: "throws",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: false,
        navigation: "bfcache",
        read: "unconfigured",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: true,
        navigation: "fresh",
        read: "present",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "fresh",
        read: "absent",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "fresh",
        read: "error",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "fresh",
        read: "throws",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "fresh",
        read: "unconfigured",
      },
      {
        action: "keep",
        loggedOutInPageLifetime: true,
        navigation: "bfcache",
        read: "present",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "bfcache",
        read: "absent",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "bfcache",
        read: "error",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "bfcache",
        read: "throws",
      },
      {
        action: "sign-in",
        loggedOutInPageLifetime: true,
        navigation: "bfcache",
        read: "unconfigured",
      },
    ];
    const navigations = [
      ...new Set(rows.map((row) => row.navigation)),
    ].toSorted();
    const reads = [...new Set(rows.map((row) => row.read))].toSorted();
    expect({
      actions: rows.map((row) =>
        workspaceSessionDecision({
          loggedOutInPageLifetime: row.loggedOutInPageLifetime,
          navigation: row.navigation,
          read: row.read,
        })
      ),
      count: rows.length,
      navigations,
      reads,
    }).toStrictEqual({
      actions: rows.map((row) => row.action),
      count: WORKSPACE_SESSION_READS.length * 4,
      navigations: ["bfcache", "fresh"],
      reads: [...WORKSPACE_SESSION_READS].toSorted(),
    });
  });

  it("classifies a configured client separately from a failed read", async () => {
    auth.getSession.mockResolvedValueOnce({
      data: { session: retainedSession },
      error: null,
    });
    const present = await readWorkspaceSession();
    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const absent = await readWorkspaceSession();
    auth.getSession.mockResolvedValueOnce({
      data: { session: retainedSession },
      error: { message: "read failed" },
    });
    const error = await readWorkspaceSession();
    auth.getSession.mockRejectedValueOnce(new Error("session read failed"));
    const thrown = await readWorkspaceSession();
    auth.configured = false;
    const unconfigured = await readWorkspaceSession();
    expect({ absent, error, present, thrown, unconfigured }).toStrictEqual({
      absent: { read: "absent", userId: null },
      error: { read: "error", userId: null },
      present: { read: "present", userId: "user-a" },
      thrown: { read: "throws", userId: null },
      unconfigured: { read: "unconfigured", userId: null },
    });
  });

  it("reloads a page when the confirmed account is not the one that opened it", () => {
    const rows: {
      action: "keep" | "reload";
      documentUserId: string | null;
      navigation: WorkspaceSessionNavigation;
      sessionUserId: string | null;
    }[] = [
      {
        action: "reload",
        documentUserId: "user-a",
        navigation: "bfcache",
        sessionUserId: "user-b",
      },
      {
        action: "reload",
        documentUserId: "user-a",
        navigation: "fresh",
        sessionUserId: "user-b",
      },
      {
        action: "keep",
        documentUserId: "user-a",
        navigation: "bfcache",
        sessionUserId: "user-a",
      },
      {
        action: "keep",
        documentUserId: null,
        navigation: "bfcache",
        sessionUserId: "user-b",
      },
    ];
    expect(
      rows.map((row) =>
        workspaceSessionDecision({
          documentUserId: row.documentUserId,
          loggedOutInPageLifetime: true,
          navigation: row.navigation,
          read: "present",
          sessionUserId: row.sessionUserId,
        })
      )
    ).toStrictEqual(rows.map((row) => row.action));
  });
});
