import { afterEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn<(code: string) => Promise<{ error: null }>>(),
  verifyOtp: vi.fn<
    (input: { token_hash: string; type: "email" }) => Promise<{ error: null }>
  >(),
}));

vi.mock(import("../src/lib/supabase/server"), () =>
  ({
    createClient: async () => ({
      auth: { exchangeCodeForSession, verifyOtp },
    }),
  }) as unknown as Partial<typeof import("../src/lib/supabase/server")>
);

import { GET as confirm } from "../src/app/auth/confirm/route";

describe("authentication callback routes", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
  });

  it("exchanges the PKCE code returned by a magic-link verification", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://carawaylabs.com";
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await confirm(
      new Request("http://0.0.0.0:8080/auth/confirm?code=pkce-code&next=%2Faccount")
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://carawaylabs.com/account");
  });

  it("keeps token-hash confirmation compatible with custom email templates", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await confirm(
      new Request("https://atlas.example.test/auth/confirm?token_hash=token&next=%2F")
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token", type: "email" });
    expect(response.headers.get("location")).toBe("https://atlas.example.test/");
  });
});
