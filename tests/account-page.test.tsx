import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      getUser: vi
        .fn<() => Promise<{ data: { user: null } }>>()
        .mockResolvedValue({ data: { user: null } }),
    },
  }),
}));
vi.mock(import("../src/generated/atlas"), () => ({
  getProfileV1MeProfileGet: vi.fn<() => Promise<never>>(),
  saveProfileV1MeProfilePut: vi.fn<() => Promise<never>>(),
}));

import AccountPage from "../src/app/account/page";

describe("account page", () => {
  afterEach(cleanup);

  it("renders a native link for a signed-out user", async () => {
    render(<AccountPage />);
    const signIn = await screen.findByRole("link", { name: "Sign in" });
    expect(signIn.getAttribute("href")).toBe("/auth/sign-in?next=%2Faccount");
  });
});
