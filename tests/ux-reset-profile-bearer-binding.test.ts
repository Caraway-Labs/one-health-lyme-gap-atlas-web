import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  lookups: 0,
  session: {
    access_token: "token-a",
    user: { id: "user-a" },
  },
}));

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: {
      getSession: async () => {
        const snapshot = transport.session;
        transport.lookups += 1;
        if (transport.lookups === 1) {
          transport.session = {
            access_token: "token-b",
            user: { id: "user-b" },
          };
        }
        return { data: { session: snapshot }, error: null };
      },
    },
  }),
}));

import {
  resetSavedProfileCoordinationForTests,
  writeSavedProfile,
} from "@/features/ux-reset/profile/saved-profile-client";

const profileBody = {
  job_title: null,
  organization: "A-SECRET",
  role: null,
  state_code: "CO",
} as const;

describe("profile bearer binding", () => {
  beforeEach(() => {
    resetSavedProfileCoordinationForTests();
    transport.lookups = 0;
    transport.session = {
      access_token: "token-a",
      user: { id: "user-a" },
    };
    vi.restoreAllMocks();
  });

  it("sends the preflight token when the session changes before the transport lookup", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { profile: profileBody },
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    await writeSavedProfile(profileBody, {
      kind: "user",
      userId: "user-a",
    });
    expect(transport.lookups).toBeGreaterThan(1);
    expect(transport.session.user.id).toBe("user-b");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer token-a"
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      organization: "A-SECRET",
      state_code: "CO",
    });
  });
});
