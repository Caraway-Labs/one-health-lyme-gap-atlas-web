import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldRedirectUnauthenticatedAppRoute } from "@/lib/auth/app-route-guard";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession:
    vi.fn<(code: string) => Promise<{ error: { message: string } | null }>>(),
}));

vi.mock(
  import("../src/lib/supabase/server"),
  () =>
    ({
      createClient: async () => ({
        auth: { exchangeCodeForSession },
      }),
    }) as unknown as Partial<typeof import("../src/lib/supabase/server")>
);

import { GET as authCallback } from "../src/app/auth/callback/route";

describe("UX Reset auth redirect contract", () => {
  afterEach(() => {
    exchangeCodeForSession.mockReset();
  });

  it("sends unauthenticated reset deep links to sign-in with the full return path", () => {
    const returnPath = "/app/investigate?county=08001&scope=state&tab=map";
    expect(signInHrefForReturnPath(returnPath)).toBe(
      "/auth/sign-in?next=%2Fapp%2Finvestigate%3Fcounty%3D08001%26scope%3Dstate%26tab%3Dmap"
    );
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: false,
        nodeEnv: "production",
        pathname: "/app/investigate",
        supabaseConfigured: true,
        userPresent: false,
      })
    ).toBeTruthy();
  });

  it("returns expired-session recovery to sign-in and successful exchange to the reset route", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const success = await authCallback(
      new Request(
        "https://atlas.example.test/auth/callback?code=session-code&next=%2Fapp%2Fexplore%3Fcounty%3D08001"
      )
    );
    expect(success.headers.get("location")).toBe(
      "https://atlas.example.test/app/explore?county=08001"
    );

    exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "expired" },
    });
    const expired = await authCallback(
      new Request(
        "https://atlas.example.test/auth/callback?code=bad&next=%2Fapp%2Freview"
      )
    );
    expect(expired.headers.get("location")).toBe(
      "https://atlas.example.test/auth/sign-in?error=expired_or_invalid"
    );
  });
});
