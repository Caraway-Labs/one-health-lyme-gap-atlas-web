import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasApiError } from "@/lib/api-mutator";

const { getProfile, saveProfile } = vi.hoisted(() => ({
  getProfile: vi.fn<() => Promise<never>>(),
  saveProfile:
    vi.fn<(body: { state_code?: string | null }) => Promise<never>>(),
}));

vi.mock(import("@/generated/atlas"), () => ({
  getProfileV1MeProfileGet: getProfile,
  saveProfileV1MeProfilePut: saveProfile,
}));

import {
  readSavedProfile,
  resetSavedProfileCoordinationForTests,
  writeSavedProfile,
} from "@/features/ux-reset/profile/saved-profile-client";
import { useSavedProfile } from "@/features/ux-reset/profile/use-saved-profile";

const emptyOptional = {
  job_title: null,
  organization: null,
  role: null,
} as const;

function profileResponse(stateCode: string | null) {
  return {
    data: {
      profile: {
        ...emptyOptional,
        state_code: stateCode,
      },
    },
    status: 200,
  };
}

function asResponse<T>(value: T): never {
  return value as never;
}

describe("saved profile client", () => {
  beforeEach(() => {
    resetSavedProfileCoordinationForTests();
    getProfile.mockReset();
    saveProfile.mockReset();
  });

  it("reads an unselected profile without treating it as national", async () => {
    getProfile.mockResolvedValue(
      asResponse({ data: { profile: null }, status: 200 })
    );
    const saved = await readSavedProfile();
    expect(saved.selection).toStrictEqual({ kind: "unselected" });
    expect(saved.completion.status).toBe("incomplete");
  });

  it("writes and reloads an explicit national default", async () => {
    saveProfile.mockResolvedValue(asResponse(profileResponse(null)));
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: null,
    });
    expect(written.status).toBe("confirmed");
    if (written.status !== "confirmed") {
      return;
    }
    expect(written.profile.selection).toStrictEqual({ kind: "national" });
    getProfile.mockResolvedValue(asResponse(profileResponse(null)));
    const reloaded = await readSavedProfile();
    expect(reloaded.selection).toStrictEqual({ kind: "national" });
    expect(reloaded.completion.status).toBe("complete");
  });

  it("writes and reloads a state default with empty optional fields", async () => {
    saveProfile.mockResolvedValue(asResponse(profileResponse("CO")));
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: "CO",
    });
    expect(written.status).toBe("confirmed");
    if (written.status !== "confirmed") {
      return;
    }
    expect(written.profile.selection).toStrictEqual({
      kind: "state",
      stateCode: "CO",
    });
    expect(written.profile.organization).toBeNull();
    expect(written.profile.jobTitle).toBeNull();
    getProfile.mockResolvedValue(asResponse(profileResponse("CO")));
    const reloaded = await readSavedProfile();
    expect(reloaded.selection).toStrictEqual({
      kind: "state",
      stateCode: "CO",
    });
  });

  it("keeps a mismatched echo unconfirmed", async () => {
    saveProfile.mockResolvedValue(asResponse(profileResponse("NY")));
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: "CO",
    });
    expect(written).toMatchObject({
      message: expect.stringContaining("saved default is unchanged"),
      status: "unconfirmed",
    });
  });

  it("keeps a null profile echo unconfirmed for a national write", async () => {
    saveProfile.mockResolvedValue(
      asResponse({ data: { profile: null }, status: 200 })
    );
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: null,
    });
    expect(written.status).toBe("unconfirmed");
  });

  it("announces a failed save without a confirmed profile", async () => {
    saveProfile.mockRejectedValue(
      new AtlasApiError("unavailable", "/v1/me/profile", 503, "req-9")
    );
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: "CO",
    });
    expect(written).toMatchObject({
      message: expect.stringMatching(
        /saved default is unchanged.*Reference: req-9\./
      ),
      status: "unconfirmed",
    });
  });

  it("rejects an unverifiable read instead of a blank profile", async () => {
    getProfile.mockResolvedValue(
      asResponse({
        data: { profile: { state_code: 12 } },
        status: 200,
      })
    );
    await expect(readSavedProfile()).rejects.toThrow(
      "Your profile is temporarily unavailable."
    );
  });

  it("ignores an older write that finishes after a newer one", async () => {
    const firstGate = Promise.withResolvers<boolean>();
    saveProfile.mockImplementation(
      asResponse(async (body: { state_code?: string | null }) => {
        if (body.state_code === "CO") {
          await firstGate.promise;
        }
        return profileResponse(body.state_code ?? null);
      })
    );
    const first = writeSavedProfile({ ...emptyOptional, state_code: "CO" });
    const second = writeSavedProfile({ ...emptyOptional, state_code: "NY" });
    await expect(second).resolves.toMatchObject({
      profile: { selection: { kind: "state", stateCode: "NY" } },
      status: "confirmed",
    });
    firstGate.resolve(true);
    await expect(first).resolves.toStrictEqual({ status: "superseded" });
  });

  it("drops a read that started before a confirmed write", async () => {
    const readGate = Promise.withResolvers<boolean>();
    getProfile.mockImplementation(
      asResponse(async () => {
        await readGate.promise;
        return { data: { profile: null }, status: 200 };
      })
    );
    const read = readSavedProfile();
    saveProfile.mockResolvedValue(asResponse(profileResponse("CO")));
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: "CO",
    });
    expect(written.status).toBe("confirmed");
    readGate.resolve(true);
    await expect(read).rejects.toMatchObject({ code: "superseded" });
  });

  it("does not let a superseded read replace a confirmed cache entry", async () => {
    const readGate = Promise.withResolvers<boolean>();
    getProfile.mockImplementation(
      asResponse(async () => {
        await readGate.promise;
        return { data: { profile: null }, status: 200 };
      })
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useSavedProfile(), { wrapper });
    saveProfile.mockResolvedValue(asResponse(profileResponse("CO")));
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: "CO",
    });
    expect(written.status).toBe("confirmed");
    if (written.status === "confirmed") {
      client.setQueryData(["ux-reset-saved-profile"], written.profile);
    }
    readGate.resolve(true);
    await waitFor(() => expect(hook.result.current.isSuccess).toBeTruthy());
    expect(hook.result.current.data?.selection).toStrictEqual({
      kind: "state",
      stateCode: "CO",
    });
    const pause = Promise.withResolvers<boolean>();
    setTimeout(() => {
      pause.resolve(true);
    }, 20);
    await pause.promise;
    expect(hook.result.current.data?.selection).toStrictEqual({
      kind: "state",
      stateCode: "CO",
    });
  });
});
