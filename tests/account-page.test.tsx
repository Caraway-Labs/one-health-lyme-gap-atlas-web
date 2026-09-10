import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn<() => Promise<{ data: { user: null } }>>(),
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
      getUser,
    },
  }),
}));
vi.mock(import("../src/generated/atlas"), () => ({
  getProfileV1MeProfileGet: vi.fn<() => Promise<never>>(),
  saveProfileV1MeProfilePut: vi.fn<() => Promise<never>>(),
}));

import AccountPage from "../src/app/account/page";

describe("account page", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    cleanup();
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
});
