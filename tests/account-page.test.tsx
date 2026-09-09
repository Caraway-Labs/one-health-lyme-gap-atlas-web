import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../src/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } }) }));
vi.mock("../src/generated/atlas", () => ({ getProfileV1MeProfileGet: vi.fn(), saveProfileV1MeProfilePut: vi.fn() }));

import AccountPage from "../src/app/account/page";

describe("AccountPage", () => {
  afterEach(cleanup);

  it("renders a native link for a signed-out user", async () => {
    render(<AccountPage />);
    const signIn = await screen.findByRole("link", { name: "Sign in" });
    expect(signIn.getAttribute("href")).toBe("/auth/sign-in?next=%2Faccount");
  });
});
