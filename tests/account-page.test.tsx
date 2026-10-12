import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { followWorkspaceHref, getProfile, getSession, getUser, signOut } =
  vi.hoisted(() => ({
    followWorkspaceHref: vi.fn<(href: string) => void>(),
    getProfile: vi.fn<() => Promise<never>>(),
    getSession: vi.fn<
      () => Promise<{
        data: { session: { user: { id: string } } | null };
        error: null;
      }>
    >(),
    getUser: vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>(),
    signOut:
      vi.fn<
        (options?: {
          scope?: string;
        }) => Promise<{ error: { message: string } | null }>
      >(),
  }));

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ push: vi.fn<() => void>() }),
    }) as unknown as Partial<typeof import("next/navigation")>
);
vi.mock(import("../src/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: {
      getSession,
      getUser,
      signOut,
    },
  }),
}));
vi.mock(import("../src/features/ux-reset/workspace-navigation"), () => ({
  followWorkspaceHref,
}));
vi.mock(import("../src/generated/atlas"), () => ({
  getProfileV1MeProfileGet: getProfile,
  saveProfileV1MeProfilePut: vi.fn<() => Promise<never>>(),
  createPrivacyRequestV1MePrivacyRequestsPost: vi.fn<() => Promise<never>>(),
  confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost:
    vi.fn<() => Promise<never>>(),
  downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet:
    vi.fn<() => Promise<never>>(),
}));

import AccountPage from "../src/app/account/page";
import {
  resetWorkspaceSignOutStateForTests,
  workspaceSignOutSuppressesExpiryRedirect,
} from "../src/features/ux-reset/workspace-sign-out";

describe("account page", () => {
  beforeEach(() => {
    resetWorkspaceSignOutStateForTests();
    followWorkspaceHref.mockReset();
    getSession.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    cleanup();
    resetWorkspaceSignOutStateForTests();
    getProfile.mockReset();
    getUser.mockReset();
  });

  it("renders a native link for a signed-out user", async () => {
    render(<AccountPage />);
    const signIn = await screen.findByRole("link", { name: "Sign in" });
    expect(signIn.getAttribute("href")).toBe("/auth/sign-in?next=%2Faccount");
  });

  it("falls back to the signed-out view when session lookup fails", async () => {
    getUser.mockRejectedValueOnce(new Error("unavailable"));

    render(<AccountPage />);
    await expect(
      screen.findByRole("link", { name: "Sign in" })
    ).resolves.toBeTruthy();
    expect(screen.queryByText("Checking account session…")).toBeNull();
    expect(
      screen.getByText(
        "Your profile is temporarily unavailable. You can continue exploring Atlas."
      )
    ).toBeTruthy();
  });

  it("uses shared select primitives for optional profile fields", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } as never },
    });
    getProfile.mockResolvedValue({
      data: { profile: null },
      status: 200,
    } as never);

    render(<AccountPage />);

    await expect(
      screen.findByRole("combobox", { name: "Role" })
    ).resolves.toBeTruthy();
    expect(screen.getByRole("combobox", { name: "State" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export my data" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove all data" })
    ).toBeTruthy();
  });

  it("signs out through the shared workspace flow", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    getProfile.mockResolvedValue({
      data: { profile: null },
      status: 200,
    } as never);

    render(<AccountPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(followWorkspaceHref).toHaveBeenCalledWith("/");
    });
    expect({
      scope: signOut.mock.calls,
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      scope: [[{ scope: "local" }]],
      suppressing: true,
    });
  });
});
