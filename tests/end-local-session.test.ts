import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  endLocalAtlasSession,
  SIGN_OUT_STILL_ACTIVE,
} from "@/features/ux-reset/profile/end-local-session";
import { savedProfileQueryRoot } from "@/features/ux-reset/profile/use-saved-profile";

type Session = { access_token: string; user: { id: string } } | null;

const auth = vi.hoisted(() => ({
  getSession: vi.fn<
    () => Promise<{
      data: { session: Session };
      error: { message: string } | null;
    }>
  >(),
  signOut:
    vi.fn<
      (options?: {
        scope?: string;
      }) => Promise<{ error: { message: string } | null }>
    >(),
}));

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: {
      getSession: () => auth.getSession(),
      signOut: (options?: { scope?: string }) => auth.signOut(options),
    },
  }),
}));

const retainedSession: Session = {
  access_token: "token-user-a",
  user: { id: "user-a" },
};

function clientWithProfile(): QueryClient {
  const client = new QueryClient();
  client.setQueryData([...savedProfileQueryRoot(), "user-a"], {
    organization: "CDPHE",
  });
  return client;
}

function storedProfiles(client: QueryClient): number {
  return client.getQueryCache().findAll({ queryKey: savedProfileQueryRoot() })
    .length;
}

describe(endLocalAtlasSession, () => {
  beforeEach(() => {
    auth.getSession.mockReset();
    auth.signOut.mockReset();
  });

  it("clears the account cache when sign-out succeeds", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(auth.getSession).not.toHaveBeenCalled();
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 0,
      result: { ok: true },
    });
  });

  it("finishes a failed sign-out when a successful read confirms the session is absent", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 0,
      result: { ok: true },
    });
  });

  it("keeps the account cache when a successful read still finds the session", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    auth.getSession.mockResolvedValue({
      data: { session: retainedSession },
      error: null,
    });
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 1,
      result: { notice: SIGN_OUT_STILL_ACTIVE, ok: false },
    });
  });

  it("keeps the account cache when sign-out fails and the follow-up read returns an error", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    auth.getSession.mockResolvedValue({
      data: { session: retainedSession },
      error: { message: "read failed" },
    });
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 1,
      result: { notice: SIGN_OUT_STILL_ACTIVE, ok: false },
    });
  });

  it("keeps the account cache when a configured client throws while reading the session", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "remote failed" } });
    auth.getSession.mockRejectedValue(new Error("session read failed"));
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 1,
      result: { notice: SIGN_OUT_STILL_ACTIVE, ok: false },
    });
  });

  it("keeps the account cache when sign-out and the follow-up read both throw", async () => {
    auth.signOut.mockRejectedValue(new Error("sign-out failed"));
    auth.getSession.mockRejectedValue(new Error("session read failed"));
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 1,
      result: { notice: SIGN_OUT_STILL_ACTIVE, ok: false },
    });
  });

  it("finishes a thrown sign-out when a successful read confirms the session is absent", async () => {
    auth.signOut.mockRejectedValue(new Error("sign-out failed"));
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const client = clientWithProfile();
    const result = await endLocalAtlasSession(client);
    expect({ profiles: storedProfiles(client), result }).toStrictEqual({
      profiles: 0,
      result: { ok: true },
    });
  });
});
