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

import { savedProfileFromUserProfile } from "@/features/ux-reset/profile/default-jurisdiction-contract";
import {
  readSavedProfile,
  resetSavedProfileCoordinationForTests,
  writeSavedProfile,
} from "@/features/ux-reset/profile/saved-profile-client";
import {
  useSavedProfile,
  savedProfileQueryKey,
} from "@/features/ux-reset/profile/use-saved-profile";

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
      message: expect.not.stringContaining("saved default is unchanged"),
      status: "diverged",
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
    expect(written).toMatchObject({
      message: expect.not.stringContaining("saved default is unchanged"),
      status: "diverged",
    });
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
        /could not confirm that save.*Reference: req-9\./
      ),
      status: "uncertain",
    });
    expect(written).toMatchObject({
      message: expect.not.stringContaining("saved default is unchanged"),
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

  it("serializes an older write behind a newer one across the queue", async () => {
    const firstGate = Promise.withResolvers<boolean>();
    saveProfile.mockImplementation(
      asResponse(async (body: { state_code?: string | null }) => {
        if (body.state_code === "CO") {
          await firstGate.promise;
        }
        return profileResponse(body.state_code ?? null);
      })
    );
    const identity = { kind: "unconfigured" as const };
    const first = writeSavedProfile(
      { ...emptyOptional, state_code: "CO" },
      identity
    );
    await vi.waitFor(() => expect(saveProfile).toHaveBeenCalledOnce());
    const second = writeSavedProfile(
      { ...emptyOptional, state_code: "NY" },
      identity
    );
    await Promise.resolve();
    expect(saveProfile).toHaveBeenCalledOnce();
    firstGate.resolve(true);
    await expect(first).resolves.toStrictEqual({ status: "superseded" });
    await expect(second).resolves.toMatchObject({
      profile: { selection: { kind: "state", stateCode: "NY" } },
      status: "confirmed",
    });
    expect(saveProfile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state_code: "NY" })
    );
  });

  it("rejects a read that starts while a write is still in flight", async () => {
    const writeGate = Promise.withResolvers<boolean>();
    saveProfile.mockImplementation(
      asResponse(async () => {
        await writeGate.promise;
        return profileResponse("NY");
      })
    );
    const writing = writeSavedProfile({
      ...emptyOptional,
      state_code: "NY",
    });
    await vi.waitFor(() => expect(saveProfile).toHaveBeenCalledOnce());
    getProfile.mockResolvedValue(asResponse(profileResponse("CO")));
    const read = readSavedProfile();
    writeGate.resolve(true);
    await expect(writing).resolves.toMatchObject({
      profile: { selection: { stateCode: "NY" } },
      status: "confirmed",
    });
    await expect(read).rejects.toMatchObject({ code: "superseded" });
  });

  it("confirms a lost save response when the following read echoes it", async () => {
    saveProfile.mockRejectedValue(
      new AtlasApiError("lost", "/v1/me/profile", 503, "req-lost")
    );
    getProfile.mockResolvedValue(asResponse(profileResponse("CO")));
    const written = await writeSavedProfile({
      ...emptyOptional,
      state_code: "CO",
    });
    expect(written).toMatchObject({
      profile: { selection: { stateCode: "CO" } },
      status: "confirmed",
    });
  });

  it("says unchanged only when a completed save echoes the previous profile", async () => {
    saveProfile.mockResolvedValue(asResponse(profileResponse(null)));
    const written = await writeSavedProfile(
      { ...emptyOptional, state_code: "CO" },
      undefined,
      savedProfileFromUserProfile({ ...emptyOptional, state_code: null })
    );
    expect(written).toMatchObject({
      message: expect.stringContaining("saved default is unchanged"),
      status: "unconfirmed",
    });
  });

  it("keeps a lost save uncertain when the follow-up read is still the previous profile", async () => {
    saveProfile.mockRejectedValue(
      new AtlasApiError("lost", "/v1/me/profile", 503, "req-same")
    );
    getProfile.mockResolvedValue(asResponse(profileResponse(null)));
    const written = await writeSavedProfile(
      { ...emptyOptional, state_code: "CO" },
      undefined,
      savedProfileFromUserProfile({ ...emptyOptional, state_code: null })
    );
    expect(written).toMatchObject({
      message: expect.not.stringContaining("saved default is unchanged"),
      status: "uncertain",
    });
  });

  it("keeps a dropped save uncertain when a later save is followed by the original commit", async () => {
    let stored: {
      job_title: null;
      organization: string | null;
      role: null;
      state_code: string | null;
    } = {
      ...emptyOptional,
      organization: "Original",
      state_code: null,
    };
    let commitDroppedSave: (() => void) | undefined;
    saveProfile.mockImplementation(
      asResponse(
        async (body: {
          organization?: string | null;
          state_code?: string | null;
        }) => {
          if (body.organization === "First") {
            commitDroppedSave = () => {
              stored = {
                ...emptyOptional,
                organization: "First",
                state_code: body.state_code ?? null,
              };
            };
            throw new TypeError("connection dropped");
          }
          stored = {
            ...emptyOptional,
            organization: body.organization ?? null,
            state_code: body.state_code ?? null,
          };
          return { data: { profile: stored }, status: 200 };
        }
      )
    );
    getProfile.mockImplementation(
      asResponse(async () => ({ data: { profile: stored }, status: 200 }))
    );
    const first = await writeSavedProfile(
      { ...emptyOptional, organization: "First", state_code: "NY" },
      undefined,
      savedProfileFromUserProfile({
        ...emptyOptional,
        organization: "Original",
        state_code: null,
      })
    );
    expect(first).toMatchObject({
      message: expect.not.stringContaining("saved default is unchanged"),
      status: "uncertain",
    });
    const second = await writeSavedProfile({
      ...emptyOptional,
      organization: "Second",
      state_code: "CO",
    });
    expect(second).toMatchObject({
      profile: { organization: "Second" },
      status: "confirmed",
    });
    expect(saveProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ organization: "Second", state_code: "CO" })
    );
    if (!commitDroppedSave) {
      throw new Error("The dropped save never reached the server.");
    }
    commitDroppedSave();
    const current = await readSavedProfile();
    expect(current.organization).toBe("First");
    expect(first).toMatchObject({ status: "uncertain" });
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
      client.setQueryData(
        savedProfileQueryKey({ kind: "unconfigured" }),
        written.profile
      );
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

  it("resumes an empty read after the same account's write settles", async () => {
    const writeGate = Promise.withResolvers<boolean>();
    saveProfile.mockImplementation(
      asResponse(async () => {
        await writeGate.promise;
        return profileResponse("NY");
      })
    );
    const writing = writeSavedProfile({
      ...emptyOptional,
      state_code: "NY",
    });
    await vi.waitFor(() => expect(saveProfile).toHaveBeenCalledOnce());
    let reads = 0;
    getProfile.mockImplementation(
      asResponse(async () => {
        reads += 1;
        return profileResponse(reads === 1 ? "CO" : "NY");
      })
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useSavedProfile(), { wrapper });
    await vi.waitFor(() => expect(reads).toBe(1));
    writeGate.resolve(true);
    await expect(writing).resolves.toMatchObject({ status: "confirmed" });
    await waitFor(() =>
      expect(hook.result.current.data?.selection).toStrictEqual({
        kind: "state",
        stateCode: "NY",
      })
    );
    expect(reads).toBeGreaterThan(1);
  });
});
