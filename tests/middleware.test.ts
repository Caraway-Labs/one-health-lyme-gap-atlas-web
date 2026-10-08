// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FRONT_PORCH_SESSION_HEADER } from "@/lib/auth/front-porch-session-header";

type CookieToSet = {
  name: string;
  options?: { path?: string };
  value: string;
};

const getUser = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const createServerClient = vi.hoisted(() =>
  vi.fn<
    (
      url: string,
      key: string,
      options: {
        cookies: {
          getAll: () => unknown;
          setAll: (cookies: CookieToSet[]) => void;
        };
      }
    ) => { auth: { getUser: typeof getUser } }
  >()
);

vi.mock(
  import("@supabase/ssr"),
  () =>
    ({
      createServerClient,
    }) as never
);

import { middleware } from "@/middleware";

const SESSION_REQUEST_HEADER = `x-middleware-request-${FRONT_PORCH_SESSION_HEADER}`;

function atlasRequest(path: string, spoofSignedIn = false) {
  return new NextRequest(new URL(path, "http://localhost"), {
    headers: spoofSignedIn ? { [FRONT_PORCH_SESSION_HEADER]: "1" } : undefined,
  });
}

describe("front porch session middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getUser.mockReset();
    createServerClient.mockReset();
  });

  it("refreshes a signed-in Front Porch visitor and overwrites a spoofed header", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            getAll: () => unknown;
            setAll: (cookies: CookieToSet[]) => void;
          };
        }
      ) => {
        options.cookies.getAll();
        options.cookies.setAll([
          { name: "sb-access", options: { path: "/" }, value: "refreshed" },
        ]);
        return { auth: { getUser } };
      }
    );

    const response = await middleware(
      atlasRequest("/?county=08001&state=CO", true)
    );

    expect(response.headers.get(SESSION_REQUEST_HEADER)).toBe("1");
    expect(response.cookies.get("sb-access")?.value).toBe("refreshed");
    expect(response.status).toBe(200);
  });

  it("treats a Front Porch refresh error as signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    getUser.mockRejectedValue(new Error("refresh failed"));
    createServerClient.mockReturnValue({ auth: { getUser } });

    const response = await middleware(atlasRequest("/"));

    expect(response.headers.get(SESSION_REQUEST_HEADER)).toBe("0");
  });

  it("rethrows a refresh error on a professional route", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    getUser.mockRejectedValue(new Error("refresh failed"));
    createServerClient.mockReturnValue({ auth: { getUser } });

    await expect(middleware(atlasRequest("/app/review"))).rejects.toThrow(
      "refresh failed"
    );
  });

  it("redirects an unauthenticated workspace request and keeps refreshed cookies", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: null } });
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            getAll: () => unknown;
            setAll: (cookies: CookieToSet[]) => void;
          };
        }
      ) => {
        options.cookies.getAll();
        options.cookies.setAll([
          { name: "sb-access", options: { path: "/" }, value: "refreshed" },
        ]);
        return { auth: { getUser } };
      }
    );

    const response = await middleware(atlasRequest("/app/review"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/sign-in?next=%2Fapp%2Freview"
    );
    expect(response.cookies.get("sb-access")?.value).toBe("refreshed");
  });

  it("serves the Front Porch without Supabase configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const response = await middleware(atlasRequest("/", true));

    expect(createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get(SESSION_REQUEST_HEADER)).toBe("0");
  });
});
