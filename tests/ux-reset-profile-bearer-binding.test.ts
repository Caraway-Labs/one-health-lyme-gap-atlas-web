import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  lookups: 0,
  mode: "bind-write" as "bind-write" | "reject-foreign-read",
  session: {
    access_token: "token-a",
    user: { id: "user-a" },
  },
}));

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: {
      getSession: async () => {
        transport.lookups += 1;
        if (transport.mode === "reject-foreign-read") {
          const foreign = transport.lookups === 1;
          return {
            data: {
              session: {
                access_token: foreign ? "token-b" : "token-a",
                user: { id: foreign ? "user-b" : "user-a" },
              },
            },
            error: null,
          };
        }
        const snapshot = transport.session;
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
  readSavedProfile,
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
    transport.mode = "bind-write";
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

  it("rejects a read when the bound snapshot is a different account", async () => {
    transport.mode = "reject-foreign-read";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          profile: {
            job_title: null,
            organization: "From-B",
            role: null,
            state_code: "NY",
          },
        },
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    await expect(
      readSavedProfile(undefined, { kind: "user", userId: "user-a" })
    ).rejects.toMatchObject({ code: "superseded" });
    const authorizations = fetchMock.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get("Authorization")
    );
    expect({
      authorizations,
      called: fetchMock.mock.calls.length,
    }).toStrictEqual({
      authorizations: [],
      called: 0,
    });
  });
});
